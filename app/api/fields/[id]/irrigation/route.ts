import { getDb } from "@/lib/server/db";
import { irrigationEvents } from "@/db/schema";
import { getOwnerId } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";
import { getOwnedField } from "@/lib/server/advisor";
import { IrrigationSchema } from "@/lib/shared/validation";
import { todayIST } from "@/lib/server/openmeteo";

export const runtime = "nodejs";

/** "I irrigated today": refill to field capacity (or a stated depth) on the given date. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const body = IrrigationSchema.parse(await req.json().catch(() => ({})));
    const date = body.date ?? todayIST();
    if (date > todayIST()) return error(400, "Date cannot be in the future");
    const db = await getDb();
    const [row] = await db.insert(irrigationEvents).values({ fieldId: id, date, depthMm: body.depthMm ?? null }).returning();
    return json({ event: row }, { status: 201 });
  });
}
