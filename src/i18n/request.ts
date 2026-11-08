import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { en } from "./messages/en";
import { hi } from "./messages/hi";
import { kn } from "./messages/kn";

const messages = { en, hi, kn };
export const locales = ["en", "hi", "kn"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string | undefined): value is Locale {
  return !!value && locales.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : "en";
  return {
    locale,
    messages: messages[locale],
  };
});
