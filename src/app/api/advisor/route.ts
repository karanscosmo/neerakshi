import { NextResponse } from "next/server";
import { z } from "zod";
import type { Feature } from "geojson";
import { db } from "@/db/client";
import { advisories } from "@/db/schema";
import { computeAdvisory } from "@/lib/agro/waterBalance";
import { fetchForecast } from "@/lib/services/weather";
import { fetchSatelliteObservation, geometryFor } from "@/lib/services/satellite";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  geometry: z.any().optional().nullable(),
  crop: z.enum(["rice", "wheat", "maize", "sugarcane"]),
  soil: z.enum(["sandy", "loam", "clay_loam", "clay"]),
  irrigationMethod: z.enum(["flood", "furrow", "drip"]).default("flood"),
  sowingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  areaHa: z.number().positive().max(5000).default(1),
  previousDepletionMm: z.number().min(0).max(2000).optional().nullable(),
  fieldId: z.string().optional().nullable(),
});

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
      { error: "Invalid advisory request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const assessmentDate = input.assessmentDate ?? new Date().toISOString().slice(0, 10);
  const geometry = geometryFor({
    geometry: (input.geometry as Feature | null) ?? null,
    lat: input.lat,
    lon: input.lon,
  });

  if (!geometry) {
    return NextResponse.json({ error: "Field geometry is invalid." }, { status: 400 });
  }

  const [weather, satellite] = await Promise.all([
    fetchForecast(input.lat, input.lon),
    fetchSatelliteObservation(geometry.feature),
  ]);

  if (weather.status !== "ok" || !weather.daily || weather.daily.length === 0) {
    return NextResponse.json(
      {
        error: "weather_unavailable",
        message:
          weather.reason ??
          "Live weather is unavailable, so no advisory was calculated. Neerakshi does not fabricate a forecast.",
        weather,
      },
      { status: 502 },
    );
  }

  const advisory = computeAdvisory({
    crop: input.crop,
    soil: input.soil,
    irrigationMethod: input.irrigationMethod,
    assessmentDate,
    sowingDate: input.sowingDate,
    areaHa: input.areaHa,
    previousDepletionMm: input.previousDepletionMm ?? null,
    forecast: weather.daily.map((day) => ({
      date: day.date,
      et0Mm: day.et0Mm,
      rainMm: day.rainMm,
    })),
    satellite:
      satellite.status === "ok" && satellite.ndvi
        ? {
            ndvi: satellite.ndvi.mean,
            validFraction: satellite.ndvi.validFraction,
            sceneDate: satellite.scene?.datetime ?? null,
            cloudCover: satellite.scene?.cloudCover ?? null,
          }
        : null,
  });

  if (input.fieldId && advisory.status === "ok") {
    try {
      db.insert(advisories)
        .values({
          id: crypto.randomUUID(),
          fieldId: input.fieldId,
          createdAt: new Date().toISOString(),
          assessmentDate,
          decision: advisory.decision,
          payload: JSON.stringify({
            crop: input.crop,
            soil: input.soil,
            irrigationMethod: input.irrigationMethod,
            sowingDate: input.sowingDate,
            areaHa: input.areaHa,
            previousDepletionMm: input.previousDepletionMm ?? null,
          }),
          result: JSON.stringify(advisory),
        })
        .run();
    } catch {
      // The advisory remains valid even if the optional history write fails.
    }
  }

  return NextResponse.json({
    advisory,
    weather,
    satellite,
    input: {
      lat: input.lat,
      lon: input.lon,
      areaHa: input.areaHa,
      crop: input.crop,
      soil: input.soil,
      irrigationMethod: input.irrigationMethod,
      sowingDate: input.sowingDate,
      assessmentDate,
      fieldId: input.fieldId ?? null,
    },
  });
}
