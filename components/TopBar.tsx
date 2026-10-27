"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { DistrictPicker } from "@/components/DistrictPicker";
import { useI18n, useSetLocale } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABEL, LOCALE_NAME } from "@/lib/i18n/config";
import { useDistrict, useSharedQuery } from "@/lib/client/district";
import { SECTIONS, type SectionKey } from "@/lib/shared/sections";

/** Compact top bar on inner pages: eye logo (back to the dial), section title, language switch, shared district picker. */
export function TopBar() {
  const { t, locale } = useI18n();
  const setLocale = useSetLocale();
  const pathname = usePathname();
  const q = useSharedQuery();
  const { district } = useDistrict();
  const [open, setOpen] = useState(false);
  const key = SECTIONS.find((s) => pathname.startsWith(`/${s}`)) as SectionKey | undefined;
  const title = key ? t.sections[key].title : t.common.appName;
  return (
    <>
      <a href="#main" className="skip-link">
        {t.common.skipToContent}
      </a>
      <header className="topbar">
        <Link href={`/hub${q}`} className="topbar__logo" aria-label={t.common.backToDial}>
          <Logo size={34} />
        </Link>
        <h1 className="topbar__title">{title}</h1>
        <div className="topbar__tools">
          <button className="chip topbar__district" onClick={() => setOpen(true)} aria-label={`${t.common.changeDistrict}: ${district?.name ?? ""}`}>
            <span aria-hidden>⌖</span>
            <span className="topbar__dname">{district?.name ?? t.common.district}</span>
          </button>
          <div className="langs" role="group" aria-label={t.common.language}>
            {LOCALES.map((l) => (
              <button key={l} className="lang" lang={l} aria-pressed={locale === l} title={LOCALE_NAME[l]} onClick={() => setLocale(l)}>
                {LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </header>
      <DistrictPicker open={open} onClose={() => setOpen(false)} />
      <style>{`
        .langs { display: flex; border: 1px solid var(--hairline); border-radius: 999px; overflow: hidden; }
        .lang { min-width: 44px; min-height: 40px; padding: 0 8px; border: 0; background: transparent; cursor: pointer; font-size: .85rem; }
        .lang[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
        .topbar__district { min-height: 40px; max-width: 42vw; }
        .topbar__dname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 480px) { .topbar__title { font-size: 1rem; } .lang { min-width: 40px; padding: 0 6px; } }
      `}</style>
    </>
  );
}
