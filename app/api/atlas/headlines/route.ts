import { headlines } from "@/lib/server/headlines";
import { getOwnerId } from "@/lib/server/session";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  return handle(async () => json(await headlines(await getOwnerId())));
}
