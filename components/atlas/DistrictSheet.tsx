"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useJson } from "@/lib/client/useJson";
import { MiniTrend } from "@/components/charts/kit";
import type { Summary } from "@/components/journey/useJourneyLive";

type Trends = {
  rain: { year: number; v: number | null; basis: string }[];
  gw: { year: number; season: string; v: number | null; change: number | null; n: number }[];
  crops: { year: number; crop: string; area: number; prod: number | null }[];
};

/** Bottom sheet (mobile) / side panel (desktop) with a district's components, ranks and mini trends. */
export function DistrictSheet({ open, onClose, districtId }: { open: boolean; onClose: () => void; districtId: string }) {
  const { t } = useI18n();
  const r = useJson<Summary & { trends: Trends; district: Summary["district"] & { subdivision: string | null } }>(open ? `/api/atlas/district/${districtId}?trends=1` : null);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const d = r.data;
  const s = d?.stress;
  const comp = (label: string, score: number | null | undefined, raw: string) => (
    <div className="comp">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>{label}</span>
        <span className="num">{score === null || score === undefined ? t.atlas.componentMissing : `${Math.round(score * 100)}/100`}</span>
      </div>
      <div className="comp__bar" aria-hidden>
        <span style={{ width: `${(score ?? 0) * 100}%`, background: score === null || score === undefined ? "transparent" : "var(--laterite)" }} />
      </div>
      <p className="annot" style={{ margin: "2px 0 0", textTransform: "none", letterSpacing: 0 }}>{raw}</p>
    </div>
  );
  const crops = d?.trends?.crops ?? [];
  const rice = crops.filter((c) => c.crop === "rice").map((c) => ({ x: c.year, y: c.prod === null ? null : c.prod / 1000 }));
  const topCrop = ["rice", "wheat", "maize", "sugarcane"].map((c) => ({ c, n: crops.filter((x) => x.crop === c && x.prod).length })).sort((a, b) => b.n - a.n)[0]?.c ?? "rice";
  const cropSeries = crops.filter((c) => c.crop === topCrop).map((c) => ({ x: c.year, y: c.prod === null ? null : c.prod / 1000 }));

  return (
    <div
      ref={ref}
      className="sheet"
      data-open={open}
      role="dialog"
      aria-modal="false"
      aria-label={d ? `${d.district.name}, ${d.district.state}` : t.common.district}
      tabIndex={-1}
      style={drag.current ? { transform: `translateY(${Math.max(0, drag.current.dy)}px)`, transition: "none" } : undefined}
    >
      <button
        className="sheet__handle"
        aria-label={t.common.close}
        onClick={onClose}
        onPointerDown={(e) => {
          drag.current = { y0: e.clientY, dy: 0 };
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          drag.current.dy = e.clientY - drag.current.y0;
          if (ref.current) ref.current.style.transform = `translateY(${Math.max(0, drag.current.dy)}px)`;
        }}
        onPointerUp={() => {
          const dy = drag.current?.dy ?? 0;
          drag.current = null;
          if (ref.current) ref.current.style.transform = "";
          if (dy > 80) onClose();
        }}
      />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p className="annot" style={{ margin: 0 }}>{d?.district.state ?? "…"}</p>
          <h2 style={{ fontSize: "var(--step-2)", margin: 0 }}>{d?.district.name ?? "…"}</h2>
        </div>
        <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>
      </div>
      {r.loading ? <div className="skeleton" style={{ height: 260, marginTop: 12 }} /> : null}
      {r.error ? (
        <p className="notice" role="alert">
          {t.common.error} <button className="btn btn--ghost btn--sm" onClick={r.retry}>{t.common.retry}</button>
        </p>
      ) : null}
      {d ? (
        <div className="stack" style={{ ["--stack" as string]: "14px", marginTop: 10 }}>
          <div className="card" style={{ padding: 12 }}>
            <p className="annot" style={{ margin: 0 }}>{t.atlas.layer.stress}</p>
            <p className="num" style={{ fontSize: "var(--step-3)", margin: "0 0 4px" }}>{s?.stressIndex0100 !== null && s?.stressIndex0100 !== undefined ? `${s.stressIndex0100}/100` : "—"}</p>
            {s ? (
              <p style={{ margin: 0, fontSize: ".85rem" }}>
                {t.atlas.rankNational}: <span className="num">{s.rankNational ?? "—"}</span> / {s.total} · {t.atlas.rankState}: <span className="num">{s.rankState ?? "—"}</span> / {s.stateTotal}
              </p>
            ) : null}
            <p style={{ margin: "6px 0 0", fontSize: ".72rem" }}>{t.atlas.stressFootnote}</p>
          </div>
          <div>
            <h3 style={{ fontSize: "var(--step-1)" }}>{t.atlas.componentScores}</h3>
            {comp(t.atlas.components.rain, s?.rainScore, s?.rainDeparture5yPct !== null && s?.rainDeparture5yPct !== undefined ? `JJAS ${s.rainPeriod}: ${s.rainDeparture5yPct > 0 ? "+" : ""}${s.rainDeparture5yPct}% · ${t.atlas.basis[(s.rainBasis ?? "imd_grid_state") as keyof typeof t.atlas.basis] ?? s.rainBasis}` : "—")}
            {comp(t.atlas.components.gw, s?.gwScore, s?.gwDepthMbgl !== null && s?.gwDepthMbgl !== undefined ? `${s.gwDepthMbgl} m bgl (${s.gwYear}, pre-monsoon)` : "—")}
            {comp(t.atlas.components.irrigation, s?.irrigationScore, s?.irrigatedSharePct !== null && s?.irrigatedSharePct !== undefined ? `${s.irrigatedSharePct}%` : t.atlas.componentMissing)}
          </div>
          <div>
            <h3 style={{ fontSize: "var(--step-1)" }}>{t.atlas.trends}</h3>
            <p className="annot" style={{ margin: "8px 0 0" }}>{t.atlas.layer.monsoon} (%)</p>
            <MiniTrend points={(d.trends?.rain ?? []).map((x) => ({ x: x.year, y: x.v }))} color="var(--neer-teal)" label={t.atlas.layer.monsoon} unit="%" />
            <p className="annot" style={{ margin: "8px 0 0" }}>{t.atlas.layer.groundwater} (m, pre-monsoon)</p>
            <MiniTrend points={(d.trends?.gw ?? []).filter((x) => x.season === "pre_monsoon").map((x) => ({ x: x.year, y: x.v }))} color="var(--soil-ochre)" label={t.atlas.layer.groundwater} invert unit=" m" />
            <p className="annot" style={{ margin: "8px 0 0" }}>{t.crops[topCrop as keyof typeof t.crops]} (’000 t)</p>
            <MiniTrend points={cropSeries.length ? cropSeries : rice} color="var(--leaf-olive)" label={t.crops[topCrop as keyof typeof t.crops]} />
          </div>
          <Link className="btn btn--teal" href={`/field?d=${d.district.id}&lat=${d.district.lat}&lon=${d.district.lon}`}>
            {t.atlas.openAdvisor} →
          </Link>
        </div>
      ) : null}
      <style>{`
        .comp { margin: 8px 0 10px; font-size: .88rem; }
        .comp__bar { height: 8px; border: 1px solid var(--ink); margin-top: 3px; background: repeating-linear-gradient(45deg, transparent 0 4px, var(--grid) 4px 5px); }
        .comp__bar span { display: block; height: 100%; }
      `}</style>
    </div>
  );
}
