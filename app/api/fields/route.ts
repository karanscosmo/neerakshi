import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { fields } from "@/db/schema";
import { getOrCreateOwnerId, getOwnerId, newId } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";
import { NewFieldSchema } from "@/lib/shared/validation";
import { inIndia, polygonAreaHa, polygonCentroid } from "@/lib/shared/geo";
import { districtAt } from "@/lib/server/districtLookup";
import { todayIST } from "@/lib/server/openmeteo";
import { addDays } from "@/lib/agro/waterBalance";

export const runtime = "nodejs";

/** List the anonymous owner's fields. */
export async function GET() {
  return handle(async () => {
    const owner = await getOwnerId();
    if (!owner) return json({ fields: [] });
    const db = await getDb();
    const rows = await db.select().from(fields).where(eq(fields.ownerId, owner)).orderBy(desc(fields.createdAt));
    return json({ fields: rows.map(publicField) });
  });
}

/** Save a field (polygon, crop, sowing date, soil, method). */
export async function POST(req: Request) {
  return handle(async () => {
    const input = NewFieldSchema.parse(await req.json());
    const areaHa = polygonAreaHa(input.geometry);
    if (areaHa < 0.01 || areaHa > 200) return error(400, `Field area ${areaHa.toFixed(2)} ha is outside 0.01–200 ha. Redraw the boundary.`);
    const [lon, lat] = polygonCentroid(input.geometry);
    if (!inIndia(lon, lat)) return error(400, "The field must be in India.");
    const today = todayIST();
    if (input.sowingDate > addDays(today, 60) || input.sowingDate < addDays(today, -420)) return error(400, "Sowing date must be within the last 14 months or the next 60 days.");
    if (input.lastIrrigationDate && input.lastIrrigationDate > today) return error(400, "Last irrigation date cannot be in the future.");
    const owner = await getOrCreateOwnerId();
    const district = districtAt(lon, lat);
    const db = await getDb();
    const id = newId(9);
    const [row] = await db
      .insert(fields)
      .values({
        id,
        ownerId: owner,
        name: input.name || null,
        geometry: input.geometry,
        areaHa: Math.round(areaHa * 1000) / 1000,
        lat: Math.round(lat * 1e5) / 1e5,
        lon: Math.round(lon * 1e5) / 1e5,
        districtId: district?.id ?? null,
        crop: input.crop,
        sowingDate: input.sowingDate,
        soil: input.soil,
        method: input.method,
        lastIrrigationDate: input.lastIrrigationDate ?? null,
        language: input.language,
      })
      .returning();
    return json({ field: publicField(row) }, { status: 201 });
  });
}

export function publicField(f: typeof fields.$inferSelect) {
  const { ownerId: _o, lastAlertKey: _k, ...rest } = f;
  return rest;
}
