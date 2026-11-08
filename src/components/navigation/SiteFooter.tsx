import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/shared/Logo";

export async function SiteFooter() {
  const t = await getTranslations("Nav");
  return (
    <footer className="mt-24 border-t border-line/60 bg-midnight/60">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Satellite-driven agricultural water intelligence for India. A research
            prototype exploring national water stress and explainable field-level
            irrigation advice.
          </p>
          <p className="mt-5 rounded-lg border border-amber/25 bg-amber/5 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-amber">
            DEMO DATA — groundwater, irrigation and crop layers are synthetic fixtures,
            not observations.
          </p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <ul className="mt-4 space-y-2.5 text-sm text-cloud/75">
            {[
              ["/atlas", t("atlas")],
              ["/monsoon", t("monsoon")],
              ["/groundwater", t("groundwater")],
              ["/crops", t("crops")],
            ].map(([href, label]) => (
              <li key={href}>
                <Link className="transition-colors hover:text-cloud" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Use & verify</p>
          <ul className="mt-4 space-y-2.5 text-sm text-cloud/75">
            <li>
              <Link className="transition-colors hover:text-cloud" href="/advisor">
                {t("advisor")}
              </Link>
            </li>
            <li>
              <Link className="transition-colors hover:text-cloud" href="/methods">
                {t("methods")}
              </Link>
            </li>
            <li>
              <Link className="transition-colors hover:text-cloud" href="/impact">
                {t("impact")}
              </Link>
            </li>
            <li>
              <a
                className="transition-colors hover:text-cloud"
                href="https://power.larc.nasa.gov/"
                target="_blank"
                rel="noreferrer"
              >
                NASA POWER ↗
              </a>
            </li>
            <li>
              <a
                className="transition-colors hover:text-cloud"
                href="https://www.fao.org/3/x0490e/x0490e00.htm"
                target="_blank"
                rel="noreferrer"
              >
                FAO-56 ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line/50">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 py-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Neerakshi · Every drop, seen from the sky</span>
          <span>Research prototype · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
