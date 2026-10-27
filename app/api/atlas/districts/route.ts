import { listDistricts } from "@/lib/server/atlas";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  return handle(async () => json({ districts: await listDistricts() }, { cacheSeconds: 86400 }));
}
