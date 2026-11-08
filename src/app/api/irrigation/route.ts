import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { irrigationEvents } from "@/db/schema";

export const runtime = "nodejs";

const schema = z.object({
  fieldId: z.string().min(1),
  appliedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  depthMm: z.number().positive().max(1000),
  note: z.string().max(300).optional().nullable(),
});

export async function GET(request: Request) {
  const fieldId = new URL(request.url).searchParams.get("fieldId");
  if (!fieldId) {
    return NextResponse.json({ error: "A fieldId is required." }, { status: 400 });
  }
  const rows = db
    .select()
    .from(irrigationEvents)
    .where(eq(irrigationEvents.fieldId, fieldId))
    .orderBy(desc(irrigationEvents.appliedOn))
    .all();
  return NextResponse.json({ irrigation: rows });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid irrigation event.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const row = {
    id: crypto.randomUUID(),
    fieldId: input.fieldId,
    appliedOn: input.appliedOn,
    depthMm: input.depthMm,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  };
  try {
    db.insert(irrigationEvents).values(row).run();
    return NextResponse.json({ event: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The irrigation event could not be recorded." }, { status: 500 });
  }
}
