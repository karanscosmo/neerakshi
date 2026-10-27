import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "@/db/schema";

/** All reads here serve prepared, pre-aggregated tables. Nothing is computed that the pipeline does not define. */

export async function listDistricts() {
  const db = await getDb();
  return db
    .select({ id: s.districts.id, name: s.districts.name, state: s.districts.stateName, stateCode: s.districts.stateCode, lat: s.districts.lat, lon: s.districts.lon })
    .from(s.districts)
    .orderBy(asc(s.districts.stateName), asc(s.districts.name));
}

export async function getDistrict(id: string) {
  const db = await getDb();
  return (await db.select().from(s.districts).where(eq(s.districts.id, id)).limit(1))[0] ?? null;
}

export const STATE_UNIT: Record<string, string> = { AP: "AP_TG", DN: "DNH_DD", DD: "DNH_DD" };
export const unitFor = (stateCode: string) => STATE_UNIT[stateCode] ?? stateCode;

/** Compact district summary for live numbers (journey, dial, atlas bottom sheet). */
export async function districtSummary(id: string) {
  const db = await getDb();
  const d = await getDistrict(id);
  if (!d) return null;
  const [stress] = await db.select().from(s.waterStressIndex).where(eq(s.waterStressIndex.districtId, id));
  const total = (await db.select({ n: sql<number>`count(*)::int` }).from(s.waterStressIndex).where(sql`stress_index_0_100 is not null`))[0]?.n ?? 0;
  const stateTotal =
    (await db.select({ n: sql<number>`count(*)::int` }).from(s.waterStressIndex).innerJoin(s.districts, eq(s.districts.id, s.waterStressIndex.districtId)).where(and(eq(s.districts.stateCode, d.stateCode), sql`stress_index_0_100 is not null`)))[0]?.n ?? 0;
  const unit = unitFor(d.stateCode);
  const monsoon = await db
    .select({ year: s.monsoonSeries.year, departurePct: s.monsoonSeries.departurePct, jjasMm: s.monsoonSeries.jjasMm, normalMm: s.monsoonSeries.normalMm })
    .from(s.monsoonSeries)
    .where(and(eq(s.monsoonSeries.regionType, "state"), eq(s.monsoonSeries.regionId, unit)))
    .orderBy(asc(s.monsoonSeries.year));
  const gw = await db
    .select()
    .from(s.groundwaterDistrict)
    .where(and(eq(s.groundwaterDistrict.districtId, id), eq(s.groundwaterDistrict.season, "pre_monsoon")))
    .orderBy(desc(s.groundwaterDistrict.year))
    .limit(1);
  const ndvi = await db.select().from(s.ndviDistrictMonthly).where(eq(s.ndviDistrictMonthly.districtId, id)).orderBy(desc(s.ndviDistrictMonthly.month)).limit(13);
  const validMonsoon = monsoon.filter((m) => m.departurePct !== null);
  return {
    district: { id: d.id, name: d.name, state: d.stateName, stateCode: d.stateCode, lat: d.lat, lon: d.lon, subdivision: d.imdSubdivision },
    stress: stress ? { ...stress, total, stateTotal } : null,
    monsoon: {
      unit,
      latest: validMonsoon.at(-1) ?? null,
      last30: validMonsoon.slice(-30),
      normalPeriod: "1981–2010",
      source: "IMD 0.25° gridded rainfall, area-weighted to the state",
    },
    groundwater: gw[0] ?? null,
    ndvi: ndvi.find((n) => n.ndviMedian !== null) ?? null,
  };
}

export type DistrictSummary = NonNullable<Awaited<ReturnType<typeof districtSummary>>>;

export type LayerKey = "stress" | "monsoon" | "groundwater" | "irrigation" | "ndvi";

/** Choropleth values for a layer (and year where the layer has time depth). */
export async function layerValues(layer: LayerKey, year?: number) {
  const db = await getDb();
  switch (layer) {
    case "stress": {
      const rows = await db.select().from(s.waterStressIndex);
      return { years: [] as number[], year: null, values: rows.map((r) => ({ id: r.districtId, v: r.stressIndex0100, basis: r.rainBasis })) };
    }
    case "monsoon": {
      const yrs = await db.selectDistinct({ y: s.rainfallDistrictSeason.year }).from(s.rainfallDistrictSeason).where(eq(s.rainfallDistrictSeason.season, "jjas")).orderBy(asc(s.rainfallDistrictSeason.year));
      const years = yrs.map((r) => r.y);
      const y = year && years.includes(year) ? year : years.at(-1)!;
      const rows = await db
        .select({ id: s.rainfallDistrictSeason.districtId, v: s.rainfallDistrictSeason.departurePct, basis: s.rainfallDistrictSeason.spatialBasis })
        .from(s.rainfallDistrictSeason)
        .where(and(eq(s.rainfallDistrictSeason.season, "jjas"), eq(s.rainfallDistrictSeason.year, y)));
      return { years, year: y, values: rows };
    }
    case "groundwater": {
      const yrs = await db.selectDistinct({ y: s.groundwaterDistrict.year }).from(s.groundwaterDistrict).where(eq(s.groundwaterDistrict.season, "pre_monsoon")).orderBy(asc(s.groundwaterDistrict.year));
      const years = yrs.map((r) => r.y);
      const y = year && years.includes(year) ? year : years.at(-1)!;
      const rows = await db
        .select({ id: s.groundwaterDistrict.districtId, v: s.groundwaterDistrict.medianDepthMbgl, n: s.groundwaterDistrict.wellCount })
        .from(s.groundwaterDistrict)
        .where(and(eq(s.groundwaterDistrict.season, "pre_monsoon"), eq(s.groundwaterDistrict.year, y)));
      return { years, year: y, values: rows.map((r) => ({ id: r.id, v: r.v, basis: `${r.n} wells` })) };
    }
    case "irrigation": {
      const yrs = await db.selectDistinct({ y: s.irrigationDistrict.year }).from(s.irrigationDistrict).where(eq(s.irrigationDistrict.crop, "all")).orderBy(asc(s.irrigationDistrict.year));
      const years = yrs.map((r) => r.y);
      if (!years.length) return { years, year: null, values: [] };
      const y = year && years.includes(year) ? year : years.at(-1)!;
      const rows = await db
        .select({ id: s.irrigationDistrict.districtId, v: s.irrigationDistrict.irrigatedSharePct })
        .from(s.irrigationDistrict)
        .where(and(eq(s.irrigationDistrict.crop, "all"), eq(s.irrigationDistrict.year, y)));
      return { years, year: y, values: rows.map((r) => ({ ...r, basis: null })) };
    }
    case "ndvi": {
      // Anomaly = latest month's NDVI minus the mean of the same calendar month in other years (when ≥ 2 years exist).
      const rows = await db.select().from(s.ndviDistrictMonthly);
      if (!rows.length) return { years: [], year: null, values: [] };
      const latest = rows.map((r) => r.month).sort().at(-1)!;
      const mm = latest.slice(5, 7);
      const byD = new Map<string, { cur: number | null; others: number[] }>();
      for (const r of rows) {
        if (r.month.slice(5, 7) !== mm) continue;
        const e = byD.get(r.districtId) ?? { cur: null, others: [] };
        if (r.month === latest) e.cur = r.ndviMedian;
        else if (r.ndviMedian !== null) e.others.push(r.ndviMedian);
        byD.set(r.districtId, e);
      }
      const values = [...byD].map(([id, e]) => ({
        id,
        v: e.cur !== null && e.others.length >= 2 ? Math.round((e.cur - e.others.reduce((a, b) => a + b, 0) / e.others.length) * 1000) / 1000 : null,
        basis: latest,
      }));
      return { years: [], year: null, values };
    }
  }
}

/** Mini trends for the district sheet. */
export async function districtTrends(id: string) {
  const db = await getDb();
  const d = await getDistrict(id);
  if (!d) return null;
  const rain = await db
    .select({ year: s.rainfallDistrictSeason.year, v: s.rainfallDistrictSeason.departurePct, basis: s.rainfallDistrictSeason.spatialBasis })
    .from(s.rainfallDistrictSeason)
    .where(and(eq(s.rainfallDistrictSeason.districtId, id), eq(s.rainfallDistrictSeason.season, "jjas"), sql`year >= 1986`))
    .orderBy(asc(s.rainfallDistrictSeason.year));
  const gw = await db
    .select({ year: s.groundwaterDistrict.year, season: s.groundwaterDistrict.season, v: s.groundwaterDistrict.medianDepthMbgl, change: s.groundwaterDistrict.changeVsBaselineM, n: s.groundwaterDistrict.wellCount })
    .from(s.groundwaterDistrict)
    .where(eq(s.groundwaterDistrict.districtId, id))
    .orderBy(asc(s.groundwaterDistrict.year));
  const crops = await db
    .select({ year: s.cropProduction.year, crop: s.cropProduction.crop, area: sql<number>`sum(${s.cropProduction.areaHa})`, prod: sql<number | null>`case when count(${s.cropProduction.productionT}) = count(*) then sum(${s.cropProduction.productionT}) end` })
    .from(s.cropProduction)
    .where(eq(s.cropProduction.districtId, id))
    .groupBy(s.cropProduction.year, s.cropProduction.crop)
    .orderBy(asc(s.cropProduction.year));
  return { rain, gw, crops };
}
