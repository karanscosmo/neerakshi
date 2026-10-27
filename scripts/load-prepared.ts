/**
 * Load data/prepared/*.csv into Postgres (Neon, or local PGlite when DATABASE_URL is empty).
 *
 *   npm run db:load
 *
 * Each table is replaced in full. Rows are validated with Zod; invalid rows
 * are counted and reported, never silently coerced.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { createDb } from "@/lib/server/dbcore";
import * as s from "@/db/schema";
import { parseCsv } from "@/lib/shared/csv";
import { SOURCES } from "@/lib/shared/sources";

const PREP = path.join(process.cwd(), "data", "prepared");
const MANIFEST = path.join(process.cwd(), "data", "raw", "manifest.csv");

const num = z
  .string()
  .transform((v) => (v === "" || v.toLowerCase() === "nan" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "not a number");
const int = num.refine((v) => v === null || Number.isInteger(v), "not an integer");
const reqInt = z.string().regex(/^-?\d+$/).transform(Number);
const str = z.string().min(1);
const optStr = z.string().transform((v) => (v === "" ? null : v));

function read(file: string): Record<string, string>[] {
  const p = path.join(PREP, file);
  if (!fs.existsSync(p)) return [];
  return parseCsv(fs.readFileSync(p, "utf8"));
}

type Spec<T extends z.ZodTypeAny> = { file: string; table: PgTable; schema: T };

async function main() {
  const db = await createDb({ migrate: true });
  console.log(process.env.DATABASE_URL ? "→ Neon (DATABASE_URL)" : "→ local PGlite (~/.cache/neerakshi/pglite)");

  const specs: Spec<z.ZodTypeAny>[] = [
    {
      file: "districts.csv",
      table: s.districts,
      schema: z
        .object({ district_id: str, district_name: str, state_code: str, state_name: str, census_code: int, lat: num, lon: num, area_km2: num, imd_subdivision: optStr })
        .transform((r) => ({ id: r.district_id, name: r.district_name, stateCode: r.state_code, stateName: r.state_name, censusCode: r.census_code, lat: r.lat!, lon: r.lon!, areaKm2: r.area_km2, imdSubdivision: r.imd_subdivision })),
    },
    {
      file: "crop_production.csv",
      table: s.cropProduction,
      schema: z
        .object({ year: reqInt, district_id: str, season: str, crop: str, area_ha: num, production_t: num, yield_t_per_ha: num })
        .transform((r) => ({ year: r.year, districtId: r.district_id, season: r.season, crop: r.crop, areaHa: r.area_ha, productionT: r.production_t, yieldTPerHa: r.yield_t_per_ha })),
    },
    {
      file: "irrigation_district.csv",
      table: s.irrigationDistrict,
      schema: z
        .object({ year: reqInt, district_id: str, crop: str, irrigated_area_ha: num, gross_cropped_area_ha: num, irrigated_share_pct: num })
        .transform((r) => ({ year: r.year, districtId: r.district_id, crop: r.crop, irrigatedAreaHa: r.irrigated_area_ha, grossCroppedAreaHa: r.gross_cropped_area_ha, irrigatedSharePct: r.irrigated_share_pct })),
    },
    {
      file: "rainfall_district_season.csv",
      table: s.rainfallDistrictSeason,
      schema: z
        .object({ year: reqInt, district_id: str, season: str, rain_mm: num, normal_rain_mm: num, departure_pct: num, spatial_basis: str, normal_period: optStr })
        .transform((r) => ({ year: r.year, districtId: r.district_id, season: r.season, rainMm: r.rain_mm, normalRainMm: r.normal_rain_mm, departurePct: r.departure_pct, spatialBasis: r.spatial_basis, normalPeriod: r.normal_period })),
    },
    {
      file: "rainfall_subdivision_monthly.csv",
      table: s.rainfallSubdivisionMonthly,
      schema: z
        .object({ subdivision: str, year: reqInt, month: reqInt, rain_mm: num, normal_rain_mm: num, departure_pct: num })
        .transform((r) => ({ subdivision: r.subdivision, year: r.year, month: r.month, rainMm: r.rain_mm, normalRainMm: r.normal_rain_mm, departurePct: r.departure_pct })),
    },
    {
      file: "monsoon_series.csv",
      table: s.monsoonSeries,
      schema: z
        .object({ region_type: str, region_id: str, region_name: str, year: reqInt, jjas_mm: num, normal_mm: num, departure_pct: num, source: str })
        .transform((r) => ({ regionType: r.region_type, regionId: r.region_id, regionName: r.region_name, year: r.year, jjasMm: r.jjas_mm, normalMm: r.normal_mm, departurePct: r.departure_pct, source: r.source })),
    },
    {
      file: "groundwater_district.csv",
      table: s.groundwaterDistrict,
      schema: z
        .object({ year: reqInt, season: str, district_id: str, median_depth_mbgl: num, well_count: reqInt, change_vs_baseline_m: num })
        .transform((r) => ({ year: r.year, season: r.season, districtId: r.district_id, medianDepthMbgl: r.median_depth_mbgl, wellCount: r.well_count, changeVsBaselineM: r.change_vs_baseline_m })),
    },
    {
      file: "water_stress_index.csv",
      table: s.waterStressIndex,
      schema: z
        .object({
          district_id: str, rain_period: optStr, rain_basis: optStr, rain_departure_5y_pct: num, rain_score: num, gw_year: int, gw_depth_mbgl: num, gw_score: num,
          irrigation_year: int, irrigated_share_pct: num, irrigation_score: num, components_used: reqInt, stress_index_0_100: num, rank_national: int, rank_state: int,
        })
        .transform((r) => ({
          districtId: r.district_id, rainPeriod: r.rain_period, rainBasis: r.rain_basis, rainDeparture5yPct: r.rain_departure_5y_pct, rainScore: r.rain_score,
          gwYear: r.gw_year, gwDepthMbgl: r.gw_depth_mbgl, gwScore: r.gw_score, irrigationYear: r.irrigation_year, irrigatedSharePct: r.irrigated_share_pct,
          irrigationScore: r.irrigation_score, componentsUsed: r.components_used, stressIndex0100: r.stress_index_0_100, rankNational: r.rank_national, rankState: r.rank_state,
        })),
    },
    {
      file: "ndvi_district_monthly.csv",
      table: s.ndviDistrictMonthly,
      schema: z
        .object({ month: z.string().regex(/^\d{4}-\d{2}-01$/), district_id: str, ndvi_median: num, valid_pixel_pct: num })
        .transform((r) => ({ month: r.month, districtId: r.district_id, ndviMedian: r.ndvi_median, validPixelPct: r.valid_pixel_pct })),
    },
  ];

  const counts: Record<string, number> = {};
  for (const spec of specs) {
    const raw = read(spec.file);
    const ok: unknown[] = [];
    let bad = 0;
    for (const r of raw) {
      const p = spec.schema.safeParse(r);
      if (p.success) ok.push(p.data);
      else if (bad++ < 3) console.warn(`  invalid row in ${spec.file}:`, p.error.issues[0]?.message, r);
    }
    await db.delete(spec.table);
    const CHUNK = 2000;
    for (let i = 0; i < ok.length; i += CHUNK) {
      await db.insert(spec.table).values(ok.slice(i, i + CHUNK) as never);
    }
    counts[spec.file] = ok.length;
    console.log(`✓ ${spec.file.padEnd(36)} ${String(ok.length).padStart(8)} rows${bad ? `  (${bad} invalid skipped)` : ""}`);
  }

  // Data freshness registry
  const manifest = fs.existsSync(MANIFEST) ? parseCsv(fs.readFileSync(MANIFEST, "utf8")) : [];
  const retrieved = (prefix: string) =>
    manifest
      .filter((m) => m.id.startsWith(prefix) && m.retrieved_utc)
      .map((m) => new Date(m.retrieved_utc))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const rowsFor: Record<string, number> = {
    D1_apy: counts["crop_production.csv"] ?? 0,
    D2_icrisat: counts["irrigation_district.csv"] ?? 0,
    D3_subdiv: counts["rainfall_subdivision_monthly.csv"] ?? 0,
    D3_state_jjas: 0,
    D3_grid: 0,
    D4_cgwb: counts["groundwater_district.csv"] ?? 0,
    D6_ndvi: counts["ndvi_district_monthly.csv"] ?? 0,
    D10_boundaries: counts["districts.csv"] ?? 0,
  };
  rowsFor.D3_state_jjas = (await db.select({ n: sql<number>`count(*)::int` }).from(s.monsoonSeries).where(sql`region_type = 'state'`))[0]?.n ?? 0;
  const spatial = await db.select({ n: sql<number>`count(*)::int` }).from(s.rainfallDistrictSeason).where(sql`spatial_basis = 'imd_grid_district'`);
  rowsFor.D3_grid = spatial[0]?.n ?? 0;
  const runtime = new Set(["D5_cdse", "D7_openmeteo", "D8_fao56"]);
  await db.delete(s.dataSources);
  for (const src of SOURCES) {
    const rows = rowsFor[src.id] ?? 0;
    const status = runtime.has(src.id) ? "runtime" : rows > 0 ? "loaded" : "missing";
    const prefix = src.id === "D10_boundaries" ? "D10" : src.id.split("_")[0] === "D3" ? src.id : src.id.split("_")[0];
    await db.insert(s.dataSources).values({
      id: src.id,
      title: src.title,
      publisher: src.publisher,
      licence: src.licence,
      url: src.url,
      rows,
      status,
      note: src.limitations,
      refreshedAt: status === "loaded" ? (retrieved(prefix) ?? new Date()) : null,
    });
  }
  console.log("✓ data_sources registry");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
