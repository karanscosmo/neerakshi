/**
 * Line-engraved crop plates (original SVG, generated procedurally so every
 * plate shares one hand: hairline strokes, hatching, roots below a soil line).
 * `tint` colours the leaves (e.g. from NDVI); default is the olive data colour.
 */
import type { CSSProperties } from "react";

type Props = { crop: "rice" | "wheat" | "maize" | "sugarcane"; size?: number; tint?: string; sway?: boolean; title?: string; className?: string; style?: CSSProperties };

const INK = "var(--ink)";

function leaf(x: number, y: number, len: number, angle: number, width: number, droop = 0.25) {
  // Lens-shaped leaf from (x,y) along `angle` (deg), with a drooping tip.
  const a = (angle * Math.PI) / 180;
  const ex = x + Math.cos(a) * len;
  const ey = y - Math.sin(a) * len + len * droop;
  const mx = x + Math.cos(a) * len * 0.5;
  const my = y - Math.sin(a) * len * 0.5;
  const nx = -Math.sin(a) * width;
  const ny = -Math.cos(a) * width;
  const outline = `M${x},${y} Q${mx + nx},${my + ny} ${ex},${ey} Q${mx - nx * 0.6},${my - ny * 0.6} ${x},${y}Z`;
  const rib = `M${x},${y} Q${mx + nx * 0.2},${my + ny * 0.2} ${ex},${ey}`;
  const hatch: string[] = [];
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const px = x + (ex - x) * t + nx * 0.35 * Math.sin(Math.PI * t);
    const py = y + (ey - y) * t + ny * 0.35 * Math.sin(Math.PI * t);
    hatch.push(`M${px},${py} l${nx * 0.5},${ny * 0.5}`);
  }
  return { outline, rib, hatch: hatch.join(" ") };
}

function roots(cx: number, top: number, depth: number, spread: number, fibrous = true) {
  const paths: string[] = [];
  const n = fibrous ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const ex = cx + (t - 0.5) * spread * 2;
    const ey = top + depth * (0.55 + 0.45 * Math.sin(Math.PI * t));
    paths.push(`M${cx},${top} C${cx + (t - 0.5) * spread * 0.4},${top + depth * 0.3} ${ex - (t - 0.5) * 6},${ey - depth * 0.3} ${ex},${ey}`);
    // side rootlets
    for (let k = 1; k < 3; k++) {
      const s = k / 3;
      const rx = cx + (ex - cx) * s;
      const ry = top + (ey - top) * s;
      paths.push(`M${rx},${ry} l${(t - 0.5) * 10 + (k % 2 ? 6 : -6)},${8 + k * 2}`);
    }
  }
  return paths.join(" ");
}

export function CropPlate({ crop, size = 220, tint = "var(--leaf-olive)", sway = false, title, className, style }: Props) {
  const W = 200;
  const H = 260;
  const soil = 170;
  const cx = 100;
  const leaves: ReturnType<typeof leaf>[] = [];
  const extra: React.ReactNode[] = [];
  let stem = "";
  switch (crop) {
    case "rice": {
      for (let i = 0; i < 7; i++) {
        const ang = 60 + i * 10 + (i % 2 ? 4 : -4);
        leaves.push(leaf(cx + (i - 3) * 2, soil - 4, 95 + (i % 3) * 12, ang, 5, 0.35));
      }
      stem = `M${cx},${soil} Q${cx + 4},${soil - 80} ${cx + 18},${soil - 128}`;
      // drooping panicle
      const grains = [];
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const gx = cx + 18 + t * 34;
        const gy = soil - 128 + t * t * 46;
        grains.push(<ellipse key={i} cx={gx + (i % 2 ? 3 : -3)} cy={gy} rx={2.2} ry={4} transform={`rotate(${30 + t * 40} ${gx} ${gy})`} />);
      }
      extra.push(
        <g key="panicle" stroke={INK} strokeWidth={0.7} fill="var(--dawn-saffron)" fillOpacity={0.55}>
          <path d={`M${cx + 18},${soil - 128} Q${cx + 40},${soil - 120} ${cx + 52},${soil - 82}`} fill="none" />
          {grains}
        </g>,
      );
      // standing water line for paddy
      extra.push(<path key="water" d={`M20,${soil - 6} q15,-3 30,0 t30,0 t30,0 t30,0 t30,0 t30,0`} stroke="var(--neer-teal)" strokeWidth={0.8} fill="none" />);
      break;
    }
    case "wheat": {
      stem = `M${cx},${soil} Q${cx - 2},${soil - 90} ${cx + 2},${soil - 140}`;
      for (let i = 0; i < 5; i++) leaves.push(leaf(cx, soil - 10 - i * 22, 52 - i * 4, i % 2 ? 35 : 145, 4.5, 0.3));
      const spk = [];
      for (let i = 0; i < 10; i++) {
        const y = soil - 142 - i * 6;
        const side = i % 2 ? 1 : -1;
        spk.push(<ellipse key={`s${i}`} cx={cx + 2 + side * 4} cy={y} rx={3.4} ry={5} transform={`rotate(${side * 20} ${cx + 2 + side * 4} ${y})`} />);
        spk.push(<path key={`a${i}`} d={`M${cx + 2 + side * 6},${y - 3} l${side * 10},-22`} fill="none" />);
      }
      extra.push(
        <g key="ear" stroke={INK} strokeWidth={0.7} fill="var(--dawn-saffron)" fillOpacity={0.5}>
          {spk}
        </g>,
      );
      break;
    }
    case "maize": {
      stem = `M${cx},${soil} L${cx},${soil - 150}`;
      for (let i = 0; i < 6; i++) leaves.push(leaf(cx, soil - 18 - i * 22, 70 - i * 5, i % 2 ? 25 : 155, 7, 0.45));
      const kernels = [];
      for (let r = 0; r < 9; r++) for (let c = 0; c < 3; c++) kernels.push(<circle key={`${r}-${c}`} cx={cx + 12 + c * 3.4} cy={soil - 98 + r * 4.2} r={1.6} />);
      extra.push(
        <g key="cob" stroke={INK} strokeWidth={0.6}>
          <path d={`M${cx + 3},${soil - 66} C${cx + 26},${soil - 76} ${cx + 26},${soil - 104} ${cx + 16},${soil - 108} C${cx + 6},${soil - 100} ${cx + 4},${soil - 80} ${cx + 3},${soil - 66}Z`} fill="var(--dawn-saffron)" fillOpacity={0.45} />
          <g fill="var(--dawn-saffron)">{kernels}</g>
          <path d={`M${cx + 16},${soil - 108} q4,-10 -2,-16 M${cx + 16},${soil - 108} q8,-8 6,-18`} fill="none" />
        </g>,
      );
      // tassel
      extra.push(<path key="tassel" d={`M${cx},${soil - 150} l-10,-18 M${cx},${soil - 150} l10,-20 M${cx},${soil - 150} l0,-24 M${cx},${soil - 156} l-14,-8 M${cx},${soil - 156} l14,-10`} stroke={INK} strokeWidth={0.8} fill="none" />);
      break;
    }
    case "sugarcane": {
      stem = `M${cx - 4},${soil} L${cx - 4},${soil - 160} M${cx + 4},${soil} L${cx + 4},${soil - 160}`;
      const nodes = [];
      for (let i = 1; i < 9; i++) nodes.push(<path key={i} d={`M${cx - 5},${soil - i * 18} q5,3 10,0`} fill="none" />);
      extra.push(
        <g key="nodes" stroke={INK} strokeWidth={0.9}>
          {nodes}
        </g>,
      );
      for (let i = 0; i < 6; i++) leaves.push(leaf(cx, soil - 120 - i * 7, 85 - i * 6, i % 2 ? 20 + i * 8 : 160 - i * 8, 5, 0.55));
      break;
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={className} style={style}>
      {/* plate border */}
      <rect x={3} y={3} width={W - 6} height={H - 6} fill="none" stroke={INK} strokeWidth={0.8} />
      <rect x={7} y={7} width={W - 14} height={H - 14} fill="none" stroke={INK} strokeWidth={0.3} />
      {/* soil */}
      <rect x={7} y={soil} width={W - 14} height={H - soil - 7} fill="var(--soil-ochre)" fillOpacity={0.12} />
      <path d={`M7,${soil} H${W - 7}`} stroke={INK} strokeWidth={1} />
      <g stroke={INK} strokeWidth={0.35} opacity={0.6}>
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M${12 + i * 8.5},${soil + 6 + (i % 3) * 6} l4,${3 + (i % 2) * 2}`} />
        ))}
      </g>
      <path d={roots(cx, soil, crop === "sugarcane" ? 70 : 62, crop === "maize" ? 36 : 44)} stroke={INK} strokeWidth={0.6} fill="none" opacity={0.85} />
      <g className={sway ? "nk-sway" : undefined} style={{ transformOrigin: `${cx}px ${soil}px` }}>
        <path d={stem} stroke={INK} strokeWidth={1.1} fill="none" />
        {leaves.map((l, i) => (
          <g key={i}>
            <path d={l.outline} fill={tint} fillOpacity={0.55} stroke={INK} strokeWidth={0.8} />
            <path d={l.rib} stroke={INK} strokeWidth={0.4} fill="none" />
            <path d={l.hatch} stroke={INK} strokeWidth={0.3} fill="none" opacity={0.7} />
          </g>
        ))}
        {extra}
      </g>
    </svg>
  );
}
