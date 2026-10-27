import { adminAllowed, adminStats } from "@/lib/server/admin";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handle(async () => {
    if (!(await adminAllowed(req))) return error(401, "Officer passcode required");
    return json(await adminStats());
  });
}
