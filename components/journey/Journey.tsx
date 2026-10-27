"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useDistrict, useSharedQuery } from "@/lib/client/district";
import { store, useJson } from "@/lib/client/useJson";
import { Logo } from "@/components/Logo";
import { DistrictPicker } from "@/components/DistrictPicker";
import { AtlasArt, AquiferArt, DawnArt, FieldArt, MonsoonArt, OrbitArt, ReflectionArt, SensingArt, SoilArt } from "./acts";
import { FieldNote, Sparkline } from "./FieldNote";
import { SkyCanvas, type SkyData } from "./skyCanvas";
import { useJourneyLive } from "./useJourneyLive";
import { Ambience } from "./ambience";
import { ReducedJourney } from "./ReducedJourney";
import { ndviLeafTint } from "@/lib/shared/scales";
import { LOCALE_BCP47 } from "@/lib/i18n/config";
import "./journey.css";

import { ACTS, ALTITUDES, SEEN_KEY } from "./constants";

function usePrefersReducedMotion() {
  const [r, setR] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

export function Journey() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const q = useSharedQuery();
  const reduced = usePrefersReducedMotion();
  const replay = sp.get("replay") === "1";
  const [ready, setReady] = useState(false);

  // Returning visitors land directly in the app (unless they asked to replay).
  useEffect(() => {
    if (!replay && store.get(SEEN_KEY)) router.replace(`/hub${q}`);
    else setReady(true);
  }, [replay, router, q]);

  if (!ready || reduced === null) return <div className="jn-boot" aria-busy="true" />;
  return reduced ? <ReducedJourney /> : <ScrollJourney t={t} locale={locale} />;
}

function ScrollJourney({ t, locale }: { t: ReturnType<typeof useI18n>["t"]; locale: ReturnType<typeof useI18n>["locale"] }) {
  const { district, districtId, districts, isDefault } = useDistrict();
  const q = useSharedQuery();
  const [act, setAct] = useState(0);
  const [maxAct, setMaxAct] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chooserDismissed, setChooserDismissed] = useState(false);
  const [eyeOpen, setEyeOpen] = useState(0);
  const [sound, setSound] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<SkyCanvas | null>(null);
  const ambRef = useRef<Ambience | null>(null);
  const progressRef = useRef(0);
  const markerRef = useRef<HTMLDivElement>(null);
  const vibrated = useRef(false);
  const skyData = useJson<SkyData>("/data/sky.json");

  const live = useJourneyLive(district, districtId, districts, maxAct, { ndvi: t.journey.act6None, none: t.common.noDataHint });
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 1 }), [locale]);
  const dtf = useMemo(() => new Intl.DateTimeFormat(LOCALE_BCP47[locale], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }), [locale]);

  // Eye slowly opens on load
  useEffect(() => {
    const id = window.setTimeout(() => setEyeOpen(1), 400);
    return () => window.clearTimeout(id);
  }, []);

  // Sky canvas (one instance; recreated if React remounts the effect)
  const latLon = useRef({ lat: 12.6, lon: 76.7 });
  latLon.current = { lat: district?.lat ?? 12.6, lon: district?.lon ?? 76.7 };
  useEffect(() => {
    if (!canvasRef.current) return;
    const sky = new SkyCanvas(canvasRef.current, null, latLon.current.lat, latLon.current.lon);
    skyRef.current = sky;
    sky.start();
    return () => {
      sky.destroy();
      skyRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (district) skyRef.current?.setLocation(district.lat, district.lon);
  }, [district]);
  useEffect(() => {
    if (skyData.data) skyRef.current?.setSky(skyData.data);
  }, [skyData.data]);

  // GSAP scroll timeline (transform + opacity only)
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const root = rootRef.current!;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "none" } });
      const L = (i: number) => root.querySelector(`[data-layer="${i}"]`);
      const A = (name: string) => root.querySelectorAll(`[data-anim="${name}"]`);
      for (let i = 0; i < ACTS; i++) {
        const el = L(i);
        if (!el) continue;
        if (i > 0) tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, i - 0.35);
        if (i < ACTS - 1) tl.to(el, { autoAlpha: 0, duration: 0.35 }, i + 0.65);
      }
      // Sky gradients: night → dawn → overcast → paper → soil → deep → reflection
      const skies: [string, number, number][] = [
        ["night", -1, 1.65],
        ["dawn", 1.65, 2.65],
        ["storm", 2.65, 4.4],
        ["paper", 4.4, 5.65],
        ["soil", 5.65, 6.65],
        ["deep", 6.65, 7.65],
        ["refl", 7.65, 10],
      ];
      for (const [name, a, b] of skies) {
        const el = root.querySelector(`[data-sky="${name}"]`);
        if (!el) continue;
        if (a >= 0) tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, a - 0.35);
        if (b < 9) tl.to(el, { autoAlpha: 0, duration: 0.35 }, b);
      }
      // Act 1: title rises away
      tl.to(A("title"), { yPercent: -60, autoAlpha: 0, duration: 0.6 }, 0.35);
      // Act 2: swath sweeps, bands peel apart and recombine into NDVI
      tl.fromTo(A("swath"), { x: -100 }, { x: 1100, duration: 0.9 }, 0.9);
      tl.fromTo(A("band-red"), { x: 115, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.3 }, 1.0);
      tl.fromTo(A("band-nir"), { x: -115, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.3 }, 1.0);
      tl.to(A("band-red"), { x: 115, autoAlpha: 0, duration: 0.25 }, 1.45);
      tl.to(A("band-nir"), { x: -115, autoAlpha: 0, duration: 0.25 }, 1.45);
      tl.fromTo(A("band-ndvi"), { scale: 0.4, autoAlpha: 0, transformOrigin: "50% 50%" }, { scale: 1, autoAlpha: 1, duration: 0.25 }, 1.6);
      // Act 3: sun rises
      tl.fromTo(A("sun"), { y: 260 }, { y: -80, duration: 1 }, 1.7);
      // Act 4: parallax clouds pass upward
      tl.fromTo(A("cloud-far"), { yPercent: 40 }, { yPercent: -60, duration: 1.4 }, 2.6);
      tl.fromTo(A("cloud-mid"), { yPercent: 90 }, { yPercent: -110, duration: 1.4 }, 2.6);
      tl.fromTo(A("cloud-near"), { yPercent: 160 }, { yPercent: -200, duration: 1.4 }, 2.6);
      // Act 5: map unfolds along its folds, wash soaks in
      tl.fromTo(A("fold1"), { scaleY: 0 }, { scaleY: 1, duration: 0.3 }, 3.8);
      tl.fromTo(A("fold2"), { scaleY: 0 }, { scaleY: 1, duration: 0.3 }, 3.95);
      tl.fromTo(A("fold3"), { scaleY: 0 }, { scaleY: 1, duration: 0.3 }, 4.1);
      tl.fromTo(A("wash"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 4.2);
      tl.fromTo(A("marker"), { autoAlpha: 0, scale: 1.6, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.2 }, 4.45);
      // Act 7: the bucket drains (ETc) and refills (rain / irrigation)
      tl.fromTo(A("water"), { scaleY: 0.95 }, { scaleY: 0.38, duration: 0.45 }, 5.8);
      tl.to(A("water"), { scaleY: 0.9, duration: 0.35 }, 6.3);
      // Act 9: eye grows into the dial
      tl.fromTo(A("eye"), { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6 }, 7.9);

      ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        animation: tl,
        onUpdate: (self) => {
          const p = self.progress;
          progressRef.current = p;
          const a = Math.min(ACTS - 1, Math.floor(p * ACTS + 0.12));
          setAct(a);
          setMaxAct((m) => Math.max(m, a));
          if (markerRef.current) markerRef.current.style.transform = `translateY(${p * 100}cqh)`;
          const sky = skyRef.current;
          if (sky) {
            sky.starAlpha = Math.max(0, 1 - p * ACTS * 0.7);
            const r = p * ACTS;
            sky.rain = r > 2.9 && r < 4.6 ? Math.min(1, (r - 2.9) * 2, (4.6 - r) * 2.5) : 0;
          }
          if (!vibrated.current && p * ACTS > 4.4) {
            vibrated.current = true;
            if ("vibrate" in navigator) navigator.vibrate?.(18);
          }
          if (p > 0.97) store.set(SEEN_KEY, "1");
        },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  // Ambient sound follows the act
  useEffect(() => {
    const amb = ambRef.current;
    if (!sound || !amb) return;
    amb.set(act <= 1 ? 0.6 : act <= 4 ? 0.35 : 0.15, act === 3 || act === 4 ? 1 : 0, act === 2);
  }, [act, sound]);
  useEffect(
    () => () => {
      ambRef.current?.close();
      ambRef.current = null;
    },
    [],
  );
  const toggleSound = async () => {
    if (!sound) {
      ambRef.current ??= new Ambience();
      await ambRef.current.resume();
      setSound(true);
    } else {
      ambRef.current?.set(0, 0, false);
      setSound(false);
    }
  };

  const jumpTo = useCallback((i: number) => {
    const root = rootRef.current;
    if (!root) return;
    const total = root.offsetHeight - window.innerHeight;
    window.scrollTo({ top: (i / ACTS) * total + 4, behavior: "smooth" });
  }, []);

  const stressMap = useStressMap(maxAct >= 3);
  const ndviTint = live.ndvi.status === "ok" && live.ndvi.value.ndviMedian !== null ? ndviLeafTint(live.ndvi.value.ndviMedian) : "var(--leaf-olive)";
  const lights = useMemo(() => districts.map((d) => ({ lat: d.lat, lon: d.lon })), [districts]);
  const name = district?.name ?? "…";

  const notes = [
    <FieldNote key={0} dark source={t.journey.sourceCelestrak} title={t.journey.act1Title} body={t.journey.act1Body} label={t.journey.act1Live} live={live.position} render={(v) => v} onRetry={live.retryTle} />,
    <FieldNote key={1} dark source={t.journey.act2Source} title={t.journey.act2Title} body={t.journey.act2Body} label={fmt(t.journey.act2Live, { district: name })} live={live.nextPass} render={(d) => (d ? dtf.format(d) : t.journey.act2LiveNone)} onRetry={live.retryTle}>
      <p className="mono jn-formula">{t.journey.act2Formula}</p>
    </FieldNote>,
    <FieldNote key={2} source={t.journey.sourceOpenMeteo} title={t.journey.act3Title} body={t.journey.act3Body} label={`${t.journey.act3Live} · ${name}`} live={live.et0} render={(v) => `${nf.format(v)} mm`} onRetry={live.retryEt0} />,
    <FieldNote
      key={3}
      source={t.journey.sourceImdState}
      title={t.journey.act4Title}
      body={t.journey.act4Body}
      label={live.monsoon.status === "ok" ? `${t.journey.act4Live} · ${live.monsoon.value.latest.year}` : t.journey.act4Live}
      live={live.monsoon}
      render={(v) => (
        <>
          {v.latest.departurePct !== null ? `${v.latest.departurePct > 0 ? "+" : ""}${nf.format(v.latest.departurePct)}%` : "—"}
          <Sparkline label={`${v.last30[0]?.year}–${v.latest.year}`} values={v.last30.map((x) => ({ x: x.year, y: x.departurePct }))} />
        </>
      )}
      onRetry={live.summary.retry}
    />,
    <FieldNote
      key={4}
      source={t.journey.sourceStress}
      title={t.journey.act5Title}
      body={t.journey.act5Body}
      label={`${t.journey.act5Live} · ${name}`}
      live={live.stress}
      render={(v) => (
        <>
          {nf.format(v.stressIndex0100!)}/100 <span className="annot">{fmt(t.journey.rankOf, { rank: v.rankNational ?? "—", total: v.total })}</span>
        </>
      )}
      onRetry={live.summary.retry}
    />,
    <FieldNote key={5} source="Sentinel-2 · Planetary Computer" title={t.journey.act6Title} body={t.journey.act6Body} label={t.journey.act6Live} live={live.ndvi} render={(v) => `${v.ndviMedian?.toFixed(2)} (${v.month.slice(0, 7)})`} onRetry={live.summary.retry} />,
    <FieldNote key={6} source="FAO-56" title={t.journey.act7Title} body={t.journey.act7Body} label={t.journey.act7Live} live={live.et0.status === "ok" ? { status: "ok", value: live.et0.value * 1.2 } : live.et0} render={(v) => `ETc ≈ ${nf.format(v)} mm`} onRetry={live.retryEt0} />,
    <FieldNote
      key={7}
      dark
      source={t.journey.sourceCgwb}
      title={t.journey.act8Title}
      body={t.journey.act8Body}
      label={live.gw.status === "ok" ? `${t.journey.act8Live} · ${live.gw.value.year}` : t.journey.act8Live}
      live={live.gw}
      render={(v) => (
        <>
          {v.medianDepthMbgl !== null ? `${nf.format(v.medianDepthMbgl)} m` : "—"}{" "}
          {v.changeVsBaselineM !== null ? <span className="annot">{fmt(t.journey.vsBaseline, { value: `${v.changeVsBaselineM > 0 ? "+" : ""}${nf.format(v.changeVsBaselineM)}` })}</span> : null}
        </>
      )}
      onRetry={live.summary.retry}
    />,
    <div key={8} className="jn-arrive">
      <h2>{t.journey.act9Title}</h2>
      <p>{t.journey.act9Body}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn btn--teal" href={`/atlas${q}`} onClick={() => store.set(SEEN_KEY, "1")}>
          {t.journey.exploreAtlas}
        </Link>
        <Link className="btn" href={`/field${q}`} onClick={() => store.set(SEEN_KEY, "1")} style={{ background: "var(--starlight)", color: "var(--ink)" }}>
          {t.journey.checkField}
        </Link>
      </div>
      <Link className="btn btn--ghost" href={`/hub${q}`} onClick={() => store.set(SEEN_KEY, "1")} style={{ color: "var(--starlight)", marginTop: 8 }}>
        {t.journey.enterDial} →
      </Link>
    </div>,
  ];

  return (
    <div className="jn" ref={rootRef} style={{ height: `${(ACTS + 1) * 100}svh` }}>
      <div className="jn-stage">
        {/* sky gradient layers */}
        {["night", "dawn", "storm", "paper", "soil", "deep", "refl"].map((s, i) => (
          <div key={s} className={`jn-sky jn-sky--${s}`} data-sky={s} style={i === 0 ? undefined : { opacity: 0, visibility: "hidden" }} />
        ))}
        <canvas ref={canvasRef} className="jn-canvas" aria-hidden />

        <div className="jn-layer" data-layer="0">
          <OrbitArt lights={lights} eyeOpen={eyeOpen} />
          <div className="jn-title" data-anim="title">
            <h1>NEERAKSHI</h1>
            <p className="jn-tagline">{t.common.tagline}</p>
            <p className="annot jn-scroll">{t.journey.scroll} ↓</p>
          </div>
        </div>
        <div className="jn-layer" data-layer="1" style={{ opacity: 0, visibility: "hidden" }}>
          <SensingArt />
        </div>
        <div className="jn-layer" data-layer="2" style={{ opacity: 0, visibility: "hidden" }}>
          <DawnArt />
        </div>
        <div className="jn-layer" data-layer="3" style={{ opacity: 0, visibility: "hidden" }}>
          <MonsoonArt />
        </div>
        <div className="jn-layer" data-layer="4" style={{ opacity: 0, visibility: "hidden" }}>
          <AtlasArt stress={stressMap} chosen={districtId} enabled={maxAct >= 3} />
        </div>
        <div className="jn-layer" data-layer="5" style={{ opacity: 0, visibility: "hidden" }}>
          <FieldArt tint={ndviTint} />
        </div>
        <div className="jn-layer" data-layer="6" style={{ opacity: 0, visibility: "hidden" }}>
          <SoilArt labels={t.journey.act7Labels} />
        </div>
        <div className="jn-layer" data-layer="7" style={{ opacity: 0, visibility: "hidden" }}>
          <AquiferArt depthM={live.gw.status === "ok" ? live.gw.value.medianDepthMbgl : null} />
        </div>
        <div className="jn-layer" data-layer="8" style={{ opacity: 0, visibility: "hidden" }}>
          <ReflectionArt />
          <div className="jn-eye" data-anim="eye">
            <Logo size={200} open={1} />
          </div>
        </div>

        {/* caption for the current act */}
        <div className={`jn-caption${act === 8 ? " jn-caption--center" : ""}`} key={act}>
          {notes[act]}
        </div>

        {/* altimeter scrollbar / chapter navigation */}
        <nav className="jn-alt" aria-label={t.journey.altitude}>
          <div className="jn-alt__ruler">
            {ALTITUDES.map((a, i) => (
              <button key={i} className="jn-alt__mark" style={{ top: `${(i / (ACTS - 1)) * 100}%` }} onClick={() => jumpTo(i)} aria-current={act === i ? "step" : undefined} aria-label={`${a} — ${[t.journey.act1Title, t.journey.act2Title, t.journey.act3Title, t.journey.act4Title, t.journey.act5Title, t.journey.act6Title, t.journey.act7Title, t.journey.act8Title, t.journey.act9Title][i]}`}>
                <span className="jn-alt__label">{a}</span>
              </button>
            ))}
            <div className="jn-alt__drop" ref={markerRef} aria-hidden>
              <svg viewBox="0 0 12 16" width="14" height="18">
                <path d="M6 1c3 4 5 7 5 9a5 5 0 0 1-10 0c0-2 2-5 5-9z" fill="var(--neer-teal)" stroke="var(--starlight)" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </nav>

        {/* chrome: skip, sound */}
        <div className="jn-chrome">
          <Link className="btn btn--sm jn-skip" href={`/atlas${q}`} onClick={() => store.set(SEEN_KEY, "1")}>
            {t.common.skipToAtlas}
          </Link>
          <button className="btn btn--sm btn--ghost jn-sound" onClick={toggleSound} aria-pressed={sound}>
            {sound ? `♪ ${t.common.soundOn}` : `♪ ${t.common.soundOff}`}
          </button>
        </div>

        {/* personalisation: never blocks the journey */}
        {act === 0 && !chooserDismissed ? (
          <div className="jn-chooser" role="region" aria-label={t.journey.chooseTitle}>
            <p style={{ margin: 0, fontWeight: 600 }}>{t.journey.chooseTitle}</p>
            <p className="annot" style={{ margin: "2px 0 8px", color: "inherit", opacity: 0.8 }}>
              {isDefault ? fmt(t.common.defaultDistrictNote, { district: name }) : `${name}, ${district?.state ?? ""}`}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn--sm" style={{ background: "var(--starlight)", color: "var(--ink)" }} onClick={() => setPickerOpen(true)}>
                {t.common.pickDistrict}
              </button>
              <button className="btn btn--sm btn--ghost" style={{ color: "var(--starlight)", borderColor: "var(--starlight)" }} onClick={() => setChooserDismissed(true)}>
                {t.common.close}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <DistrictPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

function useStressMap(enabled: boolean) {
  const r = useJson<{ values: { id: string; v: number | null }[] }>(enabled ? "/api/atlas/layer?layer=stress" : null);
  return useMemo(() => new Map((r.data?.values ?? []).map((x) => [x.id, x.v])), [r.data]);
}
