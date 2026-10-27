import type { Dict } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/fmt";
import { LOCALE_BCP47, type Locale } from "@/lib/i18n/config";

export type AdviceLike = {
  type: "irrigate_now" | "irrigate_in" | "wait_rain" | "no_need" | "unavailable";
  reason?: "weather" | "not_sown" | "harvested" | "unknown" | null;
  inDays?: number | null;
  netDepthMm?: number | null;
  grossLitres?: number | null;
  rainNext48hMm?: number | null;
  rainNext3dMm?: number | null;
  nextCheck?: string | null;
};

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
}

/** Plain-language advisory in the chosen language from typed templates (no runtime translation). */
export function adviceText(t: Dict, locale: Locale, a: AdviceLike, crop: keyof Dict["crops"], method: keyof Dict["field"]["methods"]) {
  const nf = new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 0 });
  const slots = {
    crop: t.crops[crop],
    method: t.field.methods[method],
    mm: nf.format(Math.round(a.netDepthMm ?? 0)),
    litres: nf.format(a.grossLitres ?? 0),
    days: a.inDays ?? 0,
    rain: nf.format(Math.round(a.rainNext48hMm ?? 0)),
    date: a.nextCheck ? formatDate(a.nextCheck, locale) : "—",
    reason: a.reason ? t.advice.reasons[a.reason] : t.advice.reasons.unknown,
  };
  const tpl = t.advice[a.type];
  return { title: fmt(tpl.title, slots), body: fmt(tpl.body, slots) };
}
