"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useSharedQuery } from "@/lib/client/district";
import { useJson } from "@/lib/client/useJson";
import { SECTIONS, SECTION_COLOR, type SectionKey } from "@/lib/shared/sections";
import { Logo } from "@/components/Logo";
import { SatelliteIcon } from "@/components/art/Motifs";
import { StationIcon } from "./StationIcon";
import type { Headlines } from "@/lib/server/headlines";
import { LOCALE_BCP47 } from "@/lib/i18n/config";

const N = SECTIONS.length;
const STEP = 360 / N;
const KEY = "nk_dial";
const MAX_V = 1.2; // deg/ms
const FRICTION = 0.92;

/** Polar helper: angle in degrees (0 = right, −90 = top) → x,y. */
export function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  // rounded so server and client render identical attributes
  return [Math.round((cx + r * Math.cos(a)) * 100) / 100, Math.round((cy + r * Math.sin(a)) * 100) / 100] as const;
}

const norm = (d: number) => ((d % 360) + 540) % 360 - 180; // → (−180, 180]

export function OrbitDial() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const q = useSharedQuery();
  const head = useJson<Headlines>("/api/atlas/headlines");
  const [rot, setRot] = useState(0);
  const rotRef = useRef(0);
  const [sweep, setSweep] = useState({ from: 0, n: 0 });
  const [phone, setPhone] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ last: number; moved: number; v: number; t: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const m = window.matchMedia("(max-width: 760px)");
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  // Restore last focused station (Back returns to the same place)
  useEffect(() => {
    let i = 0;
    try {
      i = Number(sessionStorage.getItem(KEY) ?? 0) || 0;
    } catch {}
    rotRef.current = -i * STEP;
    setRot(rotRef.current);
  }, []);

  const focused = ((Math.round(-rot / STEP) % N) + N) % N;
  const prevFocus = useRef(focused);
  useEffect(() => {
    if (prevFocus.current !== focused) {
      // satellite marker sweeps from the old focus toward the new one
      const d = norm((focused - prevFocus.current) * STEP);
      setSweep((s) => ({ from: -d, n: s.n + 1 }));
      prevFocus.current = focused;
      try {
        sessionStorage.setItem(KEY, String(focused));
      } catch {}
    }
  }, [focused]);

  const geom = phone ? { w: 500, h: 360, cx: 250, cy: 320, r: 255 } : { w: 1000, h: 1000, cx: 500, cy: 500, r: 380 };

  const apply = (r: number) => {
    rotRef.current = r;
    setRot(r);
  };

  const animateTo = useCallback((target: number, ms = 320) => {
    cancelAnimationFrame(raf.current);
    const start = rotRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      apply(start + (target - start) * e);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const snap = useCallback(() => animateTo(Math.round(rotRef.current / STEP) * STEP), [animateTo]);
  const focusIndex = useCallback(
    (i: number) => {
      // shortest way round
      const cur = rotRef.current;
      const target = cur + norm(-i * STEP - cur);
      animateTo(target);
    },
    [animateTo],
  );

  const pointerAngle = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const box = svg.getBoundingClientRect();
    const sx = box.width / geom.w;
    const sy = box.height / geom.h;
    const x = (e.clientX - box.left) / sx;
    const y = (e.clientY - box.top) / sy;
    return (Math.atan2(y - geom.cy, x - geom.cx) * 180) / Math.PI;
  };

  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(raf.current);
    drag.current = { last: pointerAngle(e), moved: 0, v: 0, t: performance.now() };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const a = pointerAngle(e);
    const delta = norm(a - d.last); // wrapped: never jumps across ±180
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.v = Math.max(-MAX_V, Math.min(MAX_V, 0.7 * (delta / dt) + 0.3 * d.v));
    d.t = now;
    d.last = a;
    d.moved += Math.abs(delta);
    if (d.moved > 2 && !(e.target as Element).hasPointerCapture?.(e.pointerId)) (e.currentTarget as Element).setPointerCapture(e.pointerId);
    apply(rotRef.current + delta);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved <= 2) return; // a tap: station buttons handle it
    let v = d.v;
    let last = performance.now();
    const glide = (now: number) => {
      const dt = now - last;
      last = now;
      v *= Math.pow(FRICTION, dt / 16.7);
      apply(rotRef.current + v * dt);
      if (Math.abs(v) > 0.02) raf.current = requestAnimationFrame(glide);
      else snap();
    };
    raf.current = requestAnimationFrame(glide);
  };

  const open = (k: SectionKey) => router.push(`/${k}${q}`);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusIndex((focused + 1) % N);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusIndex((focused - 1 + N) % N);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(SECTIONS[focused]);
    }
  };

  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 1 }), [locale]);
  const headline = (k: SectionKey): string | null => {
    const h = head.data;
    if (head.loading) return null;
    if (!h) return t.dial.hlUnavailable;
    switch (k) {
      case "atlas":
        return h.atlas ? fmt(t.dial.hlAtlas, { district: h.atlas.district, state: h.atlas.state, value: nf.format(h.atlas.value ?? 0) }) : t.dial.hlUnavailable;
      case "monsoon":
        return h.monsoon ? fmt(t.dial.hlMonsoon, { year: h.monsoon.year, value: `${(h.monsoon.value ?? 0) > 0 ? "+" : ""}${nf.format(h.monsoon.value ?? 0)}` }) : t.dial.hlUnavailable;
      case "groundwater":
        return h.groundwater ? fmt(t.dial.hlGroundwater, { year: h.groundwater.year, district: h.groundwater.district, value: nf.format(h.groundwater.value ?? 0) }) : t.dial.hlUnavailable;
      case "crops":
        return h.crops ? fmt(t.dial.hlCrops, { crop: t.crops.rice, year: h.crops.year, value: nf.format(h.crops.value) }) : t.dial.hlUnavailable;
      case "field":
        return h.field.count ? fmt(t.dial.hlFieldSaved, { count: h.field.count }) : t.dial.hlField;
      case "impact":
        return fmt(t.dial.hlImpact, { count: h.impact.count });
      case "methods":
        return fmt(t.dial.hlMethods, { count: h.methods.count });
    }
  };

  const fk = SECTIONS[focused];
  const { w, h, cx, cy, r } = geom;
  const [sx, sy] = polar(cx, cy, r, -90);

  return (
    <div className={`dial${phone ? " dial--phone" : ""}`}>
      <p id="dial-hint" className="sr-only">
        {t.dial.hint}
      </p>
      <div className="dial__iris" aria-live="polite">
        <div className="dial__eye" aria-hidden>
          <Logo size={phone ? 64 : 86} />
        </div>
        <p className="annot" style={{ color: SECTION_COLOR[fk] === "var(--ink)" ? undefined : "inherit" }}>
          {focused + 1} / {N}
        </p>
        <h2 className="dial__title">{t.sections[fk].title}</h2>
        <p className="dial__desc">{t.sections[fk].desc}</p>
        <p className="dial__hl num">{headline(fk) ?? <span className="skeleton" style={{ display: "inline-block", width: 220, height: 18 }} />}</p>
        <button className="btn dial__enter" onClick={() => open(fk)}>
          {t.common.enter} →
        </button>
      </div>

      <svg
        ref={svgRef}
        className="dial__svg"
        viewBox={`0 0 ${w} ${h}`}
        role="group"
        aria-label={t.dial.label}
        aria-describedby="dial-hint"
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* engraved orbit ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink)" strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke="var(--ink)" strokeWidth="0.4" strokeDasharray="2 6" />
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          {Array.from({ length: 72 }, (_, i) => {
            const [x1, y1] = polar(cx, cy, r, i * 5);
            const [x2, y2] = polar(cx, cy, r + (i % 3 === 0 ? 12 : 6), i * 5);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth="0.6" />;
          })}
        </g>
        {!phone ? (
          <g aria-hidden>
            {[0.28, 0.5, 0.72].map((k) => (
              <circle key={k} cx={cx} cy={cy} r={r * k} fill="none" stroke="var(--neer-teal)" strokeOpacity="0.35" strokeWidth="1" />
            ))}
          </g>
        ) : null}
        {/* focus mark */}
        <path d={`M${sx - 10},${sy - 64} l10,14 l10,-14`} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
        {/* satellite marker sweeps toward the focused station */}
        <g key={sweep.n} className="dial__sat" style={{ ["--from" as string]: `${sweep.from}deg`, transformOrigin: `${cx}px ${cy}px` }}>
          <foreignObject x={sx - 18} y={sy - 52} width="36" height="18" style={{ overflow: "visible", color: "var(--ink)" }}>
            <SatelliteIcon size={36} />
          </foreignObject>
        </g>
        {SECTIONS.map((k, i) => {
          const ang = -90 + i * STEP + rot;
          const [x, y] = polar(cx, cy, r, ang);
          const isF = i === focused;
          return (
            <g key={k} transform={`translate(${x} ${y})`} className="dial__station" data-focused={isF}>
              <foreignObject x={-36} y={-36} width={72} height={72} style={{ overflow: "visible" }}>
                <button
                  className="dial__btn"
                  tabIndex={-1}
                  aria-label={t.sections[k].title}
                  onClick={() => (isF ? open(k) : focusIndex(i))}
                  style={{ ["--c" as string]: SECTION_COLOR[k] }}
                  data-focused={isF}
                >
                  <StationIcon k={k} />
                </button>
              </foreignObject>
              <text y={isF ? 56 : 46} textAnchor="middle" className="dial__label" data-focused={isF}>
                {t.sections[k].short}
              </text>
            </g>
          );
        })}
      </svg>

      <nav aria-label={t.dial.listLabel} className="sr-only">
        <ol>
          {SECTIONS.map((k) => (
            <li key={k}>
              <Link href={`/${k}${q}`}>
                {t.sections[k].title} — {t.sections[k].desc}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <style>{`
        .dial { position: relative; min-height: calc(100dvh - var(--topbar-h)); display: grid; place-items: center; overflow: hidden; }
        .dial__svg { width: min(92vmin, 860px); height: auto; touch-action: none; user-select: none; cursor: grab; }
        .dial__svg:active { cursor: grabbing; }
        .dial__svg:focus-visible { outline: 2px solid var(--focus); outline-offset: -8px; border-radius: 50%; }
        .dial__iris { position: absolute; z-index: 2; width: min(330px, 70vmin); text-align: center; pointer-events: none; }
        .dial__iris .btn { pointer-events: auto; }
        .dial__eye { display: grid; place-items: center; margin-bottom: 4px; color: var(--ink); }
        .dial__title { font-size: var(--step-2); margin: 2px 0; }
        .dial__desc { margin: 0 0 6px; color: var(--slate-text); }
        .dial__hl { font-size: .86rem; min-height: 2.6em; margin: 0 0 10px; color: var(--teal-text); }
        .dial__btn { width: 72px; height: 72px; border-radius: 50%; border: 1.5px solid var(--ink); background: var(--paper-light); display: grid; place-items: center; cursor: pointer; transition: transform 220ms var(--ease), background-color 220ms var(--ease); transform: scale(.72); color: var(--ink); }
        .dial__btn[data-focused="true"] { transform: scale(1); background: var(--c); color: var(--paper-light); border-color: var(--ink); }
        .dial__btn:active { transform: scale(.66); }
        .dial__btn[data-focused="true"]:active { transform: scale(.94); }
        .dial__label { font-family: var(--ff-mono); font-size: 15px; letter-spacing: .06em; fill: var(--slate-text); text-transform: uppercase; }
        .dial__label[data-focused="true"] { fill: var(--ink); font-weight: 600; font-size: 17px; }
        .dial__sat { animation: satSweep 520ms var(--ease) both; }
        @keyframes satSweep { from { transform: rotate(var(--from)); } to { transform: rotate(0deg); } }
        .dial--phone { display: flex; flex-direction: column; justify-content: flex-end; }
        .dial--phone .dial__iris { position: relative; margin: 24px auto 0; width: calc(100% - 32px); }
        .dial--phone .dial__svg { width: 100%; max-width: none; }
      `}</style>
    </div>
  );
}
