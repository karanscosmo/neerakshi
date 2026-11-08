import { NextResponse } from "next/server";
import { fetchForecast } from "@/lib/services/weather";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { status: "unavailable", reason: "Valid lat and lon query parameters are required." },
      { status: 400 },
    );
  }

  const result = await fetchForecast(lat, lon);
  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 502 });
}
