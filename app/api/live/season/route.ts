import { z } from "zod";
import { getSeasonVsNormal } from "@/lib/server/openmeteo";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  return handle(async () => {
    const q = z.object({ lat: z.coerce.number().min(6).max(38), lon: z.coerce.number().min(67).max(98) }).parse(Object.fromEntries(new URL(req.url).searchParams));
    try {
      return json(await getSeasonVsNormal(q.lat, q.lon), { cacheSeconds: 6 * 3600 });
    } catch (e) {
      return error(502, e instanceof Error ? e.message : "Open-Meteo unavailable");
    }
  });
}
