import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { fields, telegramLinks } from "@/db/schema";
import { secretEquals } from "@/lib/server/session";
import { activeLinksForChat, advisoryMessage, chatLocale, fieldUrl, linkByCode, sendMessage, sendVoiceNote, telegramConfigured } from "@/lib/server/telegram";
import { getFieldById, runFieldAdvisory } from "@/lib/server/advisor";
import { dictionaries } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/fmt";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const maxDuration = 45;

const Update = z.object({
  update_id: z.number(),
  message: z
    .object({
      chat: z.object({ id: z.number() }),
      text: z.string().optional(),
      from: z.object({ language_code: z.string().optional() }).optional(),
    })
    .optional(),
});

/** Telegram bot webhook: /start <code>, /today, /lang, /stop. The secret header is checked on every request. */
export async function POST(req: Request) {
  if (!telegramConfigured()) return new Response("not configured", { status: 503 });
  if (!secretEquals(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("forbidden", { status: 403 });
  }
  const parsed = Update.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.message?.text) return new Response("ok");
  const msg = parsed.data.message;
  const chatId = String(msg.chat.id);
  const [cmd, ...args] = (msg.text ?? "").trim().split(/\s+/);
  const links = await activeLinksForChat(chatId);
  let locale = chatLocale(links[0]?.language ?? (msg.from?.language_code?.slice(0, 2) || "en"));
  let t = dictionaries[locale];
  const db = await getDb();

  try {
    switch (cmd.split("@")[0].toLowerCase()) {
      case "/start": {
        if (!args[0]) {
          await sendMessage(chatId, t.telegram.welcome);
          break;
        }
        const res = await linkByCode(args[0], chatId);
        if (!res?.field) {
          await sendMessage(chatId, t.telegram.badCode);
          break;
        }
        locale = chatLocale(res.link.language);
        t = dictionaries[locale];
        await sendMessage(chatId, fmt(t.telegram.linked, { field: res.field.name || t.crops[res.field.crop as keyof typeof t.crops] }), { text: t.telegram.openField, url: fieldUrl(res.field.id) });
        break;
      }
      case "/today": {
        if (!links.length) {
          await sendMessage(chatId, t.telegram.notLinked);
          break;
        }
        for (const l of links) {
          const f = await getFieldById(l.fieldId);
          if (!f) continue;
          const b = await runFieldAdvisory(f, "telegram");
          const text = advisoryMessage(f, b.advisory, chatLocale(l.language));
          await sendMessage(chatId, text, { text: dictionaries[chatLocale(l.language)].telegram.openField, url: fieldUrl(f.id) });
          await sendVoiceNote(chatId, text, chatLocale(l.language));
        }
        break;
      }
      case "/lang": {
        const l = args[0]?.toLowerCase();
        if (!isLocale(l)) {
          await sendMessage(chatId, t.telegram.langPrompt);
          break;
        }
        await db.update(telegramLinks).set({ language: l }).where(eq(telegramLinks.chatId, chatId));
        if (links.length) await db.update(fields).set({ language: l }).where(inArray(fields.id, links.map((x) => x.fieldId)));
        await sendMessage(chatId, dictionaries[l].telegram.langSet);
        break;
      }
      case "/stop": {
        await db.update(telegramLinks).set({ active: false }).where(eq(telegramLinks.chatId, chatId));
        if (links.length) await db.update(fields).set({ subscribed: false }).where(inArray(fields.id, links.map((x) => x.fieldId)));
        await sendMessage(chatId, t.telegram.stopped);
        break;
      }
      default:
        await sendMessage(chatId, t.telegram.help);
    }
  } catch (e) {
    console.error("telegram webhook", e);
  }
  // Always acknowledge so Telegram does not retry endlessly.
  return new Response("ok");
}
