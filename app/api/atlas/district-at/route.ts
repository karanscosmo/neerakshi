import { z } from "zod";
import { districtAt } from "@/lib/server/districtLookup";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Which Census 2011 district contains this point? (Coordinates are not stored.) */
export async function GET(req: Request) {
  return handle(async () => {
    const q = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }).parse(Object.fromEntries(new URL(req.url).searchParams));
    const d = districtAt(q.lon, q.lat);
    if (!d) return error(404, "Outside Indian districts");
    return json({ district: d });
  });
}
