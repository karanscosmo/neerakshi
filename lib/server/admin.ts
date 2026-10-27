import "server-only";
import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import * as s from "@/db/schema";
import { isAdmin, passcodeMatches } from "./session";

/** Officer access: signed admin session cookie, or (for automation) an x-admin-passcode header. */
export async function adminAllowed(req?: Request): Promise<boolean> {
  if (await isAdmin()) return true;
  const h = req?.headers.get("x-admin-passcode");
  return Boolean(h && passcodeMatches(h));
}

export async function adminStats() {
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [fieldsN] = await db.select({ n: sql<number>`count(*)::int`, sub: sql<number>`count(*) filter (where ${s.fields.subscribed})::int` }).from(s.fields);
  const [advN] = await db.select({ n: sql<number>`count(*)::int` }).from(s.advisories);
  const byType = await db.select({ k: s.advisories.adviceType, n: sql<number>`count(*)::int` }).from(s.advisories).groupBy(s.advisories.adviceType).orderBy(desc(sql`count(*)`));
  const byDate = await db
    .select({ date: s.advisories.date, type: s.advisories.adviceType, n: sql<number>`count(*)::int` })
    .from(s.advisories)
    .where(gte(s.advisories.date, since))
    .groupBy(s.advisories.date, s.advisories.adviceType)
    .orderBy(s.advisories.date);
  const byCrop = await db.select({ k: s.fields.crop, n: sql<number>`count(*)::int` }).from(s.fields).groupBy(s.fields.crop).orderBy(desc(sql`count(*)`));
  const byDistrict = await db
    .select({ k: sql<string>`coalesce(${s.districts.name}, 'Unknown')`, n: sql<number>`count(*)::int` })
    .from(s.fields)
    .leftJoin(s.districts, eq(s.districts.id, s.fields.districtId))
    .groupBy(s.districts.name)
    .orderBy(desc(sql`count(*)`))
    .limit(15);
  const alerts = await db.select({ k: s.alertLog.status, n: sql<number>`count(*)::int` }).from(s.alertLog).groupBy(s.alertLog.status);
  // Estimated requirement: latest irrigate_now / irrigate_in advisory per subscribed field per day, last 30 days.
  const [req] = await db.execute(sql`
      with latest as (
        select distinct on (a.field_id, a.date) a.field_id, a.date, a.net_depth_mm, f.area_ha
        from advisories a join fields f on f.id = a.field_id
        where f.subscribed and a.date >= ${since} and a.advice_type in ('irrigate_now')
        order by a.field_id, a.date, a.created_at desc)
      select coalesce(sum(net_depth_mm * area_ha * 10), 0)::float as m3, count(*)::int as n from latest`).then((r) => ((r as unknown as { rows?: unknown[] }).rows ?? (r as unknown as unknown[])) as { m3: number; n: number }[]);
  const [events] = await db.select({ n: sql<number>`count(*)::int` }).from(s.irrigationEvents).where(gte(s.irrigationEvents.date, since));
  return {
    fields: fieldsN?.n ?? 0,
    subscribed: fieldsN?.sub ?? 0,
    advisories: advN?.n ?? 0,
    byType,
    byDate,
    byCrop,
    byDistrict,
    alerts,
    requirement: { m3: Math.round(req?.m3 ?? 0), advisories: req?.n ?? 0, since },
    recordedIrrigations: events?.n ?? 0,
  };
}

/** Anonymised export: no field id, owner, name, polygon or chat id. */
export async function advisoriesExport() {
  const db = await getDb();
  return db
    .select({
      date: s.advisories.date,
      district_id: s.advisories.districtId,
      district: s.districts.name,
      crop: s.advisories.crop,
      advice_type: s.advisories.adviceType,
      etc_mm: s.advisories.etcMm,
      rain_forecast_mm: s.advisories.rainForecastMm,
      deficit_mm: s.advisories.deficitMm,
      raw_mm: s.advisories.rawMm,
      net_depth_mm: s.advisories.netDepthMm,
    })
    .from(s.advisories)
    .leftJoin(s.districts, eq(s.districts.id, s.advisories.districtId))
    .orderBy(s.advisories.date);
}
export type AdminStats = Awaited<ReturnType<typeof adminStats>>;
