import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/server/db";
import { dataSources } from "@/db/schema";
import { getDict } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/fmt";
import { SOURCES } from "@/lib/shared/sources";
import { LOCALE_BCP47 } from "@/lib/i18n/config";
import { RAMPS } from "@/lib/shared/scales";

export const metadata: Metadata = { title: "Methods and Sources" };
export const dynamic = "force-dynamic";

export default async function MethodsPage() {
  const { t, locale } = await getDict();
  let fresh: (typeof dataSources.$inferSelect)[] = [];
  let dbError: string | null = null;
  try {
    const db = await getDb();
    fresh = await db.select().from(dataSources).orderBy(asc(dataSources.id));
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }
  const byId = new Map(fresh.map((f) => [f.id, f]));
  const df = new Intl.DateTimeFormat(LOCALE_BCP47[locale], { dateStyle: "medium" });
  const nf = new Intl.NumberFormat(LOCALE_BCP47[locale]);
  const Swatch = ({ c }: { c: string }) => <span style={{ display: "inline-block", width: 14, height: 14, background: c, border: "1px solid var(--ink)", verticalAlign: "middle", marginRight: 6 }} />;
  return (
    <main id="main" className="page-narrow stack" style={{ ["--stack" as string]: "22px" }}>
      <header>
        <h2>{t.methods.title}</h2>
        <p>{t.methods.lead}</p>
      </header>

      <section aria-labelledby="fresh">
        <h3 id="fresh">{t.methods.freshness}</h3>
        <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>{t.methods.freshnessLead}</p>
        {dbError ? <p className="notice" role="alert">{t.common.error} {dbError}</p> : null}
        <table className="data">
          <thead>
            <tr>
              <th scope="col">{t.common.source}</th>
              <th scope="col">Status</th>
              <th scope="col">{t.methods.refreshed.replace(" {date}", "")}</th>
              <th scope="col" style={{ textAlign: "right" }}>Rows</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => {
              const f = byId.get(s.id);
              const st = (f?.status ?? "missing") as keyof typeof t.methods.status;
              return (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td>
                    <span className={st === "missing" ? "demo-badge" : "annot"}>{t.methods.status[st] ?? st}</span>
                  </td>
                  <td className="num">{f?.refreshedAt ? df.format(f.refreshedAt) : "—"}</td>
                  <td className="n">{f && f.rows ? nf.format(f.rows) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ds">
        <h3 id="ds">{t.methods.datasets}</h3>
        {SOURCES.map((s) => (
          <article key={s.id} className="card" style={{ marginBottom: 10 }}>
            <p className="annot" style={{ margin: 0 }}>{s.id}</p>
            <h4 style={{ margin: "2px 0 4px" }}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
            </h4>
            <p style={{ margin: "0 0 4px" }}>{s.usedFor}</p>
            <p className="annot" style={{ textTransform: "none", letterSpacing: 0, margin: 0 }}>
              {s.publisher} · {t.methods.licence}: {s.licence}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: ".85rem" }}>
              <strong>{t.methods.limitations}:</strong> {s.limitations}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="fx" className="stack">
        <h3 id="fx">{t.methods.formulas}</h3>
        <div className="card">
          <h4>{t.methods.fao56Title}</h4>
          <p>{t.methods.fao56Body}</p>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: ".85rem", background: "var(--paper-deep)", padding: 10, borderRadius: 6 }}>
{`ETc = Kc · ET0            (FAO-56 Eq. 56)
Dr,i = Dr,i−1 − Peff,i − Ii + ETc,i   (Eq. 85)
TAW = 1000 (θFC − θWP) Zr;  RAW = p · TAW   (Eqs. 82–83)
p = p_table + 0.04 (5 − ETc)   (Table 22)
Ks = (TAW − Dr) / ((1 − p) TAW) when Dr > RAW   (Eq. 84)`}
          </pre>
        </div>
        <div className="card">
          <h4>{t.methods.rainTitle}</h4>
          <p>{t.methods.rainBody}</p>
        </div>
        <div className="card">
          <h4>{t.methods.ndviTitle}</h4>
          <p>{t.methods.ndviBody}</p>
        </div>
        <div className="card">
          <h4>{t.methods.stressTitle}</h4>
          <p>{t.methods.stressBody}</p>
        </div>
      </section>

      <section aria-labelledby="read" className="card card--plate">
        <h3 id="read">{t.methods.howToRead}</h3>
        <ul>
          <li>
            <Swatch c="#2F7F86" />
            <Swatch c="#6B7F4E" />
            <Swatch c="#B8834A" />
            <Swatch c="#A9533E" /> {t.methods.howColour}
          </li>
          <li>
            <span className="legend__hatch" style={{ width: 18, height: 12, border: "1px solid var(--ink)", background: "repeating-linear-gradient(45deg, transparent 0 4px, var(--monsoon-slate) 4px 5px)", display: "inline-block", marginRight: 6 }} />
            {t.methods.howGaps}
          </li>
          <li>{t.methods.howBasis}</li>
          <li>{t.methods.howCorrelation}</li>
        </ul>
        <div style={{ display: "flex", height: 12, maxWidth: 320, border: "1px solid var(--ink)" }} aria-hidden>
          {RAMPS.monsoon.stops.map((c) => (
            <span key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <p className="annot" style={{ display: "flex", justifyContent: "space-between", maxWidth: 320 }}>
          <span>{t.atlas.deficit}</span>
          <span>{t.atlas.excess}</span>
        </p>
      </section>
      <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>{fmt(t.methods.rows, { rows: nf.format(fresh.reduce((a, f) => a + (f.rows ?? 0), 0)) })}</p>
    </main>
  );
}
