"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useDistrict, useSharedQuery } from "@/lib/client/district";
import { store, useJson } from "@/lib/client/useJson";
import { DistrictPicker } from "@/components/DistrictPicker";
import { AtlasArt, AquiferArt, DawnArt, FieldArt, MonsoonArt, OrbitArt, ReflectionArt, SensingArt, SoilArt } from "./acts";
import { FieldNote, Sparkline } from "./FieldNote";
import { useJourneyLive } from "./useJourneyLive";
import { ndviLeafTint } from "@/lib/shared/scales";
import { LOCALE_BCP47 } from "@/lib/i18n/config";
import { SEEN_KEY, ALTITUDES } from "./constants";
import "./journey.css";

/**
 * prefers-reduced-motion: the descent becomes nine illustrated chapters that
 * cross-fade on tap (Next / Previous) or keyboard, with every caption and live number.
 */
export function ReducedJourney() {
  const { t, locale } = useI18n();
  const q = useSharedQuery();
  const { district, districtId, districts } = useDistrict();
  const [i, setI] = useState(0);
  const [picker, setPicker] = useState(false);
  const live = useJourneyLive(district, districtId, districts, 8, { ndvi: t.journey.act6None, none: t.common.noDataHint });
  const stress = useJson<{ values: { id: string; v: number | null }[] }>("/api/atlas/layer?layer=stress");
  const stressMap = useMemo(() => new Map((stress.data?.values ?? []).map((x) => [x.id, x.v])), [stress.data]);
  const nf = new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 1 });
  const dtf = new Intl.DateTimeFormat(LOCALE_BCP47[locale], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const name = district?.name ?? "…";
  const lights = districts.map((d) => ({ lat: d.lat, lon: d.lon }));
  const chapters = [
    { bg: "night", art: <OrbitArt lights={lights} eyeOpen={1} />, note: <FieldNote dark source={t.journey.sourceCelestrak} title={t.journey.act1Title} body={t.journey.act1Body} label={t.journey.act1Live} live={live.position} render={(v) => v} onRetry={live.retryTle} /> },
    { bg: "night", art: <SensingArt />, note: <FieldNote dark source={t.journey.act2Source} title={t.journey.act2Title} body={t.journey.act2Body} label={fmt(t.journey.act2Live, { district: name })} live={live.nextPass} render={(d) => (d ? dtf.format(d) : t.journey.act2LiveNone)}><p className="mono jn-formula">{t.journey.act2Formula}</p></FieldNote> },
    { bg: "dawn", art: <DawnArt />, note: <FieldNote source={t.journey.sourceOpenMeteo} title={t.journey.act3Title} body={t.journey.act3Body} label={`${t.journey.act3Live} · ${name}`} live={live.et0} render={(v) => `${nf.format(v)} mm`} onRetry={live.retryEt0} /> },
    { bg: "storm", art: <MonsoonArt />, note: <FieldNote source={t.journey.sourceImdState} title={t.journey.act4Title} body={t.journey.act4Body} label={t.journey.act4Live} live={live.monsoon} render={(v) => <>{v.latest.departurePct !== null ? `${v.latest.departurePct > 0 ? "+" : ""}${nf.format(v.latest.departurePct)}% (${v.latest.year})` : "—"}<Sparkline label="30 years" values={v.last30.map((x) => ({ x: x.year, y: x.departurePct }))} /></>} onRetry={live.summary.retry} /> },
    { bg: "paper", art: <AtlasArt stress={stressMap} chosen={districtId} enabled />, note: <FieldNote source={t.journey.sourceStress} title={t.journey.act5Title} body={t.journey.act5Body} label={`${t.journey.act5Live} · ${name}`} live={live.stress} render={(v) => `${nf.format(v.stressIndex0100!)}/100`} onRetry={live.summary.retry} /> },
    { bg: "paper", art: <FieldArt tint={live.ndvi.status === "ok" && live.ndvi.value.ndviMedian !== null ? ndviLeafTint(live.ndvi.value.ndviMedian) : "var(--leaf-olive)"} />, note: <FieldNote source="Sentinel-2" title={t.journey.act6Title} body={t.journey.act6Body} label={t.journey.act6Live} live={live.ndvi} render={(v) => `${v.ndviMedian?.toFixed(2)}`} /> },
    { bg: "soil", art: <SoilArt labels={t.journey.act7Labels} />, note: <FieldNote source="FAO-56" title={t.journey.act7Title} body={t.journey.act7Body} label={t.journey.act7Live} live={live.et0.status === "ok" ? { status: "ok", value: live.et0.value * 1.2 } : live.et0} render={(v) => `ETc ≈ ${nf.format(v)} mm`} onRetry={live.retryEt0} /> },
    { bg: "deep", art: <AquiferArt depthM={live.gw.status === "ok" ? live.gw.value.medianDepthMbgl : null} />, note: <FieldNote dark source={t.journey.sourceCgwb} title={t.journey.act8Title} body={t.journey.act8Body} label={t.journey.act8Live} live={live.gw} render={(v) => `${v.medianDepthMbgl !== null ? nf.format(v.medianDepthMbgl) : "—"} m (${v.year})`} onRetry={live.summary.retry} /> },
    { bg: "refl", art: <ReflectionArt />, note: null },
  ];
  const c = chapters[i];
  return (
    <main id="main" className="jr" onKeyDown={(e) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(8, x + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1));
    }}>
      <div className={`jn-sky jn-sky--${c.bg}`} />
      <div className="jr-art" key={`a${i}`}>{c.art}</div>
      <div className="jr-panel">
        <p className="annot" style={{ color: "inherit" }}>{ALTITUDES[i]} · {i + 1}/9</p>
        {i === 0 ? <h1 className="jr-title">NEERAKSHI</h1> : null}
        <div key={`n${i}`} className="jr-note">{c.note}</div>
        {i === 8 ? (
          <div className="jn-arrive" style={{ position: "static" }}>
            <h2>{t.journey.act9Title}</h2>
            <p>{t.journey.act9Body}</p>
            <div className="row">
              <Link className="btn btn--teal" href={`/atlas${q}`} onClick={() => store.set(SEEN_KEY, "1")}>{t.journey.exploreAtlas}</Link>
              <Link className="btn" href={`/field${q}`} onClick={() => store.set(SEEN_KEY, "1")}>{t.journey.checkField}</Link>
            </div>
          </div>
        ) : null}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn--ghost" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>← {t.field.prev}</button>
          <button className="btn" onClick={() => setI((x) => Math.min(8, x + 1))} disabled={i === 8}>{t.field.next} →</button>
          <button className="btn btn--ghost" onClick={() => setPicker(true)}>{t.common.changeDistrict}</button>
          <Link className="btn btn--ghost" href={`/atlas${q}`} onClick={() => store.set(SEEN_KEY, "1")}>{t.common.skipToAtlas}</Link>
        </div>
      </div>
      <DistrictPicker open={picker} onClose={() => setPicker(false)} />
    </main>
  );
}
