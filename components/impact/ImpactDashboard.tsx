"use client";
import { useI18n } from "@/lib/i18n/client";
import { ChartFrame, RankBars, LineChart } from "@/components/charts/kit";
import type { AdminStats } from "@/lib/server/admin";
import { SignOut } from "./PasscodeForm";

const TYPE_COLOR: Record<string, string> = { irrigate_now: "var(--laterite)", irrigate_in: "var(--dawn-saffron)", wait_rain: "var(--neer-teal)", no_need: "var(--leaf-olive)", unavailable: "var(--monsoon-slate)" };

export function ImpactDashboard({ s }: { s: AdminStats }) {
  const { t } = useI18n();
  const nf = new Intl.NumberFormat("en-IN");
  const dates = [...new Set(s.byDate.map((d) => d.date))].sort();
  const types = [...new Set(s.byDate.map((d) => d.type))];
  const idx = (d: string) => Math.round((Date.parse(d) - Date.parse(dates[0] ?? d)) / 86400000);
  const typeLabel = (k: string) => (k in t.advice ? (t.advice[k as keyof typeof t.advice] as { title: string }).title?.replace("{days}", "N") : k);
  return (
    <div className="stack" style={{ ["--stack" as string]: "20px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <p className="annot">{t.impact.lead}</p>
        <div className="row">
          <a className="btn btn--sm" href="/api/admin/export">
            ⤓ {t.impact.export}
          </a>
          <SignOut />
        </div>
      </div>
      <div className="kpis">
        {[
          [t.impact.activeFields, s.fields],
          [t.impact.subscribedFields, s.subscribed],
          [t.impact.advisories, s.advisories],
          [t.impact.recordedIrrigations, s.recordedIrrigations],
        ].map(([k, v]) => (
          <div key={String(k)} className="card kpi">
            <p className="annot" style={{ margin: 0 }}>{k}</p>
            <p className="num" style={{ fontSize: "var(--step-3)", margin: 0 }}>{nf.format(Number(v))}</p>
          </div>
        ))}
      </div>
      {s.advisories === 0 ? <p className="notice notice--info">{t.impact.empty}</p> : null}
      <div className="grid-2">
        <ChartFrame title={t.impact.byType} source="Neerakshi advisory database (live)" table={{ columns: [{ key: "k", label: "type" }, { key: "n", label: "n", numeric: true }], rows: s.byType }} empty={s.byType.length ? null : t.impact.empty}>
          <RankBars rows={s.byType.map((x) => ({ key: x.k, label: typeLabel(x.k), v: x.n }))} format={(v) => String(v)} color="var(--neer-teal)" label={t.impact.byType} />
        </ChartFrame>
        <ChartFrame title={t.impact.byDate} source="Neerakshi advisory database (live)" empty={dates.length ? null : t.impact.empty} table={{ columns: [{ key: "date", label: "date" }, { key: "type", label: "type" }, { key: "n", label: "n", numeric: true }], rows: s.byDate }}>
          <LineChart
            series={types.map((ty) => ({ key: ty, label: typeLabel(ty), color: TYPE_COLOR[ty] ?? "var(--ink)", points: dates.map((d) => ({ x: idx(d), y: s.byDate.find((b) => b.date === d && b.type === ty)?.n ?? 0 })) }))}
            yLabel="advisories / day"
            format={(se, p) => `${se.label}: ${p.y}`}
            label={t.impact.byDate}
          />
        </ChartFrame>
        <ChartFrame title={t.impact.byCrop} source="Neerakshi advisory database (live)" empty={s.byCrop.length ? null : t.impact.empty}>
          <RankBars rows={s.byCrop.map((x) => ({ key: x.k, label: t.crops[x.k as keyof typeof t.crops] ?? x.k, v: x.n }))} format={(v) => String(v)} color="var(--leaf-olive)" label={t.impact.byCrop} />
        </ChartFrame>
        <ChartFrame title={t.impact.byDistrict} source="Neerakshi advisory database (live)" empty={s.byDistrict.length ? null : t.impact.empty}>
          <RankBars rows={s.byDistrict.map((x) => ({ key: x.k, label: x.k, v: x.n }))} format={(v) => String(v)} label={t.impact.byDistrict} />
        </ChartFrame>
      </div>
      <ChartFrame title={t.impact.alerts} source="alert_log (Telegram)" empty={s.alerts.length ? null : t.impact.empty}>
        <RankBars rows={s.alerts.map((x) => ({ key: x.k, label: x.k, v: x.n }))} format={(v) => String(v)} color="var(--monsoon-slate)" label={t.impact.alerts} />
      </ChartFrame>
      <section className="card">
        <h3>{t.impact.balanceTitle}</h3>
        <p>{t.impact.balanceLead}</p>
        <p className="num" style={{ fontSize: "var(--step-3)", margin: 0 }}>
          {nf.format(s.requirement.m3)} m³
        </p>
        <p className="annot">
          {t.impact.estimatedRequirement} · {s.requirement.advisories} advisories since {s.requirement.since}
        </p>
      </section>
      <style>{`.kpis { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; } @media (min-width: 900px) { .kpis { grid-template-columns: repeat(4, minmax(0,1fr)); } } .kpi { padding: 12px 14px; }`}</style>
    </div>
  );
}
