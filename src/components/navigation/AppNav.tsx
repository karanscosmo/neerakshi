"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/navigation/LanguageSwitcher";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/overview", key: "overview" },
  { href: "/atlas", key: "atlas" },
  { href: "/monsoon", key: "monsoon" },
  { href: "/groundwater", key: "groundwater" },
  { href: "/crops", key: "crops" },
  { href: "/advisor", key: "advisor" },
  { href: "/impact", key: "impact" },
  { href: "/methods", key: "methods" },
] as const;

export function AppNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-midnight/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "relative inline-flex items-center rounded-full px-2.5 py-2 text-[0.78rem] transition-colors 2xl:px-3",
                      active
                        ? "bg-glacier/10 text-glacier"
                        : "text-muted hover:text-cloud",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {t(link.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Link
            href="/advisor"
            className="hidden min-h-11 items-center gap-1.5 rounded-full border border-glacier/40 bg-glacier/10 px-4 text-xs font-medium text-glacier transition-colors hover:bg-glacier/20 sm:inline-flex"
          >
            {t("advisor")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-cloud xl:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t("closeMenu") : t("openMenu")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile primary"
          className="border-t border-line/60 bg-midnight/95 px-4 pb-5 pt-3 xl:hidden"
        >
          <ul className="grid grid-cols-2 gap-1.5">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center rounded-lg px-3 text-sm",
                    pathname.startsWith(link.href)
                      ? "bg-glacier/10 text-glacier"
                      : "text-cloud/80 hover:bg-white/5",
                  )}
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
