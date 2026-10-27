import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "./db";
import { fields, telegramLinks, type Field } from "@/db/schema";
import { dictionaries } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/fmt";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { adviceText, formatDate } from "@/lib/shared/adviceText";
import type { Advisory } from "@/lib/agro/advisory";

const API = "https://api.telegram.org";

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function call(method: string, body: unknown): Promise<{ ok: boolean; description?: string }> {
  const r = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }))) as { ok: boolean; description?: string };
  return j;
}

export async function sendMessage(chatId: string, text: string, link?: { text: string; url: string }) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(link && /^https:\/\//.test(link.url) ? { reply_markup: { inline_keyboard: [[{ text: link.text, url: link.url }]] } } : {}),
  });
}

/**
 * Optional voice note: Google Cloud Text-to-Speech (API key in TTS_API_KEY) → OGG/Opus → sendVoice.
 * Returns false (and sends nothing) if the key is absent or synthesis fails — never fake audio.
 */
export async function sendVoiceNote(chatId: string, text: string, locale: Locale): Promise<boolean> {
  const key = process.env.TTS_API_KEY;
  if (!key) return false;
  try {
    const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: { en: "en-IN", hi: "hi-IN", kn: "kn-IN" }[locale] }, audioConfig: { audioEncoding: "OGG_OPUS" } }),
    });
    if (!r.ok) return false;
    const { audioContent } = (await r.json()) as { audioContent?: string };
    if (!audioContent) return false;
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("voice", new Blob([Buffer.from(audioContent, "base64")], { type: "audio/ogg" }), "advice.ogg");
    const s = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendVoice`, { method: "POST", body: form });
    return s.ok;
  } catch {
    return false;
  }
}

export function fieldUrl(id: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return base ? `${base}/field/${id}` : "";
}

/** Advisory message text in the chat's language (typed templates; numbers and dates in slots only). */
export function advisoryMessage(field: Field, adv: Advisory, locale: Locale): string {
  const t = dictionaries[locale];
  const { title, body } = adviceText(t, locale, adv, field.crop as keyof typeof t.crops, field.method as keyof typeof t.field.methods);
  const lines = [`💧 ${field.name || t.crops[field.crop as keyof typeof t.crops]} — ${title}`, body];
  if (adv.nextCheck) lines.push(fmt(t.advice.nextCheck, { date: formatDate(adv.nextCheck, locale) }));
  return lines.join("\n\n");
}

export async function linkByCode(code: string, chatId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(telegramLinks)
    .where(and(eq(telegramLinks.linkCode, code.toUpperCase()), gt(telegramLinks.codeExpiresAt, new Date())))
    .limit(1);
  const link = rows[0];
  if (!link) return null;
  await db.update(telegramLinks).set({ chatId, active: true, linkedAt: new Date(), codeExpiresAt: new Date() }).where(eq(telegramLinks.id, link.id));
  await db.update(fields).set({ subscribed: true, updatedAt: new Date() }).where(eq(fields.id, link.fieldId));
  const f = (await db.select().from(fields).where(eq(fields.id, link.fieldId)).limit(1))[0];
  return { link: { ...link, chatId }, field: f };
}

export async function activeLinksForChat(chatId: string) {
  const db = await getDb();
  return db.select().from(telegramLinks).where(and(eq(telegramLinks.chatId, chatId), eq(telegramLinks.active, true)));
}

export function chatLocale(v: string | null | undefined): Locale {
  return isLocale(v) ? v : "en";
}
