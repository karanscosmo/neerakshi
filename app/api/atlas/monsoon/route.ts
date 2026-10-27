import { monsoonData } from "@/lib/server/sections";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handle(async () => {
    const d = new URL(req.url).searchParams.get("d") ?? "d573";
    return json(await monsoonData(d), { cacheSeconds: 3600 });
  });
}
