import { NextResponse } from "next/server";
import type { Feature } from "geojson";
import { fetchSatelliteObservation, geometryFor } from "@/lib/services/satellite";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    geometry?: Feature | null;
    lat?: number;
    lon?: number;
    bufferM?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "unavailable", reason: "A JSON body is required." },
      { status: 400 },
    );
  }

  const geometry = geometryFor({
    geometry: body.geometry ?? null,
    lat: body.lat,
    lon: body.lon,
    bufferM: body.bufferM,
  });

  if (!geometry) {
    return NextResponse.json(
      { status: "unavailable", reason: "Provide a GeoJSON Feature or lat/lon." },
      { status: 400 },
    );
  }

  const result = await fetchSatelliteObservation(geometry.feature);
  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 502 });
}
