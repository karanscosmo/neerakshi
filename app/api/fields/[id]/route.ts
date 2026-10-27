import { eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { advisories, alertLog, fields, irrigationEvents, telegramLinks } from "@/db/schema";
import { getOwnerId } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";
import { PatchFieldSchema } from "@/lib/shared/validation";
import { getOwnedField, latestAdvisory } from "@/lib/server/advisor";
import { publicField } from "../route";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const db = await getDb();
    const links = await db.select().from(telegramLinks).where(eq(telegramLinks.fieldId, id));
    return json({ field: publicField(field), latest: await latestAdvisory(id), telegramLinked: links.some((l) => l.active) });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const patch = PatchFieldSchema.parse(await req.json());
    const db = await getDb();
    const [row] = await db
      .update(fields)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(fields.id, id))
      .returning();
    if (patch.language) await db.update(telegramLinks).set({ language: patch.language }).where(eq(telegramLinks.fieldId, id));
    return json({ field: publicField(row) });
  });
}

/** Delete a field and every record derived from it. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const db = await getDb();
    await db.delete(advisories).where(eq(advisories.fieldId, id));
    await db.delete(irrigationEvents).where(eq(irrigationEvents.fieldId, id));
    await db.delete(telegramLinks).where(eq(telegramLinks.fieldId, id));
    await db.delete(alertLog).where(eq(alertLog.fieldId, id));
    await db.delete(fields).where(eq(fields.id, id));
    return json({ deleted: true });
  });
}
