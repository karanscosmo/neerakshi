import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { advisories, fields } from "@/db/schema";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  geometry: z.any().optional().nullable(),
  centroidLat: z.number().min(-90).max(90),
  centroidLon: z.number().min(-180).max(180),
  areaHa: z.number().positive().max(5000),
  crop: z.enum(["rice", "wheat", "maize", "sugarcane"]),
  soil: z.enum(["sandy", "loam", "clay_loam", "clay"]),
  irrigationMethod: z.enum(["flood", "furrow", "drip"]).default("flood"),
  sowingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  advisory: z.any().optional().nullable(),
});

export async function GET() {
  try {
    const rows = db.select().from(fields).all();
    return NextResponse.json({ fields: rows });
  } catch {
    return NextResponse.json({ error: "Could not load saved fields." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid field.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const row = {
    id: crypto.randomUUID(),
    name: input.name,
    geometry: input.geometry ? JSON.stringify(input.geometry) : null,
    centroidLat: input.centroidLat,
    centroidLon: input.centroidLon,
    areaHa: input.areaHa,
    crop: input.crop,
    soil: input.soil,
    irrigationMethod: input.irrigationMethod,
    sowingDate: input.sowingDate,
    createdAt: new Date().toISOString(),
  };

  try {
    db.insert(fields).values(row).run();
    if (input.advisory && input.advisory.status === "ok") {
      db.insert(advisories)
        .values({
          id: crypto.randomUUID(),
          fieldId: row.id,
          createdAt: new Date().toISOString(),
          assessmentDate: String(input.advisory.assessmentDate ?? ""),
          decision: String(input.advisory.decision ?? ""),
          payload: JSON.stringify({
            crop: input.crop,
            soil: input.soil,
            irrigationMethod: input.irrigationMethod,
            sowingDate: input.sowingDate,
            areaHa: input.areaHa,
          }),
          result: JSON.stringify(input.advisory),
        })
        .run();
    }
    return NextResponse.json({ field: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The field could not be saved." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A field id is required." }, { status: 400 });
  }
  try {
    db.delete(fields).where(eq(fields.id, id)).run();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The field could not be deleted." }, { status: 500 });
  }
}
