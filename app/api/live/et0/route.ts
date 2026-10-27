import { z } from "zod";
import { getEt0Today } from "@/lib/server/openmeteo";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handle(async () => {
    const q = z.object({ lat: z.coerce.number().min(6).max(38), lon: z.coerce.number().min(67).max(98) }).parse(Object.fromEntries(new URL(req.url).searchParams));
    try {
      const r = await getEt0Today(q.lat, q.lon);
      if (r.et0 === null) return error(502, "Open-Meteo returned no ET0 for today");
      return json({ ...r, source: "Open-Meteo (FAO-56 Penman–Monteith ET₀)" }, { cacheSeconds: 1800 });
    } catch (e) {
      return error(502, e instanceof Error ? e.message : "Open-Meteo unavailable");
    }
  });
}
