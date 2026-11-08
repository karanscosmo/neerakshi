import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { advisories, fields, irrigationEvents } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const field = db.select().from(fields).where(eq(fields.id, id)).get();
  if (!field) {
    return NextResponse.json({ error: "Field not found." }, { status: 404 });
  }

  const history = db
    .select()
    .from(advisories)
    .where(eq(advisories.fieldId, id))
    .orderBy(desc(advisories.createdAt))
    .all()
    .map((row) => {
      let result: unknown = null;
      let payload: unknown = null;
      try {
        result = JSON.parse(row.result);
      } catch {
        result = null;
      }
      try {
        payload = JSON.parse(row.payload);
      } catch {
        payload = null;
      }
      return { ...row, result, payload };
    });

  const irrigation = db
    .select()
    .from(irrigationEvents)
    .where(eq(irrigationEvents.fieldId, id))
    .orderBy(desc(irrigationEvents.appliedOn))
    .all();

  return NextResponse.json({ field, advisories: history, irrigation });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    db.delete(advisories).where(eq(advisories.fieldId, id)).run();
    db.delete(irrigationEvents).where(eq(irrigationEvents.fieldId, id)).run();
    db.delete(fields).where(eq(fields.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The field could not be deleted." }, { status: 500 });
  }
}
