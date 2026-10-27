import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { advisories, fields, irrigationEvents, type Field } from "@/db/schema";
import { getWeather, todayIST } from "./openmeteo";
import { cdseConfigured, getFieldSatellite, type SatelliteObs } from "./cdse";
import { computeAdvisory, type Advisory } from "@/lib/agro/advisory";
import { satelliteAdjustment, type SatelliteAdjustment } from "@/lib/agro/satellite";
import { addDays, daysBetween } from "@/lib/agro/waterBalance";
import { CROP_PARAMS, METHOD_EFFICIENCY, SOIL_PARAMS, type Crop, type Method, type Soil } from "@/lib/agro/reference";

export type SatelliteResult =
  | { status: "ok"; series: SatelliteObs[]; fetchedAt: string; cached: boolean }
  | { status: "not_configured" }
  | { status: "error"; message: string };

export type AdvisoryBundle = {
  advisory: Advisory;
  satellite: SatelliteResult;
  adjustment: SatelliteAdjustment | null;
  soilMoisture: { date: string; value: number | null }[];
  weatherFetchedAt: string | null;
  weatherError: string | null;
  advisoryId: number | null;
};

/** Satellite series for the season so far (max 120 days back). Never throws. */
export async function fieldSatellite(field: Field, today = todayIST()): Promise<SatelliteResult> {
  if (!cdseConfigured()) return { status: "not_configured" };
  const from = [field.sowingDate, addDays(today, -120)].sort().at(-1)!;
  try {
    const { value, fetchedAt, cached } = await getFieldSatellite(field.id, field.geometry as GeoJSON.Polygon, addDays(from, -10), today);
    return { status: "ok", series: value, fetchedAt: fetchedAt.toISOString(), cached };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Fetch weather + satellite, run FAO-56 and store the advisory. */
export async function runFieldAdvisory(field: Field, trigger: "user" | "cron" | "telegram" = "user"): Promise<AdvisoryBundle> {
  const db = await getDb();
  const today = todayIST();
  const crop = CROP_PARAMS[field.crop as Crop];
  const soil = SOIL_PARAMS[field.soil as Soil];
  const efficiency = METHOD_EFFICIENCY[field.method as Method];

  const events = await db.select().from(irrigationEvents).where(eq(irrigationEvents.fieldId, field.id)).orderBy(desc(irrigationEvents.date));
  const lastRecorded = events[0]?.date ?? null;
  const lastKnown = [lastRecorded, field.lastIrrigationDate].filter(Boolean).sort().at(-1) ?? null;
  // Start at field capacity on the last irrigation; else max(sowing, today − 30); never before today − 92.
  const floor = addDays(today, -92);
  let start = lastKnown && lastKnown <= today ? lastKnown : [field.sowingDate, addDays(today, -30)].sort().at(-1)!;
  if (start < floor) start = floor;
  if (start < field.sowingDate) start = field.sowingDate;
  const startAssumedFc = !lastKnown || lastKnown < floor;

  const satellite = await fieldSatellite(field, today);
  let adjustment: SatelliteAdjustment | null = null;
  if (satellite.status === "ok") adjustment = satelliteAdjustment(crop, field.sowingDate, today, satellite.series);

  let weatherDays: Awaited<ReturnType<typeof getWeather>> | null = null;
  let weatherError: string | null = null;
  try {
    weatherDays = await getWeather(field.lat, field.lon, Math.max(1, daysBetween(start, today) + 1));
  } catch (e) {
    weatherError = e instanceof Error ? e.message : String(e);
  }

  const advisory: Advisory = weatherDays
    ? computeAdvisory({
        crop,
        soil,
        sowingDate: field.sowingDate,
        startDate: start,
        weather: weatherDays.days,
        irrigations: events.map((e) => ({ date: e.date, depthMm: e.depthMm })),
        kcFactor: adjustment?.applied ? adjustment.factor : 1,
        today,
        areaHa: field.areaHa,
        efficiency,
        startAssumedFc,
      })
    : {
        type: "unavailable",
        reason: "weather",
        date: today,
        efficiency,
        areaHa: field.areaHa,
        startAssumedFc,
        startDate: start,
        history: [],
        forecast: [],
      };

  const t = advisory.today;
  const payload = {
    ...advisory,
    satellite: satellite.status === "ok" ? { latest: adjustment?.latest ?? null, factor: adjustment?.factor ?? 1, applied: adjustment?.applied ?? false, mismatch: adjustment?.mismatch ?? null } : { status: satellite.status },
  };
  const [row] = await db
    .insert(advisories)
    .values({
      fieldId: field.id,
      date: today,
      districtId: field.districtId,
      crop: field.crop,
      adviceType: advisory.type,
      etcMm: t?.etcAdj ?? null,
      rainForecastMm: advisory.rainNext3dMm ?? null,
      deficitMm: t?.dr ?? null,
      rawMm: t?.raw ?? null,
      tawMm: t?.taw ?? null,
      netDepthMm: advisory.netDepthMm ?? null,
      grossLitres: advisory.grossLitres ?? null,
      payload,
      trigger,
    })
    .returning({ id: advisories.id });

  return {
    advisory,
    satellite,
    adjustment,
    soilMoisture: weatherDays?.soilMoisture.filter((s) => s.date <= today).slice(-14) ?? [],
    weatherFetchedAt: weatherDays?.fetchedAt ?? null,
    weatherError,
    advisoryId: row?.id ?? null,
  };
}

export async function latestAdvisory(fieldId: string) {
  const db = await getDb();
  const rows = await db.select().from(advisories).where(eq(advisories.fieldId, fieldId)).orderBy(desc(advisories.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function getOwnedField(id: string, ownerId: string | null): Promise<Field | null> {
  if (!ownerId) return null;
  const db = await getDb();
  const rows = await db.select().from(fields).where(and(eq(fields.id, id), eq(fields.ownerId, ownerId))).limit(1);
  return rows[0] ?? null;
}

export async function getFieldById(id: string): Promise<Field | null> {
  const db = await getDb();
  const rows = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  return rows[0] ?? null;
}
