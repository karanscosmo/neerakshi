import "server-only";
import { z } from "zod";
import { cached, fetchJson } from "./cache";
import type { DayWeather } from "@/lib/agro/waterBalance";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const TZ = "Asia/Kolkata";

const nums = z.array(z.number().nullable());
const ForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  daily: z.object({
    time: z.array(z.string()),
    et0_fao_evapotranspiration: nums,
    precipitation_sum: nums,
    temperature_2m_max: nums,
    temperature_2m_min: nums,
  }),
  hourly: z
    .object({ time: z.array(z.string()), soil_moisture_9_to_27cm: nums })
    .optional(),
});

export type WeatherBundle = {
  lat: number;
  lon: number;
  days: (DayWeather & { tmax: number | null; tmin: number | null })[];
  /** Daily mean volumetric soil moisture 9–27 cm (m³/m³), model output — a supporting indicator only. */
  soilMoisture: { date: string; value: number | null }[];
  fetchedAt: string;
  cached: boolean;
};

const r = (x: number) => Math.round(x * 100) / 100;

/** Past `pastDays` (≤ 92) + 8 forecast days of daily ET0, rain and temperature for a point. */
export async function getWeather(lat: number, lon: number, pastDays: number): Promise<WeatherBundle> {
  const pd = Math.max(1, Math.min(92, Math.ceil(pastDays)));
  const key = `om:fc:${r(lat)}:${r(lon)}:${pd}`;
  const url =
    `${FORECAST}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min` +
    `&hourly=soil_moisture_9_to_27cm&past_days=${pd}&forecast_days=8&timezone=${encodeURIComponent(TZ)}`;
  const { value, cached: hit, fetchedAt } = await cached(key, "open-meteo", 3 * 3600_000, async () =>
    ForecastSchema.parse(await fetchJson(url, { provider: "Open-Meteo", timeoutMs: 15_000 })),
  );
  const d = value.daily;
  const days = d.time.map((date, i) => ({
    date,
    et0: d.et0_fao_evapotranspiration[i] ?? null,
    precip: d.precipitation_sum[i] ?? null,
    tmax: d.temperature_2m_max[i] ?? null,
    tmin: d.temperature_2m_min[i] ?? null,
  }));
  const sm = new Map<string, number[]>();
  if (value.hourly) {
    value.hourly.time.forEach((t, i) => {
      const v = value.hourly!.soil_moisture_9_to_27cm[i];
      if (v === null || v === undefined) return;
      const k = t.slice(0, 10);
      sm.set(k, [...(sm.get(k) ?? []), v]);
    });
  }
  const soilMoisture = d.time.map((date) => {
    const v = sm.get(date);
    return { date, value: v && v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000 : null };
  });
  return { lat: value.latitude, lon: value.longitude, days, soilMoisture, fetchedAt: fetchedAt.toISOString(), cached: hit };
}

/** Today's reference ET0 (mm) at a point, India time. */
export async function getEt0Today(lat: number, lon: number): Promise<{ date: string; et0: number | null; fetchedAt: string }> {
  const w = await getWeather(lat, lon, 1);
  const today = todayIST();
  const d = w.days.find((x) => x.date === today);
  return { date: today, et0: d?.et0 ?? null, fetchedAt: w.fetchedAt };
}

const ArchiveSchema = z.object({ daily: z.object({ time: z.array(z.string()), precipitation_sum: nums }) });

/**
 * Season-to-date rainfall (from 1 June) this year vs the 1991–2020 mean for the
 * same calendar dates, both from Open-Meteo (ERA5 archive + recent forecast-model days).
 */
export async function getSeasonVsNormal(lat: number, lon: number) {
  const today = todayIST();
  const year = Number(today.slice(0, 4));
  const inSeason = today.slice(5) >= "06-01" && today.slice(5) <= "09-30";
  const seasonYear = inSeason || today.slice(5) > "09-30" ? year : year - 1;
  // ERA5 (archive) lags real time by ~5 days
  const lag = new Date(Date.parse(today) - 6 * 86_400_000).toISOString().slice(0, 10);
  const end = inSeason ? lag : `${seasonYear}-09-30`;
  const start = `${seasonYear}-06-01`;
  const key = `om:arch:${r(lat)}:${r(lon)}:1991-2020`;
  const { value: hist } = await cached(key, "open-meteo-archive", 30 * 86_400_000, async () =>
    ArchiveSchema.parse(
      await fetchJson(`${ARCHIVE}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=1991-01-01&end_date=2020-12-31&daily=precipitation_sum&timezone=${encodeURIComponent(TZ)}`, {
        provider: "Open-Meteo archive",
        timeoutMs: 25_000,
      }),
    ),
  );
  // Mean cumulative rain by day-of-season over 1991–2020
  const byMd = new Map<string, number[]>();
  hist.daily.time.forEach((t, i) => {
    const md = t.slice(5);
    if (md < "06-01" || md > "09-30") return;
    const v = hist.daily.precipitation_sum[i];
    if (v === null) return;
    byMd.set(md, [...(byMd.get(md) ?? []), v]);
  });
  const mds = [...byMd.keys()].sort();
  let cum = 0;
  const normal = mds.map((md) => {
    const v = byMd.get(md)!;
    cum += v.reduce((a, b) => a + b, 0) / v.length;
    return { md, cum: Math.round(cum * 10) / 10 };
  });
  // This season, from the same archive (so actual and normal share one source)
  const { value: cur } = await cached(`om:arch:${r(lat)}:${r(lon)}:${start}:${end}`, "open-meteo-archive", 6 * 3600_000, async () =>
    ArchiveSchema.parse(
      await fetchJson(`${ARCHIVE}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${start}&end_date=${end}&daily=precipitation_sum&timezone=${encodeURIComponent(TZ)}`, {
        provider: "Open-Meteo archive",
        timeoutMs: 15_000,
      }),
    ),
  );
  let c2 = 0;
  const actual = cur.daily.time.map((t, i) => {
    const v = cur.daily.precipitation_sum[i];
    if (v !== null) c2 += v;
    return { md: t.slice(5), cum: v === null ? null : Math.round(c2 * 10) / 10 };
  });
  return { seasonYear, inSeason, start, end, normal, actual };
}

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
