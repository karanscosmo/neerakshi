"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useDistrict } from "@/lib/client/district";
import { useJson } from "@/lib/client/useJson";
import { ChartFrame, LineChart, RankBars, Scatter } from "@/components/charts/kit";
import { CropPlate } from "@/components/art/CropPlate";
import { RAMPS, colorFor } from "@/lib/shared/scales";
import { LOCALE_BCP47 } from "@/lib/i18n/config";

const CROPS = ["rice", "wheat", "maize", "sugarcane"] as const;
type Crop = (typeof CROPS)[number];
type Scope = "india" | "state" | "district";
type Resp = {
  range: { min: number; max: number };
  y0: number;
  y1: number;
  district: { id: string; name: string; state: string } | null;
  series: { year: number; areaHa: number; productionT: number | null; productionCoveragePct: number | null; yieldTPerHa: number | null }[];
  scatter: { id: string; name: string; year: number; yield: number; dep: number | null; basis: string; irr: number | null }[];
  top: { id: string; name: string; state: string; yield: number; n: number }[];
  states: { year: number; rows: { state: string; prod: number }[] };
};
const SOURCE = "District-wise, season-wise crop production (APY), DES MoA&FW, 1997–2022";

export function CropsView() {
  const { t, locale } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { districtId } = useDistrict();
  const crop = (CROPS.includes(sp.get("crop") as Crop) ? sp.get("crop") : "rice") as Crop;
  const scope = (["india", "state", "district"].includes(sp.get("scope") ?? "") ? sp.get("scope") : "state") as Scope;
  const y0 = sp.get("y0");
  const y1 = sp.get("y1");
  const set = useCallback(
    (kv: Record<string, string | null>) => {
      const q = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(kv)) (v === null ? q.delete(k) : q.set(k, v));
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  const r = useJson<Resp>(`/api/atlas/crops?crop=${crop}&scope=${scope}&d=${districtId}${y0 ? `&y0=${y0}` : ""}${y1 ? `&y1=${y1}` : ""}`);
  const d = r.data;
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 2 }), [locale]);
  const cropName = t.crops[crop];
  const areaName = scope === "india" ? t.common.allIndia : scope === "state" ? (d?.district?.state ?? "") : (d?.district?.name ?? "");
  const series = d?.series ?? [];
  const inRange = series.filter((x) => (!d || (x.year >= d.y0 && x.year <= d.y1)));
  const lowCov = inRange.filter((x) => (x.productionCoveragePct ?? 100) < 95).map((x) => x.year);
  const hasIrr = (d?.scatter ?? []).some((p) => p.irr !== null);
  const years = d ? Array.from({ length: d.range.max - d.range.min + 1 }, (_, i) => d.range.min + i) : [];

  return (
    <div className="page">
      <header style={{ maxWidth: 760 }}>
        <h2>{t.cropsPage.title}</h2>
      </header>
      <div className="crop-cards" role="radiogroup" aria-label={t.cropsPage.pickCrop}>
        {CROPS.map((c) => (
          <button key={c} role="radio" aria-checked={c === crop} className="crop-card card" onClick={() => set({ crop: c })}>
            <CropPlate crop={c} size={120} />
            <span>{t.crops[c]}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ margin: "12px 0" }}>
        <div className="row" role="group" aria-label={t.common.district} style={{ gap: 6 }}>
          {(["india", "state", "district"] as Scope[]).map((s) => (
            <button key={s} className="chip" aria-pressed={s === scope} onClick={() => set({ scope: s })}>
              {s === "india" ? t.common.allIndia : s === "state" ? (d?.district?.state ?? t.common.state) : (d?.district?.name ?? t.common.district)}
            </button>
          ))}
        </div>
        {d ? (
          <div className="row" style={{ gap: 6 }}>
            <label className="row" style={{ gap: 4 }}>
              <span className="annot">{t.common.from}</span>
              <select className="select" value={d.y0} onChange={(e) => set({ y0: e.target.value })}>
                {years.filter((y) => y <= d.y1).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="row" style={{ gap: 4 }}>
              <span className="annot">{t.common.to}</span>
              <select className="select" value={d.y1} onChange={(e) => set({ y1: e.target.value })}>
                {years.filter((y) => y >= d.y0).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <ChartFrame
        title={fmt(t.cropsPage.trendTitle, { crop: cropName, area: areaName })}
        subtitle={t.cropsPage.yieldExplain}
        source={SOURCE}
        loading={r.loading}
        error={r.error}
        onRetry={r.retry}
        empty={!r.loading && d && !inRange.length ? t.common.noDataHint : null}
        about={{
          method: "Seasons and districts summed. Production sums rows that report it; yield = that production ÷ the area of the same rows. Districts created after 2011 are included in their 2011 parent.",
          coverage: `${d?.range.min ?? 1997}–${d?.range.max ?? 2022}.${lowCov.length ? ` Years where < 95 % of area reported production: ${lowCov.join(", ")}.` : ""}`,
          limitations: "Rice is reported as rice, not paddy. Early years miss some states.",
        }}
        table={{
          columns: [
            { key: "year", label: t.common.year },
            { key: "areaHa", label: `${t.cropsPage.area} (ha)`, numeric: true, format: (v) => (v === null ? "—" : nf.format(v as number)) },
            { key: "productionT", label: `${t.cropsPage.production} (t)`, numeric: true, format: (v) => (v === null ? "—" : nf.format(v as number)) },
            { key: "yieldTPerHa", label: `${t.cropsPage.yield} (t/ha)`, numeric: true },
            { key: "productionCoveragePct", label: "% area reported", numeric: true },
          ],
          rows: inRange,
        }}
      >
        <div className="trio">
          <div>
            <p className="annot">{t.cropsPage.production} (Mt)</p>
            <LineChart height={180} series={[{ key: "p", label: t.cropsPage.production, color: "var(--soil-ochre)", points: inRange.map((x) => ({ x: x.year, y: x.productionT === null ? null : x.productionT / 1e6 })) }]} yLabel="Mt" format={(s, p) => `${nf.format(p.y)} Mt`} label={t.cropsPage.production} />
          </div>
          <div>
            <p className="annot">{t.cropsPage.area} (Mha)</p>
            <LineChart height={180} series={[{ key: "a", label: t.cropsPage.area, color: "var(--monsoon-slate)", points: inRange.map((x) => ({ x: x.year, y: x.areaHa / 1e6 })) }]} yLabel="Mha" format={(s, p) => `${nf.format(p.y)} Mha`} label={t.cropsPage.area} />
          </div>
          <div>
            <p className="annot">{t.cropsPage.yield} (t/ha)</p>
            <LineChart height={180} series={[{ key: "y", label: t.cropsPage.yield, color: "var(--leaf-olive)", points: inRange.map((x) => ({ x: x.year, y: x.yieldTPerHa })) }]} yLabel="t/ha" format={(s, p) => `${nf.format(p.y)} t/ha`} label={t.cropsPage.yield} />
          </div>
        </div>
      </ChartFrame>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <ChartFrame
          title={`${t.cropsPage.scatterTitle} · ${d?.district?.state ?? ""}`}
          subtitle={<>{hasIrr ? t.cropsPage.scatterLead : t.cropsPage.scatterNoIrr} <strong>{t.common.correlationNote}</strong></>}
          source={`${SOURCE}; IMD JJAS departure`}
          loading={r.loading}
          empty={!r.loading && d && !d.scatter.length ? t.common.noDataHint : null}
          about={{
            method: "Each dot: one district in one year — annual yield against that year's June–September rainfall departure.",
            coverage: "District rainfall is the IMD subdivision value up to 2015 and the state (IMD grid) value after; the two use different normals (1951–2000 and 1981–2010).",
            limitations: "Association only. Irrigation, prices, pests and many other factors drive yield.",
          }}
          table={{ columns: [{ key: "name", label: t.common.district }, { key: "year", label: t.common.year }, { key: "yield", label: "t/ha", numeric: true, format: (v) => nf.format(v as number) }, { key: "dep", label: "% JJAS", numeric: true }], rows: d?.scatter ?? [] }}
        >
          <Scatter
            points={(d?.scatter ?? []).filter((p) => p.dep !== null).map((p) => ({ x: p.dep!, y: p.yield, c: p.irr, key: `${p.id}-${p.year}` }))}
            xLabel="JJAS departure (%) →"
            yLabel={`${t.cropsPage.yield} (t/ha)`}
            colorFor={hasIrr ? (c) => colorFor(RAMPS.irrigation, c ?? null) ?? "transparent" : undefined}
            format={(p) => {
              const s = d!.scatter.find((x) => `${x.id}-${x.year}` === p.key);
              return `${s?.name} ${s?.year}: ${nf.format(p.y)} t/ha, ${p.x > 0 ? "+" : ""}${nf.format(p.x)}%`;
            }}
            label={t.cropsPage.scatterTitle}
          />
        </ChartFrame>
        <div className="stack">
          <ChartFrame title={fmt(t.cropsPage.rankTitle, { from: d?.y0 ?? "", to: d?.y1 ?? "" })} source={SOURCE} loading={r.loading} about={{ method: "Mean of annual yields (production ÷ area); districts with ≥ 5 reported years.", coverage: `${d?.y0}–${d?.y1}` }}>
            <RankBars rows={(d?.top ?? []).map((x) => ({ key: x.id, label: `${x.name}, ${x.state}`, v: x.yield }))} format={(v) => `${nf.format(v)} t/ha`} color="var(--leaf-olive)" label={t.cropsPage.rankTitle} />
          </ChartFrame>
          <ChartFrame title={fmt(t.cropsPage.stateRankTitle, { year: d?.states.year ?? "" })} source={SOURCE} loading={r.loading}>
            <RankBars rows={(d?.states.rows ?? []).map((x) => ({ key: x.state, label: x.state, v: x.prod / 1e6 }))} format={(v) => `${nf.format(v)} Mt`} color="var(--soil-ochre)" label={t.cropsPage.stateRankTitle} />
          </ChartFrame>
        </div>
      </div>
      <style>{`
        .crop-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .crop-card { display: grid; justify-items: center; gap: 4px; padding: 8px; cursor: pointer; transition: transform 160ms var(--ease), border-color 200ms; }
        .crop-card svg { width: 100%; height: auto; max-width: 140px; }
        .crop-card:active { transform: scale(.97); }
        .crop-card[aria-checked="true"] { border: 2px solid var(--ink); background: var(--paper-deep); }
        .crop-card span { font-weight: 600; font-size: .9rem; text-align: center; }
        .trio { display: grid; gap: 12px; grid-template-columns: 1fr; }
        @media (min-width: 900px) { .trio { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </div>
  );
}
