"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useDistrict } from "@/lib/client/district";
import { useJson } from "@/lib/client/useJson";
import { ChartFrame, DivergingBars, Heatmap, LineChart } from "@/components/charts/kit";
import { RAMPS, colorFor } from "@/lib/shared/scales";
import { LOCALE_BCP47 } from "@/lib/i18n/config";

type Row = { year: number; jjas: number | null; normal: number | null; dep: number | null };
type MonsoonResp = {
  district: { id: string; name: string; state: string; subdivision: string | null; lat: number; lon: number } | null;
  india: Row[];
  indiaGrid: Row[];
  state: Row[];
  subdiv: Row[];
  monthly: { year: number; month: number; rain: number | null; dep: number | null }[];
};
type SeasonResp = { seasonYear: number; inSeason: boolean; start: string; end: string; normal: { md: string; cum: number }[]; actual: { md: string; cum: number | null }[] };

const barColor = (y: number) => (y <= -10 ? "var(--laterite)" : y >= 10 ? "var(--neer-teal)" : "var(--grid)");

export function MonsoonView() {
  const { t, locale } = useI18n();
  const { districtId } = useDistrict();
  const r = useJson<MonsoonResp>(`/api/atlas/monsoon?d=${districtId}`);
  const d = r.data;
  const season = useJson<SeasonResp>(d?.district ? `/api/live/season?lat=${d.district.lat}&lon=${d.district.lon}` : null);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 1 }), [locale]);
  const pct = (v: number) => `${v > 0 ? "+" : ""}${nf.format(v)}%`;

  const india = useMemo(() => (d?.india ?? []).map((x) => ({ x: x.year, y: x.dep })), [d]);
  const grid = useMemo(() => (d?.indiaGrid ?? []).map((x) => ({ x: x.year, y: x.dep })), [d]);
  const valid = india.filter((x): x is { x: number; y: number } => x.y !== null);
  const driest = [...valid].sort((a, b) => a.y - b.y).slice(0, 5);
  const wettest = [...valid].sort((a, b) => b.y - a.y).slice(0, 3);
  const deficitCount = valid.filter((x) => x.y <= -10).length;

  // Scrollytelling steps highlight different years on the sticky chart
  const steps = useMemo(
    () => [
      { key: "all", text: `${t.monsoon.lead} ${t.monsoon.deficitYears}`, hl: [] as number[] },
      { key: "dry", text: driest.map((x) => `${x.x}: ${pct(x.y)}`).join(" · "), title: fmt(t.monsoon.deficitCount, { count: deficitCount }), hl: driest.map((x) => x.x) },
      { key: "wet", text: wettest.map((x) => `${x.x}: ${pct(x.y)}`).join(" · "), title: t.atlas.excess, hl: wettest.map((x) => x.x) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driest.map((x) => x.x).join(), wettest.map((x) => x.x).join(), t, deficitCount],
  );
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.i))), { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length, d]);
  const hl = new Set(steps[step]?.hl ?? []);
  const storyColor = (y: number, x: number) => (hl.size && !hl.has(x) ? "var(--grid)" : barColor(y));

  const years = useMemo(() => [...new Set((d?.monthly ?? []).map((m) => m.year))].sort((a, b) => b - a), [d]);
  const cells = useMemo(() => (d?.monthly ?? []).map((m) => ({ year: m.year, month: m.month, v: m.dep })), [d]);

  const ribbon = useMemo(() => {
    if (!season.data) return null;
    const idx = (md: string) => {
      const [m, dd] = md.split("-").map(Number);
      const start = Date.UTC(2001, 5, 1);
      return Math.round((Date.UTC(2001, m - 1, dd) - start) / 86400000);
    };
    return [
      { key: "normal", label: t.monsoon.ribbonNormal, color: "var(--monsoon-slate)", dash: "4 3", points: season.data.normal.map((p) => ({ x: idx(p.md), y: p.cum })) },
      { key: "actual", label: `${t.monsoon.ribbonActual} ${season.data.seasonYear}`, color: "var(--neer-teal)", points: season.data.actual.map((p) => ({ x: idx(p.md), y: p.cum })) },
    ];
  }, [season.data, t]);

  return (
    <div className="page">
      <header className="stack" style={{ maxWidth: 760 }}>
        <p className="annot">{d?.district ? `${d.district.name}, ${d.district.state}` : ""}</p>
        <h2>{t.monsoon.title}</h2>
      </header>

      {/* Scrollytelling: sticky chart + steps */}
      <section className="story">
        <div className="story__chart">
          <ChartFrame
            title={`${t.common.allIndia} · JJAS 1901–2015`}
            subtitle={t.monsoon.deficitYears}
            source="IMD sub-divisional monthly rainfall (data.gov.in), area-weighted by Neerakshi"
            loading={r.loading}
            error={r.error}
            onRetry={r.retry}
            about={{
              method: "June–September total of each IMD subdivision, weighted by the summed Census 2011 area of the districts it covers; departure from the 1951–2000 mean.",
              coverage: "36 subdivisions, 1901–2015. Years with < 90 % of area reporting are left out.",
              limitations: "Not IMD's official all-India series (which uses its own weights); the 1951–2000 mean here is 902 mm vs IMD's 890 mm LPA.",
            }}
            table={{ columns: [{ key: "x", label: t.common.year }, { key: "y", label: "%", numeric: true }], rows: valid }}
          >
            <DivergingBars data={india} yLabel="% vs 1951–2000" colorFor={storyColor} format={(p) => `${p.x}: ${pct(p.y)}`} label={t.monsoon.lead} />
          </ChartFrame>
        </div>
        <div className="story__steps">
          {steps.map((s, i) => (
            <div key={s.key} data-i={i} ref={(el) => void (refs.current[i] = el)} className="story__step card" data-active={i === step}>
              {"title" in s && s.title ? <h3 style={{ fontSize: "var(--step-1)" }}>{s.title}</h3> : null}
              <p className={i ? "num" : undefined}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <ChartFrame
          title={`${t.common.allIndia} · JJAS 1981–2025`}
          subtitle="IMD 0.25° gridded rainfall, state units area-weighted"
          source="IMD gridded rainfall aggregated to states (hssling/elnino-heat-india, CC BY 4.0)"
          loading={r.loading}
          about={{ method: "State-unit JJAS totals weighted by Census 2011 area; departure from the 1981–2010 mean.", coverage: "1981–2025; Andaman & Nicobar and Lakshadweep excluded." }}
          table={{ columns: [{ key: "x", label: t.common.year }, { key: "y", label: "%", numeric: true }], rows: grid.filter((g) => g.y !== null) }}
        >
          <DivergingBars data={grid} yLabel="% vs 1981–2010" colorFor={barColor} format={(p) => `${p.x}: ${pct(p.y)}`} label="All-India JJAS 1981–2025" />
        </ChartFrame>
        <ChartFrame
          title={fmt(t.monsoon.stateLead, { state: d?.district?.state ?? "" })}
          source="IMD gridded rainfall aggregated to states"
          loading={r.loading}
          empty={!r.loading && d && !d.state.length ? t.common.noDataHint : null}
          table={{ columns: [{ key: "year", label: t.common.year }, { key: "jjas", label: "JJAS mm", numeric: true }, { key: "dep", label: "%", numeric: true }], rows: d?.state ?? [] }}
        >
          <DivergingBars data={(d?.state ?? []).map((x) => ({ x: x.year, y: x.dep }))} yLabel="% vs 1981–2010" colorFor={barColor} format={(p) => `${p.x}: ${pct(p.y)}`} label={t.monsoon.stateTitle} />
        </ChartFrame>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <ChartFrame
          title={fmt(t.monsoon.heatmapTitle, { district: d?.district?.name ?? "" })}
          subtitle={`${t.monsoon.heatmapLead} (${d?.district?.subdivision ?? "—"})`}
          source="IMD sub-divisional monthly rainfall"
          loading={r.loading}
          empty={!r.loading && d && !cells.length ? t.common.noDataHint : null}
          about={{ method: "Monthly rainfall departure from the subdivision's own 1951–2000 monthly mean. Clamped to ±100 % for colour.", coverage: "1901–2015. Hatched cells are missing months." }}
        >
          <Heatmap
            cells={cells}
            years={years}
            monthLabels={t.months}
            colorFor={(v) => colorFor(RAMPS.monsoon, Math.max(-100, Math.min(100, v))) ?? "transparent"}
            format={(c) => `${t.months[c.month - 1]} ${c.year}: ${pct(c.v)}`}
            label={t.monsoon.heatmapLead}
          />
        </ChartFrame>
        <ChartFrame
          title={t.monsoon.ribbonTitle}
          subtitle={season.data && !season.data.inSeason ? t.monsoon.ribbonOff : t.monsoon.ribbonLead}
          source="Open-Meteo historical weather (ERA5 reanalysis), district centre point"
          loading={season.loading}
          error={season.error ? `${t.common.liveUnavailable} (${season.error})` : null}
          onRetry={season.retry}
          about={{
            method: "Cumulative daily rainfall from 1 June at the district's representative point, against the mean cumulative curve for the same dates in 1991–2020. Both from the same reanalysis, so they are comparable.",
            coverage: "ERA5 lags real time by about 5 days.",
            limitations: "A single point, not a district average, and reanalysis rather than rain gauges.",
          }}
        >
          {ribbon ? <LineChart series={ribbon} yLabel="mm since 1 Jun" format={(s, p) => `${s.label}: ${nf.format(p.y)} mm`} label={t.monsoon.ribbonTitle} /> : null}
        </ChartFrame>
      </div>
      <style>{`
        .story { display: grid; gap: 16px; margin-top: 16px; }
        .story__chart { position: sticky; top: calc(var(--topbar-h) + 8px); z-index: 1; }
        .story__steps { display: grid; gap: 50vh; padding: 20vh 0 30vh; }
        .story__step { max-width: 460px; margin-left: auto; opacity: .55; transition: opacity 250ms var(--ease); }
        .story__step[data-active="true"] { opacity: 1; border-color: var(--ink); }
        @media (min-width: 1000px) { .story { grid-template-columns: 1.6fr 1fr; } .story__steps { padding-top: 10vh; } }
      `}</style>
    </div>
  );
}
