import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "@/db/schema";

/** One live headline number per dial station, all read from prepared tables or the advisory DB. */
export async function headlines(ownerId: string | null) {
  const db = await getDb();
  const stress = await db
    .select({ name: s.districts.name, state: s.districts.stateName, v: s.waterStressIndex.stressIndex0100 })
    .from(s.waterStressIndex)
    .innerJoin(s.districts, eq(s.districts.id, s.waterStressIndex.districtId))
    .where(sql`${s.waterStressIndex.stressIndex0100} is not null`)
    .orderBy(desc(s.waterStressIndex.stressIndex0100))
    .limit(1);
  const monsoon = await db
    .select({ year: s.monsoonSeries.year, v: s.monsoonSeries.departurePct })
    .from(s.monsoonSeries)
    .where(and(eq(s.monsoonSeries.regionType, "india_grid"), sql`${s.monsoonSeries.departurePct} is not null`))
    .orderBy(desc(s.monsoonSeries.year))
    .limit(1);
  const gwYear = await db.select({ y: sql<number>`max(${s.groundwaterDistrict.year})` }).from(s.groundwaterDistrict).where(eq(s.groundwaterDistrict.season, "pre_monsoon"));
  const gw = gwYear[0]?.y
    ? await db
        .select({ name: s.districts.name, state: s.districts.stateName, v: s.groundwaterDistrict.medianDepthMbgl, year: s.groundwaterDistrict.year })
        .from(s.groundwaterDistrict)
        .innerJoin(s.districts, eq(s.districts.id, s.groundwaterDistrict.districtId))
        .where(and(eq(s.groundwaterDistrict.season, "pre_monsoon"), eq(s.groundwaterDistrict.year, gwYear[0].y), sql`${s.groundwaterDistrict.wellCount} >= 3`))
        .orderBy(desc(s.groundwaterDistrict.medianDepthMbgl))
        .limit(1)
    : [];
  const rice = await db
    .select({ year: s.cropProduction.year, prod: sql<number>`sum(${s.cropProduction.productionT})`, area: sql<number>`sum(${s.cropProduction.areaHa})` })
    .from(s.cropProduction)
    .where(and(eq(s.cropProduction.crop, "rice"), sql`${s.cropProduction.productionT} is not null`))
    .groupBy(s.cropProduction.year)
    .orderBy(desc(s.cropProduction.year))
    .limit(1);
  const nFields = ownerId ? ((await db.select({ n: sql<number>`count(*)::int` }).from(s.fields).where(eq(s.fields.ownerId, ownerId)))[0]?.n ?? 0) : 0;
  const nAdv = (await db.select({ n: sql<number>`count(*)::int` }).from(s.advisories))[0]?.n ?? 0;
  const nSrc = (await db.select({ n: sql<number>`count(*)::int` }).from(s.dataSources))[0]?.n ?? 0;
  return {
    atlas: stress[0] ? { district: stress[0].name, state: stress[0].state, value: stress[0].v } : null,
    monsoon: monsoon[0] ? { year: monsoon[0].year, value: monsoon[0].v } : null,
    groundwater: gw[0] ? { district: gw[0].name, state: gw[0].state, value: gw[0].v, year: gw[0].year } : null,
    crops: rice[0] && rice[0].area ? { crop: "rice", year: rice[0].year, value: Math.round((rice[0].prod / rice[0].area) * 100) / 100 } : null,
    field: { count: nFields },
    impact: { count: nAdv },
    methods: { count: nSrc },
  };
}
export type Headlines = Awaited<ReturnType<typeof headlines>>;
