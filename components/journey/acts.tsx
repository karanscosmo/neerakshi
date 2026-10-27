"use client";
/**
 * Illustrated layers for the nine acts. Each is pure SVG/CSS; the Journey
 * animates only transform and opacity on the wrappers (data-anim targets).
 */
import { useEffect, useMemo, useState } from "react";
import { geoGraticule10, geoOrthographic, geoPath, geoMercator } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { Logo } from "@/components/Logo";
import { CloudBank, SatelliteIcon, Benchmark } from "@/components/art/Motifs";
import { CropPlate } from "@/components/art/CropPlate";
import { RAMPS, colorFor } from "@/lib/shared/scales";

type Topo = Topology;
const topoCache = new Map<string, Promise<Topo>>();
export function loadTopo(name: "india" | "districts" | "states"): Promise<Topo> {
  if (!topoCache.has(name)) topoCache.set(name, fetch(`/data/${name}.topo.json`).then((r) => r.json()));
  return topoCache.get(name)!;
}

export function useTopo(name: "india" | "districts" | "states", enabled = true) {
  const [t, setT] = useState<Topo | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadTopo(name).then((x) => live && setT(x)).catch(() => {});
    return () => {
      live = false;
    };
  }, [name, enabled]);
  return t;
}

/* ─── Act 1: Orbit ─────────────────────────────────────────────────────── */
export function OrbitArt({ lights, eyeOpen }: { lights: { lat: number; lon: number }[]; eyeOpen: number }) {
  const india = useTopo("india");
  const { landPath, grat, sphere, dots } = useMemo(() => {
    const proj = geoOrthographic().rotate([-80, -8, 0]).scale(560).translate([500, 1020]).clipAngle(90);
    const p = geoPath(proj);
    const land = india ? p(feature(india, india.objects.india as GeometryCollection) as unknown as GeoJSON.FeatureCollection) : null;
    const dots = lights.map((d) => proj([d.lon, d.lat])).filter((x): x is [number, number] => Boolean(x));
    return { landPath: land, grat: p(geoGraticule10()), sphere: p({ type: "Sphere" }), dots };
  }, [india, lights]);
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax slice" className="act-svg" aria-hidden>
      <defs>
        <radialGradient id="limb" cx="50%" cy="100%" r="60%">
          <stop offset="70%" stopColor="#1d2a44" />
          <stop offset="100%" stopColor="#141B2D" />
        </radialGradient>
      </defs>
      <path d={sphere ?? ""} fill="url(#limb)" stroke="#F3EBD8" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d={sphere ?? ""} fill="none" stroke="#2F7F86" strokeOpacity="0.35" strokeWidth="10" />
      <path d={grat ?? ""} fill="none" stroke="#F3EBD8" strokeOpacity="0.12" strokeWidth="0.6" />
      {landPath ? <path d={landPath} fill="#F3EBD8" fillOpacity="0.07" stroke="#F3EBD8" strokeOpacity="0.5" strokeWidth="0.8" /> : null}
      <g fill="#E3A65A">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.4} opacity={0.75} />
        ))}
      </g>
      {/* engraved orbit ellipse with tick marks */}
      <g transform="translate(500 520) rotate(-14)">
        <ellipse rx="460" ry="120" fill="none" stroke="#F3EBD8" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="2 5" />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const x = 460 * Math.cos(a);
          const y = 120 * Math.sin(a);
          return <line key={i} x1={x} y1={y} x2={x * 1.02} y2={y * 1.06} stroke="#F3EBD8" strokeOpacity="0.5" strokeWidth="0.8" />;
        })}
        <g className="nk-orbiting">
          <path id="orbit-path" d="M460,0 A460,120 0 1,1 -460,0 A460,120 0 1,1 460,0" fill="none" />
          <g color="#F3EBD8">
            <foreignObject x="-24" y="-12" width="48" height="24" style={{ overflow: "visible" }}>
              <SatelliteIcon size={48} />
            </foreignObject>
            <animateMotion dur="38s" repeatCount="indefinite" rotate="auto">
              <mpath href="#orbit-path" />
            </animateMotion>
          </g>
        </g>
      </g>
      <g transform="translate(500 330)" color="#F3EBD8">
        <foreignObject x="-60" y="-60" width="120" height="120">
          <Logo size={120} open={eyeOpen} />
        </foreignObject>
      </g>
    </svg>
  );
}

/* ─── Act 2: Sensing ───────────────────────────────────────────────────── */
export function SensingArt() {
  const fields = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const palette = ["#6B7F4E", "#8FA374", "#B8834A", "#E3A65A", "#55673C", "#C9A066"];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 9; c++) out.push({ x: c * 120 - 40 + rnd() * 10, y: r * 110 + 260 + rnd() * 10, w: 110 - rnd() * 20, h: 100 - rnd() * 18, c: palette[Math.floor(rnd() * palette.length)] });
    return out;
  }, []);
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="act-svg" aria-hidden>
      <g transform="skewX(-12) translate(60 0)">
        {fields.map((f, i) => (
          <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.c} fillOpacity="0.75" stroke="#23262A" strokeWidth="0.8" />
        ))}
        {fields.map((f, i) =>
          i % 3 === 0 ? <path key={`h${i}`} d={`M${f.x + 6},${f.y + 10} l${f.w - 12},0 M${f.x + 6},${f.y + 22} l${f.w - 12},0 M${f.x + 6},${f.y + 34} l${f.w - 12},0`} stroke="#23262A" strokeWidth="0.4" opacity="0.5" /> : null,
        )}
      </g>
      {/* swath */}
      <g data-anim="swath">
        <rect x="-200" y="180" width="320" height="820" fill="#F3EBD8" fillOpacity="0.18" stroke="#F3EBD8" strokeDasharray="6 6" />
      </g>
      {/* band strips that peel apart and recombine */}
      <g data-anim="band-red" transform="translate(300 120)">
        <rect width="170" height="110" fill="#A9533E" fillOpacity="0.55" stroke="#23262A" />
        <text x="10" y="22" fontFamily="var(--ff-mono)" fontSize="15" fill="#F3EBD8">
          RED · B04 · 665 nm
        </text>
      </g>
      <g data-anim="band-nir" transform="translate(530 120)">
        <rect width="170" height="110" fill="#5E6E7E" fillOpacity="0.55" stroke="#23262A" />
        <text x="10" y="22" fontFamily="var(--ff-mono)" fontSize="15" fill="#F3EBD8">
          NIR · B08 · 842 nm
        </text>
      </g>
      <g data-anim="band-ndvi" transform="translate(415 120)">
        <rect width="170" height="110" fill="#6B7F4E" stroke="#23262A" />
        <text x="10" y="22" fontFamily="var(--ff-mono)" fontSize="15" fill="#F3EBD8">
          NDVI
        </text>
      </g>
    </svg>
  );
}

/* ─── Act 3: Dawn ──────────────────────────────────────────────────────── */
export function DawnArt() {
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMax slice" className="act-svg" aria-hidden>
      <g data-anim="sun">
        <circle cx="620" cy="700" r="70" fill="#E3A65A" stroke="#23262A" strokeWidth="1" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <line key={i} x1={620 + Math.cos(a) * 82} y1={700 + Math.sin(a) * 82} x2={620 + Math.cos(a) * (i % 2 ? 100 : 118)} y2={700 + Math.sin(a) * (i % 2 ? 100 : 118)} stroke="#23262A" strokeWidth="0.8" />;
        })}
      </g>
      {/* engraved horizon hills */}
      <path d="M0,760 C120,720 220,740 320,725 S520,700 640,735 S860,710 1000,740 L1000,1000 L0,1000Z" fill="#EFE6D2" stroke="#23262A" strokeWidth="1.2" />
      {Array.from({ length: 30 }, (_, i) => (
        <path key={i} d={`M${i * 34},${780 + (i % 4) * 8} l22,-4`} stroke="#23262A" strokeWidth="0.5" opacity="0.6" />
      ))}
      <g className="nk-shimmer" stroke="#B8834A" strokeWidth="1.2" fill="none" opacity="0.8">
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d={`M${120 + i * 120},880 q8,-14 0,-28 t0,-28 t0,-28 t0,-28`} style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
      </g>
    </svg>
  );
}

/* ─── Act 4: Monsoon ───────────────────────────────────────────────────── */
export function MonsoonArt() {
  return (
    <div className="act-clouds" aria-hidden>
      <div data-anim="cloud-far" className="cloud cloud--far">
        <CloudBank width={1400} opacity={0.75} />
      </div>
      <div data-anim="cloud-mid" className="cloud cloud--mid">
        <CloudBank width={1200} opacity={0.9} />
      </div>
      <div data-anim="cloud-near" className="cloud cloud--near">
        <CloudBank width={1000} />
      </div>
    </div>
  );
}

/* ─── Act 5: Landfall on the atlas ─────────────────────────────────────── */
export function AtlasArt({ stress, chosen, enabled }: { stress: Map<string, number | null>; chosen: string; enabled: boolean }) {
  const topo = useTopo("districts", enabled);
  const geo = useMemo(() => {
    if (!topo) return null;
    const fc = feature(topo, topo.objects.districts as GeometryCollection) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; name: string }>;
    const proj = geoMercator().fitExtent([[140, 120], [860, 900]], fc);
    const p = geoPath(proj);
    const borders = p(mesh(topo, topo.objects.districts as GeometryCollection, (a, b) => a !== b) as GeoJSON.MultiLineString);
    const outline = p(mesh(topo, topo.objects.districts as GeometryCollection, (a, b) => a === b) as GeoJSON.MultiLineString);
    const shapes = fc.features.map((f) => ({ id: f.properties.id, d: p(f) ?? "", c: p.centroid(f) }));
    return { borders, outline, shapes };
  }, [topo]);
  const sel = geo?.shapes.find((s) => s.id === chosen);
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" className="act-svg" aria-hidden>
      <defs>
        <clipPath id="fold1">
          <rect x="0" y="0" width="1000" height="340" />
        </clipPath>
        <clipPath id="fold2">
          <rect x="0" y="340" width="1000" height="330" />
        </clipPath>
        <clipPath id="fold3">
          <rect x="0" y="670" width="1000" height="330" />
        </clipPath>
        <filter id="wc" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="5" />
        </filter>
      </defs>
      {[1, 2, 3].map((k) => (
        <g key={k} clipPath={`url(#fold${k})`} data-anim={`fold${k}`} style={{ transformOrigin: k === 1 ? "500px 340px" : k === 2 ? "500px 340px" : "500px 670px" }}>
          <rect x="60" y="40" width="880" height="920" fill="#F6F0E2" stroke="#23262A" strokeWidth="1" />
          {geo ? (
            <>
              <g data-anim="wash" filter="url(#wc)">
                {geo.shapes.map((s) => (
                  <path key={s.id} d={s.d} fill={colorFor(RAMPS.stress, stress.get(s.id)) ?? "#E6DBC2"} fillOpacity="0.85" />
                ))}
              </g>
              <path d={geo.borders ?? ""} fill="none" stroke="#23262A" strokeWidth="0.25" strokeOpacity="0.5" />
              <path d={geo.outline ?? ""} fill="none" stroke="#23262A" strokeWidth="1" />
            </>
          ) : null}
        </g>
      ))}
      <path d="M60 340 H940 M60 670 H940" stroke="#23262A" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="4 6" />
      {sel ? (
        <g data-anim="marker">
          <path d={sel.d} fill="none" stroke="#A9533E" strokeWidth="3" />
          <foreignObject x={sel.c[0] - 11} y={sel.c[1] - 30} width="22" height="22">
            <Benchmark size={22} />
          </foreignObject>
        </g>
      ) : null}
    </svg>
  );
}

/* ─── Act 6: Field ─────────────────────────────────────────────────────── */
export function FieldArt({ tint }: { tint: string }) {
  return (
    <div className="act-center" aria-hidden>
      <CropPlate crop="rice" size={340} tint={tint} sway />
    </div>
  );
}

/* ─── Act 7: Below ground — the bucket ─────────────────────────────────── */
export function SoilArt({ labels }: { labels: { etc: string; rain: string; irrigation: string; raw: string } }) {
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="act-svg" aria-hidden>
      <rect x="0" y="0" width="1000" height="230" fill="#EFE6D2" />
      <path d="M0,230 H1000" stroke="#23262A" strokeWidth="1.5" />
      {[230, 420, 640, 860].map((y, i) => (
        <rect key={y} x="0" y={y} width="1000" height="220" fill={["#C9A066", "#B8834A", "#8A5F2F", "#6E4A28"][i]} fillOpacity="0.55" />
      ))}
      {Array.from({ length: 80 }, (_, i) => (
        <circle key={i} cx={(i * 137) % 1000} cy={250 + ((i * 89) % 720)} r={1 + (i % 3)} fill="#23262A" opacity="0.35" />
      ))}
      {/* bucket = root zone */}
      <g transform="translate(330 300)">
        <path d="M0,0 L340,0 L310,420 L30,420Z" fill="#F6F0E2" fillOpacity="0.6" stroke="#23262A" strokeWidth="2" />
        <clipPath id="bucket">
          <path d="M0,0 L340,0 L310,420 L30,420Z" />
        </clipPath>
        <g clipPath="url(#bucket)">
          <g data-anim="water" style={{ transformOrigin: "170px 420px" }}>
            <rect x="0" y="0" width="340" height="420" fill="#2F7F86" fillOpacity="0.7" />
            <path className="nk-wave" d="M-40,6 q20,-8 40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0 t40,0" stroke="#F3EBD8" strokeWidth="1.2" fill="none" />
          </g>
        </g>
        <line x1="-20" y1="170" x2="360" y2="170" stroke="#A9533E" strokeWidth="2" strokeDasharray="8 6" />
        <text x="170" y="160" textAnchor="middle" fontFamily="var(--ff-mono)" fontSize="17" fill="#23262A">
          {labels.raw}
        </text>
      </g>
      <g fontFamily="var(--ff-mono)" fontSize="19" fill="#23262A" textAnchor="middle">
        <path d="M420,285 v-110 m-11,14 l11,-14 l11,14" stroke="#E3A65A" strokeWidth="4" fill="none" />
        <text x="420" y="160">{labels.etc}</text>
        <path d="M545,120 v160 m-11,-14 l11,14 l11,-14" stroke="#2F7F86" strokeWidth="4" fill="none" />
        <text x="545" y="105">{labels.rain}</text>
        <path d="M630,180 v100 m-11,-14 l11,14 l11,-14" stroke="#2F7F86" strokeWidth="4" fill="none" strokeDasharray="7 5" />
        <text x="630" y="165">{labels.irrigation}</text>
      </g>
    </svg>
  );
}

/* ─── Act 8: Aquifer ───────────────────────────────────────────────────── */
export function AquiferArt({ depthM }: { depthM: number | null }) {
  // 0–30 m scale drawn from y=120 (ground) to y=900
  const yFor = (m: number) => 120 + (Math.min(30, Math.max(0, m)) / 30) * 780;
  const wt = depthM !== null ? yFor(depthM) : null;
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="act-svg" aria-hidden>
      <rect x="0" y="0" width="1000" height="120" fill="#8A5F2F" fillOpacity="0.5" />
      {[120, 330, 560, 780].map((y, i) => (
        <path key={y} d={`M0,${y} C250,${y - 18} 500,${y + 22} 1000,${y - 8} L1000,${y + 240} L0,${y + 240}Z`} fill={["#6E4A28", "#5E6E7E", "#4F5D6B", "#3a4552"][i]} fillOpacity="0.75" stroke="#23262A" strokeWidth="0.8" />
      ))}
      {wt !== null ? (
        <g>
          <rect x="0" y={wt} width="1000" height={1000 - wt} fill="#2F7F86" fillOpacity="0.35" />
          {Array.from({ length: 60 }, (_, i) => (
            <circle key={i} cx={(i * 167) % 1000} cy={wt + 20 + ((i * 53) % Math.max(40, 960 - wt))} r="2" fill="#F3EBD8" opacity="0.5" />
          ))}
          <path className="nk-wave" d={`M-40,${wt} q25,-6 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0 t50,0`} stroke="#F3EBD8" strokeWidth="1.5" fill="none" />
        </g>
      ) : null}
      {/* well shaft */}
      <rect x="470" y="40" width="60" height={wt !== null ? wt - 40 + 60 : 700} fill="#141B2D" fillOpacity="0.55" stroke="#F3EBD8" strokeWidth="1.2" />
      <path d="M440,40 h120 M500,0 v40" stroke="#F3EBD8" strokeWidth="2" />
      {/* depth scale */}
      <g fontFamily="var(--ff-mono)" fontSize="16" fill="#F3EBD8">
        {[0, 5, 10, 15, 20, 25, 30].map((m) => (
          <g key={m}>
            <line x1="580" x2="600" y1={yFor(m)} y2={yFor(m)} stroke="#F3EBD8" />
            <text x="610" y={yFor(m) + 5}>{`−${m} m`}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ─── Act 9: Reflection ────────────────────────────────────────────────── */
export function ReflectionArt() {
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="act-svg" aria-hidden>
      <defs>
        <linearGradient id="refl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141B2D" />
          <stop offset="0.5" stopColor="#2F7F86" stopOpacity="0.6" />
          <stop offset="1" stopColor="#141B2D" />
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#refl)" />
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx="500" cy="500" rx={60 + i * 55} ry={18 + i * 17} fill="none" stroke="#F3EBD8" strokeOpacity={0.35 - i * 0.03} className="nk-ripple" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
    </svg>
  );
}
