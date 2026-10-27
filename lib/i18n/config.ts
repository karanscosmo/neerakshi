export const LOCALES = ["en", "hi", "kn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "nk_lang";
export const LOCALE_LABEL: Record<Locale, string> = { en: "EN", hi: "हिं", kn: "ಕನ್ನಡ" };
export const LOCALE_NAME: Record<Locale, string> = { en: "English", hi: "हिन्दी", kn: "ಕನ್ನಡ" };
/** BCP-47 tags for number/date formatting and speech synthesis. */
export const LOCALE_BCP47: Record<Locale, string> = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (LOCALES as readonly string[]).includes(x);
}
