import { getSentinelTle } from "@/lib/server/celestrak";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

/** Sentinel-2A two-line elements (CelesTrak); the browser propagates the orbit with satellite.js. */
export async function GET() {
  return handle(async () => {
    try {
      return json(await getSentinelTle(), { cacheSeconds: 3600 });
    } catch (e) {
      return error(502, e instanceof Error ? e.message : "CelesTrak unavailable");
    }
  });
}
