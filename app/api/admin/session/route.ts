import { z } from "zod";
import { clearAdminSession, passcodeMatches, setAdminSession } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

const attempts = new Map<string, { n: number; t: number }>();

/** Sign in with ADMIN_PASSCODE (rate-limited per IP, best effort per instance). */
export async function POST(req: Request) {
  return handle(async () => {
    if (!process.env.ADMIN_PASSCODE) return error(503, "ADMIN_PASSCODE is not set", { notConfigured: true });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const a = attempts.get(ip);
    if (a && a.n >= 8 && Date.now() - a.t < 15 * 60_000) return error(429, "Too many attempts. Try again in 15 minutes.");
    const { passcode } = z.object({ passcode: z.string().min(1).max(200) }).parse(await req.json());
    if (!passcodeMatches(passcode)) {
      attempts.set(ip, { n: (a?.n ?? 0) + 1, t: Date.now() });
      return error(401, "Incorrect passcode");
    }
    attempts.delete(ip);
    await setAdminSession();
    return json({ ok: true });
  });
}

export async function DELETE() {
  return handle(async () => {
    await clearAdminSession();
    return json({ ok: true });
  });
}
