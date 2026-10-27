"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Map as MLMap } from "maplibre-gl";
import { AtlasMap } from "./AtlasMap";
import { DistrictSheet } from "./DistrictSheet";
import { CompassRose, ScaleBar } from "@/components/art/Motifs";
import { ChartFrame, DataTable } from "@/components/charts/kit";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useDistrict } from "@/lib/client/district";
import { useJson } from "@/lib/client/useJson";
import { RAMPS, type RampKey } from "@/lib/shared/scales";

const LAYERS: RampKey[] = ["stress", "monsoon", "groundwater", "irrigation", "ndvi"];
type LayerResp = { layer: RampKey; years: number[]; year: number | null; values: { id: string; v: number | null; basis?: string | null }[] };

export function AtlasView() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { districtId, setDistrict, districts } = useDistrict();
  const layer = (LAYERS.includes(sp.get("layer") as RampKey) ? sp.get("layer") : "stress") as RampKey;
  const yearParam = sp.get("y") ? Number(sp.get("y")) : undefined;
  const [compare, setCompare] = useState(false);
  const [cmpYear, setCmpYear] = useState<number | undefined>(undefined);
  const [cmpLayer, setCmpLayer] = useState<RampKey>("monsoon");
  const [divider, setDivider] = useState(50);
  const [playing, setPlaying] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [leftMap, setLeftMap] = useState<MLMap | null>(null);
  const [pxPerKm, setPxPerKm] = useState(0.2);

  const setParams = useCallback(
    (kv: Record<string, string | null>) => {
      const q = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(kv)) {
        if (v === null) q.delete(k);
        else q.set(k, v);
      }
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  const setParam = useCallback((k: string, v: string | null) => setParams({ [k]: v }), [setParams]);

  const main = useJson<LayerResp>(`/api/atlas/layer?layer=${layer}${yearParam ? `&year=${yearParam}` : ""}`);
  const years = main.data?.years ?? [];
  const year = main.data?.year ?? null;
  const cmpQueryLayer = years.length ? layer : cmpLayer;
  const cmp = useJson<LayerResp>(compare ? `/api/atlas/layer?layer=${cmpQueryLayer}${years.length && cmpYear ? `&year=${cmpYear}` : ""}` : null);

  // Default compare year: the first year of the series
  useEffect(() => {
    if (compare && years.length && cmpYear === undefined) setCmpYear(years[Math.max(0, years.length - 21)] ?? years[0]);
  }, [compare, years, cmpYear]);

  // Play through years
  useEffect(() => {
    if (!playing || !years.length) return;
    const id = window.setInterval(() => {
      const i = years.indexOf(year ?? years[0]);
      const next = years[(i + 1) % years.length];
      setParam("y", String(next));
      if (i + 1 >= years.length) setPlaying(false);
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, years, year, setParam]);

  // Scale bar follows the map
  useEffect(() => {
    if (!leftMap) return;
    const upd = () => {
      const lat = leftMap.getCenter().lat;
      const mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** leftMap.getZoom());
      setPxPerKm(1000 / mpp);
    };
    upd();
    leftMap.on("move", upd);
    return () => {
      leftMap.off("move", upd);
    };
  }, [leftMap]);

  const ramp = RAMPS[layer];
  const values = main.data?.values ?? [];
  const noData = !main.loading && !main.error && values.filter((v) => v.v !== null).length === 0;
  const basis = useMemo(() => {
    const b = new Set(values.map((v) => v.basis).filter(Boolean) as string[]);
    if (layer === "monsoon" || layer === "stress") return [...b].map((x) => t.atlas.basis[x as keyof typeof t.atlas.basis] ?? x).join(", ");
    return null;
  }, [values, layer, t]);

  const byId = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);
  const tableRows = useMemo(
    () =>
      values
        .filter((v) => v.v !== null)
        .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
        .map((v) => ({ district: byId.get(v.id)?.name ?? v.id, state: byId.get(v.id)?.state ?? "", value: v.v })),
    [values, byId],
  );

  const onSelect = useCallback(
    (id: string) => {
      setDistrict(id);
      setSheetOpen(true);
    },
    [setDistrict],
  );

  const layerLabel = t.atlas.layer[layer];
  const legendTitle = layer === "stress" ? `${layerLabel} (0–100)` : layer === "monsoon" ? `${layerLabel}, JJAS ${year ?? ""} (%)` : layer === "groundwater" ? `${layerLabel}, pre-monsoon ${year ?? ""} (m bgl)` : layer === "irrigation" ? `${layerLabel} (%)` : `${layerLabel}`;

  return (
    <div className="atlas">
      <div className="atlas__bar">
        <div className="tabs" role="tablist" aria-label={t.atlas.layers}>
          {LAYERS.map((l) => (
            <button key={l} role="tab" className="tab" aria-selected={l === layer} onClick={() => setParams({ layer: l === "stress" ? null : l, y: null })}>
              {t.atlas.layer[l]}
            </button>
          ))}
        </div>
        <div className="atlas__controls row">
          {years.length ? (
            <>
              <button className="btn btn--sm btn--ghost" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
                {playing ? `❚❚ ${t.atlas.pause}` : `▶ ${t.atlas.play}`}
              </button>
              <label className="row atlas__year" style={{ gap: 8 }}>
                <span className="annot">{t.common.year}</span>
                <input type="range" min={years[0]} max={years[years.length - 1]} value={year ?? years[years.length - 1]} step={1} onChange={(e) => setParam("y", e.target.value)} aria-valuetext={String(year)} />
                <span className="num">{year}</span>
              </label>
            </>
          ) : null}
          <button className="btn btn--sm btn--ghost" aria-pressed={compare} onClick={() => setCompare((c) => !c)}>
            {compare ? t.atlas.compareOff : `⇆ ${t.atlas.compare}`}
          </button>
          <button className="btn btn--sm btn--ghost" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
            {showTable ? t.common.hideTable : t.common.showTable}
          </button>
        </div>
        {compare ? (
          <div className="row atlas__cmp" style={{ gap: 8 }}>
            <span className="annot">{t.atlas.compareRight}:</span>
            {years.length ? (
              <label className="row" style={{ gap: 6 }}>
                <input type="range" min={years[0]} max={years[years.length - 1]} value={cmpYear ?? years[0]} onChange={(e) => setCmpYear(Number(e.target.value))} aria-label={`${t.atlas.compareRight} ${t.common.year}`} />
                <span className="num">{cmpYear}</span>
              </label>
            ) : (
              <select className="select" value={cmpLayer} onChange={(e) => setCmpLayer(e.target.value as RampKey)} aria-label={`${t.atlas.compareRight} ${t.atlas.layer[layer]}`}>
                {LAYERS.filter((l) => l !== layer).map((l) => (
                  <option key={l} value={l}>
                    {t.atlas.layer[l]}
                  </option>
                ))}
              </select>
            )}
            <span className="annot">{t.atlas.compareHint}</span>
          </div>
        ) : null}
      </div>

      <div className="atlas__stage">
        <AtlasMap values={values} ramp={ramp} selected={districtId} onSelect={onSelect} onReady={setLeftMap} label={`${layerLabel} ${year ?? ""}`} />
        {compare ? (
          <div className="atlas__right" style={{ clipPath: `inset(0 0 0 ${divider}%)` }} aria-hidden>
            <AtlasMap values={cmp.data?.values ?? []} ramp={RAMPS[cmpQueryLayer]} selected={districtId} syncWith={leftMap} interactive={false} label="" />
            <div className="atlas__cmplabel annot" style={{ left: `calc(${divider}% + 8px)` }}>
              {years.length ? cmpYear : t.atlas.layer[cmpLayer]}
            </div>
          </div>
        ) : null}
        {compare ? (
          <input className="atlas__divider" type="range" min={5} max={95} value={divider} onChange={(e) => setDivider(Number(e.target.value))} aria-label={t.atlas.compareHint} style={{ ["--pos" as string]: `${divider}%` }} />
        ) : null}

        <div className="atlas__overlay atlas__compass" aria-hidden>
          <CompassRose size={58} />
        </div>
        <div className="atlas__overlay atlas__scale">
          <ScaleBar pxPerKm={pxPerKm} />
        </div>
        <aside className="atlas__legend card--plate card" aria-label={t.atlas.legend}>
          <p className="annot" style={{ margin: 0 }}>
            {t.atlas.legend}
          </p>
          <p style={{ margin: "2px 0 6px", fontWeight: 600, fontSize: ".85rem" }}>{legendTitle}</p>
          <div className="legend__ramp">
            {ramp.stops.map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </div>
          <div className="legend__ticks num">
            <span>{ramp.label(ramp.domain[0])}</span>
            <span>{ramp.label(ramp.domain[Math.floor(ramp.domain.length / 2)])}</span>
            <span>{ramp.label(ramp.domain[ramp.domain.length - 1])}</span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 6, fontSize: ".75rem" }}>
            <span className="legend__hatch" /> {t.atlas.nodata}
          </div>
          {basis ? <p className="annot" style={{ margin: "6px 0 0", textTransform: "none", letterSpacing: 0 }}>{fmt(t.atlas.basisNote, { basis })}</p> : null}
          {layer === "stress" ? <p style={{ margin: "6px 0 0", fontSize: ".72rem" }}>{t.atlas.stressFootnote}</p> : null}
        </aside>
        {noData ? (
          <div className="atlas__empty notice notice--info" role="status">
            <strong>{t.atlas.noLayerData}</strong> {layer === "irrigation" ? "ICRISAT District Level Database (manual download pending)." : layer === "ndvi" ? "District NDVI batch job not yet run." : ""}{" "}
            <Link href="/methods">{t.sections.methods.title}</Link>
          </div>
        ) : null}
        {main.error ? (
          <div className="atlas__empty notice" role="alert">
            {t.common.error} <button className="btn btn--sm btn--ghost" onClick={main.retry}>{t.common.retry}</button>
          </div>
        ) : null}
        <p className="atlas__hint annot">{t.atlas.tapDistrict}</p>
      </div>

      {showTable ? (
        <div className="page" style={{ paddingTop: 12 }}>
          <ChartFrame title={`${layerLabel}${year ? ` · ${year}` : ""}`} source={t.atlas.layer[layer]}>
            <DataTable
              caption={layerLabel}
              columns={[
                { key: "district", label: t.common.district },
                { key: "state", label: t.common.state },
                { key: "value", label: legendTitle, numeric: true, format: (v) => (v === null ? "—" : ramp.label(v as number)) },
              ]}
              rows={tableRows}
            />
          </ChartFrame>
        </div>
      ) : null}

      <DistrictSheet open={sheetOpen} onClose={() => setSheetOpen(false)} districtId={districtId} />
      <style>{`
        .atlas { display: flex; flex-direction: column; }
        .atlas__bar { padding: 8px 12px 0; background: var(--paper); border-bottom: 1px solid var(--hairline); }
        .atlas__controls { padding: 8px 0; gap: 8px; }
        .atlas__year input { width: min(46vw, 260px); }
        .atlas__cmp { padding-bottom: 8px; }
        .atlas__stage { position: relative; height: calc(100dvh - var(--topbar-h) - 120px); min-height: 420px; }
        .atlas-map, .atlas__right { position: absolute; inset: 0; }
        .atlas__right { pointer-events: none; }
        .atlas-map__canvas { position: absolute; inset: 0; }
        .atlas-map__skeleton { position: absolute; inset: 0; border-radius: 0; }
        .atlas__divider { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; z-index: 3; margin: 0; }
        .atlas__stage:has(.atlas__divider)::after { content: ""; position: absolute; top: 0; bottom: 0; left: var(--div, 50%); }
        .atlas__cmplabel { position: absolute; top: 8px; background: var(--paper-light); padding: 2px 6px; border: 1px solid var(--ink); }
        .atlas__overlay { position: absolute; pointer-events: none; z-index: 2; }
        .atlas__compass { top: 10px; left: 10px; }
        .atlas__scale { left: 10px; bottom: 10px; }
        .atlas__legend { position: absolute; z-index: 2; right: 10px; bottom: 28px; width: 210px; padding: 10px 12px; font-size: .8rem; }
        .legend__ramp { display: flex; height: 12px; border: 1px solid var(--ink); }
        .legend__ramp span { flex: 1; }
        .legend__ticks { display: flex; justify-content: space-between; font-size: .7rem; }
        .legend__hatch { width: 18px; height: 12px; border: 1px solid var(--ink); background: repeating-linear-gradient(45deg, transparent 0 4px, var(--monsoon-slate) 4px 5px); display: inline-block; }
        .atlas__empty { position: absolute; z-index: 3; left: 50%; top: 40%; transform: translate(-50%, -50%); max-width: 360px; }
        .atlas__hint { position: absolute; z-index: 2; top: 12px; left: 50%; transform: translateX(-50%); background: var(--paper-light); padding: 2px 8px; border: 1px solid var(--hairline); border-radius: 999px; }
        @media (max-width: 640px) { .atlas__legend { width: 170px; bottom: 44px; } .atlas__hint { display: none; } }
        .maplibregl-ctrl-group { background: var(--paper-light) !important; border: 1px solid var(--ink); box-shadow: none !important; }
      `}</style>
    </div>
  );
}
