import { groundwaterData, groundwaterPeers } from "@/lib/server/sections";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams;
    const d = sp.get("d") ?? "d573";
    const extra = (sp.get("ids") ?? "").split(",").filter((x) => /^d\d+$/.test(x)).slice(0, 6);
    const peers = extra.length ? [] : await groundwaterPeers(d, 3);
    const ids = [...new Set([d, ...extra, ...peers])];
    return json({ ids, ...(await groundwaterData(ids)) }, { cacheSeconds: 3600 });
  });
}
