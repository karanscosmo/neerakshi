import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { alertLog, fields, telegramLinks } from "@/db/schema";
import { secretEquals } from "@/lib/server/session";
import { runFieldAdvisory } from "@/lib/server/advisor";
import { advisoryMessage, chatLocale, fieldUrl, sendMessage, sendVoiceNote, telegramConfigured } from "@/lib/server/telegram";
import { purgeExpired } from "@/lib/server/cache";
import { dictionaries } from "@/lib/i18n/dict";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, see vercel.json): recompute advisories for subscribed
 * fields and alert only when irrigation is due or the advice changed.
 * Protected by CRON_SECRET (Vercel sends "Authorization: Bearer <CRON_SECRET>").
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secretEquals(auth, process.env.CRON_SECRET)) return new Response("unauthorized", { status: 401 });
  const started = Date.now();
  const budgetMs = 50_000;
  const db = await getDb();
  const subs = await db.select().from(fields).where(eq(fields.subscribed, true));
  const result = { fields: subs.length, processed: 0, sent: 0, skipped: 0, failed: 0, outOfTime: 0 };
  for (const f of subs) {
    if (Date.now() - started > budgetMs) {
      result.outOfTime++;
      continue;
    }
    try {
      const b = await runFieldAdvisory(f, "cron");
      result.processed++;
      const a = b.advisory;
      const key = `${a.type}:${a.type === "irrigate_now" || a.type === "irrigate_in" ? a.date : ""}`;
      const due = a.type === "irrigate_now" || (a.type === "irrigate_in" && (a.inDays ?? 9) <= 1);
      const changed = key.split(":")[0] !== (f.lastAlertKey ?? "").split(":")[0];
      const links = await db.select().from(telegramLinks).where(and(eq(telegramLinks.fieldId, f.id), eq(telegramLinks.active, true)));
      if (a.type === "unavailable" || (!due && !changed)) {
        result.skipped++;
        await db.insert(alertLog).values({ fieldId: f.id, channel: "telegram", adviceType: a.type, status: "skipped_unchanged" });
        continue;
      }
      if (!links.length || !telegramConfigured()) {
        result.skipped++;
        await db.insert(alertLog).values({ fieldId: f.id, channel: "telegram", adviceType: a.type, status: "skipped_no_channel" });
        await db.update(fields).set({ lastAlertKey: key }).where(eq(fields.id, f.id));
        continue;
      }
      for (const l of links) {
        const loc = chatLocale(l.language);
        const text = advisoryMessage(f, a, loc);
        const r = await sendMessage(l.chatId!, text, { text: dictionaries[loc].telegram.openField, url: fieldUrl(f.id) });
        if (r.ok) await sendVoiceNote(l.chatId!, text, loc);
        await db.insert(alertLog).values({ fieldId: f.id, channel: "telegram", adviceType: a.type, status: r.ok ? "sent" : "failed", detail: r.ok ? null : (r.description ?? null) });
        if (r.ok) result.sent++;
        else result.failed++;
      }
      await db.update(fields).set({ lastAlertKey: key }).where(eq(fields.id, f.id));
    } catch (e) {
      result.failed++;
      await db.insert(alertLog).values({ fieldId: f.id, channel: "telegram", adviceType: "error", status: "failed", detail: e instanceof Error ? e.message.slice(0, 300) : String(e) });
    }
  }
  await purgeExpired().catch(() => {});
  return json({ ok: true, ...result, ms: Date.now() - started });
}
