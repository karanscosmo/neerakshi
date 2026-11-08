"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हिं" },
  { code: "kn", label: "ಕನ್ನಡ", short: "ಕ" },
] as const;

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedLocale, setSelectedLocale] = useState(locale);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    document.cookie = `NEXT_LOCALE=${selectedLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.setAttribute("lang", selectedLocale);
  }, [selectedLocale]);

  function select(code: string) {
    setSelectedLocale(code);
    setOpen(false);
    startTransition(() => router.refresh());
  }

  const current = OPTIONS.find((option) => option.code === selectedLocale) ?? OPTIONS[0];

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border border-line/80 px-3 text-xs text-muted transition-colors hover:border-glacier/50 hover:text-cloud",
          pending && "opacity-60",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
      >
        <Languages className="h-4 w-4" aria-hidden />
        {compact ? current.short : current.label}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-line bg-deep-ocean/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          {OPTIONS.map((option) => (
            <li key={option.code} role="option"                 aria-selected={selectedLocale === option.code}>
              <button
                type="button"
                onClick={() => select(option.code)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-cloud/90 hover:bg-glacier/10"
              >
                <span className={option.code === "hi" ? "font-[family-name:var(--font-noto-devanagari)]" : option.code === "kn" ? "font-[family-name:var(--font-noto-kannada)]" : ""}>
                  {option.label}
                </span>
                {selectedLocale === option.code && <Check className="h-3.5 w-3.5 text-glacier" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LanguageAttr() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
