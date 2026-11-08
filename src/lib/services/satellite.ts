import type { Feature, Geometry, Polygon } from "geojson";

export interface SatelliteResult {
  status: "ok" | "unavailable";
  reason?: string;
  scene?: {
    id: string;
    datetime: string;
    cloudCover: number | null;
    platform: string | null;
    collection: string;
    selfUrl: string;
    thumbnail?: string | null;
  };
  ndvi?: {
    mean: number | null;
    min: number | null;
    max: number | null;
    validFraction: number | null;
    validPixels: number | null;
  } | null;
  source: string;
  fetchedAt: string;
  notice?: string;
}

const STAC_SEARCH = "https://earth-search.aws.element84.com/v1/search";
const TILER = "https://titiler.xyz";

export function pointBuffer(lat: number, lon: number, bufferM = 300): Feature<Polygon> {
  const latDelta = bufferM / 111_320;
  const lonDelta = bufferM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon - lonDelta, lat - latDelta],
          [lon + lonDelta, lat - latDelta],
          [lon + lonDelta, lat + latDelta],
          [lon - lonDelta, lat + latDelta],
          [lon - lonDelta, lat - latDelta],
        ],
      ],
    },
  };
}

function centroid(geometry: Geometry): { lat: number; lon: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value) && "type" in value) {
      const objectValue = value as {
        type?: string;
        geometries?: unknown[];
        coordinates?: unknown;
      };
      if (objectValue.type === "GeometryCollection" && Array.isArray(objectValue.geometries)) {
        objectValue.geometries.forEach(walk);
        return;
      }
      if (Array.isArray(objectValue.coordinates)) {
        walk(objectValue.coordinates);
      }
      return;
    }
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      minX = Math.min(minX, value[0]);
      maxX = Math.max(maxX, value[0]);
      minY = Math.min(minY, value[1]);
      maxY = Math.max(maxY, value[1]);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry);
  return { lat: (minY + maxY) / 2, lon: (minX + maxX) / 2 };
}

export function geometryFor(
  options: { geometry?: Feature | null; lat?: number; lon?: number; bufferM?: number },
): { feature: Feature; lat: number; lon: number } | null {
  if (options.geometry) {
    return {
      feature: options.geometry,
      ...centroid(options.geometry.geometry),
    };
  }
  if (typeof options.lat === "number" && typeof options.lon === "number") {
    return {
      feature: pointBuffer(options.lat, options.lon, options.bufferM ?? 300),
      lat: options.lat,
      lon: options.lon,
    };
  }
  return null;
}

export async function fetchSatelliteObservation(
  feature: Feature,
): Promise<SatelliteResult> {
  const fetchedAt = new Date().toISOString();
  const source =
    "Copernicus Sentinel-2 L2A via Element 84 Earth Search; statistics by TiTiler";

  try {
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 86_400_000);
    const searchBody = {
      collections: ["sentinel-2-l2a"],
      intersects: feature.geometry,
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit: 10,
      query: { "eo:cloud_cover": { lt: 60 } },
      sortby: [{ field: "properties.datetime", direction: "desc" }],
    };

    const searchResponse = await fetch(STAC_SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Neerakshi/0.1" },
      body: JSON.stringify(searchBody),
      signal: AbortSignal.timeout(30_000),
    });
    if (!searchResponse.ok) {
      return {
        status: "unavailable",
        reason: `Satellite catalogue returned HTTP ${searchResponse.status}.`,
        source,
        fetchedAt,
      };
    }

    const searchData = (await searchResponse.json()) as {
      features?: Array<{
        id: string;
        collection?: string;
        properties?: Record<string, unknown>;
        assets?: Record<string, { href?: string }>;
        links?: Array<{ rel?: string; href?: string }>;
      }>;
    };
    const items = searchData.features ?? [];
    if (items.length === 0) {
      return {
        status: "unavailable",
        reason: "No usable Sentinel-2 scene found for this field and period.",
        source,
        fetchedAt,
      };
    }

    let lastReason = "Sentinel-2 scene statistics were unavailable.";
    for (const item of items.slice(0, 3)) {
      const selfUrl =
        item.links?.find((link) => link.rel === "self")?.href ??
        `${STAC_SEARCH.replace("/search", "")}/collections/sentinel-2-l2a/items/${item.id}`;
      const stats = await fetchNdviStatistics(selfUrl, feature);
      if (!stats || stats.validFraction === null || stats.validFraction < 0.15) {
        lastReason =
          stats?.validFraction !== null && stats?.validFraction !== undefined
            ? `Scene ${item.id} has only ${(stats.validFraction * 100).toFixed(0)}% valid NDVI pixels.`
            : `Statistics failed for scene ${item.id}.`;
        continue;
      }

      const properties = item.properties ?? {};
      return {
        status: "ok",
        scene: {
          id: item.id,
          datetime: String(properties.datetime ?? ""),
          cloudCover:
            properties["eo:cloud_cover"] !== undefined
              ? Number(properties["eo:cloud_cover"])
              : null,
          platform: properties.platform ? String(properties.platform) : null,
          collection: item.collection ?? "sentinel-2-l2a",
          selfUrl,
          thumbnail: item.assets?.thumbnail?.href ?? null,
        },
        ndvi: stats,
        source,
        fetchedAt,
        notice:
          stats.validFraction < 0.5
            ? "A large share of the field polygon is masked or outside the scene; NDVI confidence is reduced."
            : undefined,
      };
    }

    return {
      status: "unavailable",
      reason: lastReason,
      source,
      fetchedAt,
    };
  } catch (cause) {
    return {
      status: "unavailable",
      reason:
        cause instanceof Error
          ? `Satellite request failed: ${cause.message}`
          : "Satellite request failed.",
      source,
      fetchedAt,
    };
  }
}

async function fetchNdviStatistics(
  selfUrl: string,
  feature: Feature,
): Promise<NonNullable<SatelliteResult["ndvi"]> | null> {
  const params = new URLSearchParams({ url: selfUrl, asset_as_band: "true" });
  params.append("assets", "red");
  params.append("assets", "nir");
  params.set("expression", "(b2-b1)/(b2+b1)");

  try {
    const response = await fetch(`${TILER}/stac/statistics?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Neerakshi/0.1" },
      body: JSON.stringify(feature),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      properties?: {
        statistics?: Record<
          string,
          {
            mean?: number;
            min?: number;
            max?: number;
            valid_percent?: number;
            valid_pixels?: number;
          }
        >;
      };
    };
    const statistics = data.properties?.statistics;
    if (!statistics) return null;
    const first = Object.values(statistics)[0];
    if (!first) return null;
    const round = (value: number | undefined) =>
      value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(4));
    return {
      mean: round(first.mean),
      min: round(first.min),
      max: round(first.max),
      validFraction:
        first.valid_percent !== undefined ? first.valid_percent / 100 : null,
      validPixels: first.valid_pixels ?? null,
    };
  } catch {
    return null;
  }
}
