import "server-only";
import { z } from "zod";
import { cached, fetchJson, UpstreamError } from "./cache";
import type { NdviObs } from "@/lib/agro/satellite";

/**
 * Copernicus Data Space Ecosystem — Sentinel Hub Statistical API.
 * Daily NDVI and NDWI statistics for a field polygon from Sentinel-2 L2A,
 * keeping only pixels the Scene Classification Layer marks as vegetation (4)
 * or bare soil (5): cloud, cloud shadow, cirrus, water and snow are removed.
 * NDWI here is Gao's leaf-water index (B08 − B11)/(B08 + B11), shown as a
 * supporting indicator only.
 */
const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

export function cdseConfigured(): boolean {
  return Boolean(process.env.CDSE_CLIENT_ID && process.env.CDSE_CLIENT_SECRET);
}

let token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.CDSE_CLIENT_ID ?? "",
    client_secret: process.env.CDSE_CLIENT_SECRET ?? "",
  });
  const json = z
    .object({ access_token: z.string(), expires_in: z.number() })
    .parse(await fetchJson(TOKEN_URL, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" }, provider: "Copernicus identity" }));
  token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return token.value;
}

export const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndwi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var clear = (s.SCL == 4 || s.SCL == 5) ? 1 : 0;
  var ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  var ndwi = (s.B08 - s.B11) / (s.B08 + s.B11);
  return { ndvi: [ndvi], ndwi: [ndwi], dataMask: [s.dataMask * clear] };
}`;

export function buildStatsRequest(geometry: GeoJSON.Polygon, from: string, to: string) {
  return {
    input: {
      bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
      data: [{ type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC" } }],
    },
    aggregation: {
      timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      aggregationInterval: { of: "P1D" },
      evalscript: EVALSCRIPT,
      resx: 0.0001, // ≈ 10 m in degrees
      resy: 0.0001,
    },
    calculations: { default: { statistics: { default: { percentiles: { k: [50] } } } } },
  };
}

const Stats = z.object({
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  mean: z.union([z.number(), z.string()]).optional(),
  sampleCount: z.number(),
  noDataCount: z.number(),
  percentiles: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});
const Band = z.object({ bands: z.record(z.string(), z.object({ stats: Stats })) });
const StatsResponse = z.object({
  data: z.array(
    z.object({
      interval: z.object({ from: z.string(), to: z.string() }),
      outputs: z.record(z.string(), Band),
      error: z.unknown().optional(),
    }),
  ),
  status: z.string().optional(),
});

export type SatelliteObs = NdviObs & { ndwi: number | null };

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

/** Parse a Statistical API response into daily observations; cloudy days come back with ndvi = null. */
export function parseStats(json: unknown): SatelliteObs[] {
  const res = StatsResponse.parse(json);
  return res.data
    .map((d) => {
      const nd = d.outputs.ndvi?.bands.B0?.stats;
      const nw = d.outputs.ndwi?.bands.B0?.stats;
      if (!nd) return null;
      const valid = nd.sampleCount > 0 ? (100 * (nd.sampleCount - nd.noDataCount)) / nd.sampleCount : 0;
      const med = nd.percentiles ? Object.values(nd.percentiles)[0] : nd.mean;
      const usable = valid >= 30; // fewer than 30 % clear pixels = treat as cloudy
      return {
        date: d.interval.from.slice(0, 10),
        ndvi: usable ? numOrNull(med) : null,
        ndwi: usable ? numOrNull(nw?.percentiles ? Object.values(nw.percentiles)[0] : nw?.mean) : null,
        validPct: Math.round(valid),
      } satisfies SatelliteObs;
    })
    .filter((x): x is SatelliteObs => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getFieldSatellite(fieldId: string, geometry: GeoJSON.Polygon, from: string, to: string) {
  if (!cdseConfigured()) throw new UpstreamError("Copernicus", 0, "not configured (CDSE_CLIENT_ID / CDSE_CLIENT_SECRET)");
  const key = `cdse:${fieldId}:${from}:${to}`;
  return cached(key, "cdse", 24 * 3600_000, async () => {
    const tk = await getToken();
    const json = await fetchJson(STATS_URL, {
      method: "POST",
      provider: "Copernicus Statistical API",
      timeoutMs: 25_000,
      headers: { authorization: `Bearer ${tk}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(buildStatsRequest(geometry, from, to)),
    });
    return parseStats(json);
  });
}
