import { z } from "zod";
import { layerValues } from "@/lib/server/atlas";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

const Q = z.object({ layer: z.enum(["stress", "monsoon", "groundwater", "irrigation", "ndvi"]), year: z.coerce.number().int().optional() });

export async function GET(req: Request) {
  return handle(async () => {
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const q = Q.parse(sp);
    return json({ layer: q.layer, ...(await layerValues(q.layer, q.year)) }, { cacheSeconds: 3600 });
  });
}
