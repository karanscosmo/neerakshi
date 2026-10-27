import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "@/db/schema";
import { getDistrict, unitFor } from "./atlas";

/* ─── Monsoon ─────────────────────────────────────────────────────────── */
export async function monsoonData(districtId: string) {
  const db = await getDb();
  const d = await getDistrict(districtId);
  const ms = s.monsoonSeries;
  const pick = (type: string, id: string) =>
    db.select({ year: ms.year, jjas: ms.jjasMm, normal: ms.normalMm, dep: ms.departurePct }).from(ms).where(and(eq(ms.regionType, type), eq(ms.regionId, id))).orderBy(asc(ms.year));
  const [india, indiaGrid, state, subdiv] = await Promise.all([
    pick("india", "IN"),
    pick("india_grid", "IN"),
    d ? pick("state", unitFor(d.stateCode)) : Promise.resolve([]),
    d?.imdSubdivision ? pick("subdivision", d.imdSubdivision) : Promise.resolve([]),
  ]);
  const monthly = d?.imdSubdivision
    ? await db
        .select({ year: s.rainfallSubdivisionMonthly.year, month: s.rainfallSubdivisionMonthly.month, rain: s.rainfallSubdivisionMonthly.rainMm, dep: s.rainfallSubdivisionMonthly.departurePct })
        .from(s.rainfallSubdivisionMonthly)
        .where(eq(s.rainfallSubdivisionMonthly.subdivision, d.imdSubdivision))
        .orderBy(asc(s.rainfallSubdivisionMonthly.year), asc(s.rainfallSubdivisionMonthly.month))
    : [];
  return {
    district: d ? { id: d.id, name: d.name, state: d.stateName, stateCode: d.stateCode, subdivision: d.imdSubdivision, lat: d.lat, lon: d.lon } : null,
    india,
    indiaGrid,
    state,
    subdiv,
    monthly,
  };
}

/* ─── Groundwater ─────────────────────────────────────────────────────── */
export async function groundwaterData(ids: string[]) {
  const db = await getDb();
  const g = s.groundwaterDistrict;
  const rows = ids.length
    ? await db
        .select({ id: g.districtId, year: g.year, season: g.season, depth: g.medianDepthMbgl, change: g.changeVsBaselineM, wells: g.wellCount, name: s.districts.name, state: s.districts.stateName })
        .from(g)
        .innerJoin(s.districts, eq(s.districts.id, g.districtId))
        .where(inArray(g.districtId, ids))
        .orderBy(asc(g.year))
    : [];
  const latest = (await db.select({ y: sql<number>`max(${g.year})` }).from(g).where(eq(g.season, "pre_monsoon")))[0]?.y ?? null;
  const decline = latest
    ? await db
        .select({ id: g.districtId, name: s.districts.name, state: s.districts.stateName, change: g.changeVsBaselineM, wells: sql<number>`${g.wellCount}` })
        .from(g)
        .innerJoin(s.districts, eq(s.districts.id, g.districtId))
        .where(and(eq(g.season, "pre_monsoon"), eq(g.year, latest), sql`${g.changeVsBaselineM} is not null`, sql`${g.wellCount} >= 5`))
        .orderBy(desc(g.changeVsBaselineM))
        .limit(15)
    : [];
  return { rows, latest, decline };
}

/** Neighbouring districts in the same state with the most well readings (for the side-by-side wells). */
export async function groundwaterPeers(id: string, n = 3) {
  const db = await getDb();
  const d = await getDistrict(id);
  if (!d) return [];
  const g = s.groundwaterDistrict;
  const rows = await db
    .select({ id: g.districtId, wells: sql<number>`max(${g.wellCount})` })
    .from(g)
    .innerJoin(s.districts, eq(s.districts.id, g.districtId))
    .where(and(eq(s.districts.stateCode, d.stateCode), sql`${g.districtId} <> ${id}`))
    .groupBy(g.districtId)
    .orderBy(desc(sql`max(${g.wellCount})`))
    .limit(n);
  return rows.map((r) => r.id);
}

/* ─── Crops ───────────────────────────────────────────────────────────── */
export type Scope = "india" | "state" | "district";

export async function cropsData(crop: string, scope: Scope, districtId: string, y0: number, y1: number) {
  const db = await getDb();
  const d = await getDistrict(districtId);
  const c = s.cropProduction;
  const where = [eq(c.crop, crop)];
  if (scope === "district") where.push(eq(c.districtId, districtId));
  const base = db
    .select({
      year: c.year,
      area: sql<number>`sum(${c.areaHa})`,
      prodKnownArea: sql<number>`sum(case when ${c.productionT} is not null then ${c.areaHa} end)`,
      prodKnown: sql<number>`sum(${c.productionT})`,
    })
    .from(c);
  const trend =
    scope === "state" && d
      ? await base.innerJoin(s.districts, eq(s.districts.id, c.districtId)).where(and(...where, eq(s.districts.stateCode, d.stateCode))).groupBy(c.year).orderBy(asc(c.year))
      : await base.where(and(...where)).groupBy(c.year).orderBy(asc(c.year));
  // Production sums the rows that report it (unknown is never counted as zero); coverage = share of
  // area with reported production. Yield = that production / that area (documented in the data README).
  const series = trend.map((r) => ({
    year: r.year,
    areaHa: r.area,
    productionT: r.prodKnownArea ? r.prodKnown : null,
    productionCoveragePct: r.area ? Math.round((1000 * (r.prodKnownArea ?? 0)) / r.area) / 10 : null,
    yieldTPerHa: r.prodKnownArea ? Math.round((r.prodKnown / r.prodKnownArea) * 1000) / 1000 : null,
  }));

  // Scatter: district-year yield vs JJAS departure for the chosen district's state
  const scatter = d
    ? await db.execute(sql`
        select cp.district_id as id, ds.name as name, cp.year as year,
               sum(cp.production_t) / nullif(sum(cp.area_ha), 0) as yield,
               max(r.departure_pct) as dep, max(r.spatial_basis) as basis,
               max(irr.irrigated_share_pct) as irr
        from crop_production cp
        join districts ds on ds.id = cp.district_id
        join rainfall_district_season r on r.district_id = cp.district_id and r.year = cp.year and r.season = 'jjas'
        left join irrigation_district irr on irr.district_id = cp.district_id and irr.year = cp.year and irr.crop = ${crop}
        where cp.crop = ${crop} and ds.state_code = ${d.stateCode} and cp.year between ${y0} and ${y1} and cp.production_t is not null and cp.area_ha > 0
        group by cp.district_id, ds.name, cp.year
      `)
    : { rows: [] };

  // Top districts by average yield (national, ≥ 5 years reported in range)
  const top = await db.execute(sql`
    with y as (
      select district_id, year, sum(production_t) / nullif(sum(area_ha), 0) as yield
      from crop_production where crop = ${crop} and year between ${y0} and ${y1} and production_t is not null and area_ha > 0
      group by district_id, year)
    select y.district_id as id, d.name, d.state_name as state, avg(y.yield) as yield, count(*) as n
    from y join districts d on d.id = y.district_id
    group by y.district_id, d.name, d.state_name having count(*) >= 5
    order by avg(y.yield) desc limit 12`);
  const lastYear = (await db.select({ y: sql<number>`max(${c.year})` }).from(c).where(and(eq(c.crop, crop), sql`${c.productionT} is not null`)))[0]?.y ?? y1;
  const states = await db
    .select({ state: s.districts.stateName, prod: sql<number>`sum(${c.productionT})` })
    .from(c)
    .innerJoin(s.districts, eq(s.districts.id, c.districtId))
    .where(and(eq(c.crop, crop), eq(c.year, lastYear), sql`${c.productionT} is not null`))
    .groupBy(s.districts.stateName)
    .orderBy(desc(sql`sum(${c.productionT})`))
    .limit(12);
  const rowsOf = (x: unknown) => ((x as { rows?: unknown[] }).rows ?? (x as unknown[])) as Record<string, unknown>[];
  return {
    district: d ? { id: d.id, name: d.name, state: d.stateName } : null,
    series,
    scatter: rowsOf(scatter).map((r) => ({ id: String(r.id), name: String(r.name), year: Number(r.year), yield: Number(r.yield), dep: r.dep === null ? null : Number(r.dep), basis: String(r.basis), irr: r.irr === null ? null : Number(r.irr) })),
    top: rowsOf(top).map((r) => ({ id: String(r.id), name: String(r.name), state: String(r.state), yield: Number(r.yield), n: Number(r.n) })),
    states: { year: lastYear, rows: states },
  };
}

export async function yearRange() {
  const db = await getDb();
  const r = await db.select({ a: sql<number>`min(${s.cropProduction.year})`, b: sql<number>`max(${s.cropProduction.year})` }).from(s.cropProduction);
  return { min: r[0]?.a ?? 1997, max: r[0]?.b ?? 2022 };
}
