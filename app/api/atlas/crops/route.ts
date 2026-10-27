import { z } from "zod";
import { cropsData, yearRange } from "@/lib/server/sections";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

const Q = z.object({
  crop: z.enum(["rice", "wheat", "maize", "sugarcane"]).default("rice"),
  scope: z.enum(["india", "state", "district"]).default("state"),
  d: z.string().regex(/^d\d+$/).default("d573"),
  y0: z.coerce.number().int().optional(),
  y1: z.coerce.number().int().optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const q = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
    const r = await yearRange();
    const y0 = Math.max(r.min, q.y0 ?? r.min);
    const y1 = Math.min(r.max, q.y1 ?? r.max);
    return json({ range: r, y0, y1, ...(await cropsData(q.crop, q.scope, q.d, y0, y1)) }, { cacheSeconds: 3600 });
  });
}
