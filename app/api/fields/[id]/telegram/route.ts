import { randomInt } from "node:crypto";
import { getDb } from "@/lib/server/db";
import { telegramLinks } from "@/db/schema";
import { getOwnerId } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";
import { getOwnedField } from "@/lib/server/advisor";

export const runtime = "nodejs";

/** Create a one-time code (valid 30 min) that links this field to a Telegram chat via /start <code>. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!process.env.TELEGRAM_BOT_TOKEN || !bot) return error(503, "Telegram is not configured", { notConfigured: true });
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    const db = await getDb();
    await db.insert(telegramLinks).values({ fieldId: id, linkCode: code, codeExpiresAt: new Date(Date.now() + 30 * 60_000), language: field.language });
    return json({ code, bot, deepLink: `https://t.me/${bot}?start=${code}` }, { status: 201 });
  });
}
