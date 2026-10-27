/** Survey and sky motifs shared across the app (original SVG). */

export function CompassRose({ size = 64, className }: { size?: number; className?: string }) {
  const pts = (r1: number, r2: number, n: number, rot = 0) =>
    Array.from({ length: n * 2 }, (_, i) => {
      const a = ((i * 180) / n + rot - 90) * (Math.PI / 180);
      const r = i % 2 ? r2 : r1;
      return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
    }).join(" ");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--ink)" strokeWidth="0.6" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--ink)" strokeWidth="0.3" strokeDasharray="1 2" />
      <polygon points={pts(30, 6, 4, 45)} fill="var(--paper-light)" stroke="var(--ink)" strokeWidth="0.6" />
      <polygon points={pts(42, 7, 4)} fill="var(--ink)" fillOpacity="0.08" stroke="var(--ink)" strokeWidth="0.7" />
      <path d="M50 8 L54 50 L50 50Z" fill="var(--ink)" />
      <text x="50" y="6" textAnchor="middle" fontSize="8" fontFamily="var(--ff-mono)" fill="var(--ink)">
        N
      </text>
    </svg>
  );
}

/** Scale bar in km for a given pixels-per-km. */
export function ScaleBar({ pxPerKm, className }: { pxPerKm: number; className?: string }) {
  const nice = [10, 20, 50, 100, 200, 500, 1000];
  const km = nice.find((k) => k * pxPerKm >= 60) ?? 1000;
  const w = km * pxPerKm;
  return (
    <svg width={w + 30} height={26} className={className} aria-label={`Scale bar ${km} km`} role="img">
      <g transform="translate(4,8)" stroke="var(--ink)" fontFamily="var(--ff-mono)" fontSize="9">
        <rect x="0" y="0" width={w / 2} height="4" fill="var(--ink)" />
        <rect x={w / 2} y="0" width={w / 2} height="4" fill="var(--paper-light)" />
        <text x="0" y="16" stroke="none" fill="var(--ink)">
          0
        </text>
        <text x={w} y="16" stroke="none" fill="var(--ink)" textAnchor="middle">
          {km} km
        </text>
      </g>
    </svg>
  );
}

/** Stylised Sentinel-type satellite: bus + single solar wing + instrument. */
export function SatelliteIcon({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 32" width={size} height={size / 2} className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="0.9" fill="none">
        <rect x="26" y="9" width="12" height="14" fill="currentColor" fillOpacity="0.15" />
        <path d="M26 16 H20" />
        <rect x="2" y="11" width="18" height="10" />
        <path d="M6 11v10M10 11v10M14 11v10M2 16h18" strokeWidth="0.4" />
        <path d="M38 13 l6 -3 v12 l-6 -3" />
        <circle cx="32" cy="23" r="2" />
      </g>
    </svg>
  );
}

/** Cloud bank drawn like the scalloped clouds on old weather charts (two rows of arcs, back row first). */
export function CloudBank({ width = 600, className, opacity = 1 }: { width?: number; className?: string; opacity?: number }) {
  let seed = Math.round(width) % 97;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const row = (base: number, scale: number, offset: number) => {
    const arcs: string[] = [];
    let x = offset;
    while (x < width) {
      const r = scale * (0.6 + rnd() * 0.8);
      arcs.push(`M${x},${base} a${r},${r * (0.75 + rnd() * 0.3)} 0 0 1 ${2 * r},0 Z`);
      x += 2 * r * (0.72 + rnd() * 0.12);
    }
    return arcs.join(" ");
  };
  const back = row(52, 34, -20);
  const front = row(70, 26, -10);
  return (
    <svg viewBox={`0 -20 ${width} 120`} width="100%" preserveAspectRatio="none" className={className} aria-hidden style={{ opacity }}>
      <path d={back} fill="var(--paper-light)" fillOpacity="0.85" stroke="var(--ink)" strokeWidth="0.9" />
      <path d={front} fill="var(--paper-light)" stroke="var(--ink)" strokeWidth="1.1" />
      <rect x="0" y="69" width={width} height="31" fill="var(--paper-light)" />
      <path d={`M0,70 H${width}`} stroke="var(--ink)" strokeWidth="0.6" strokeDasharray="3 5" />
      {Array.from({ length: 18 }, (_, i) => (
        <path key={i} d={`M${12 + i * (width / 18)},${82 + (i % 3) * 5} l16,-6`} stroke="var(--monsoon-slate)" strokeWidth="0.7" />
      ))}
    </svg>
  );
}

/** Benchmark triangle used to mark the chosen district. */
export function Benchmark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      <path d="M10 2 L18 17 H2Z" fill="var(--paper-light)" stroke="var(--laterite)" strokeWidth="1.6" />
      <circle cx="10" cy="12" r="2" fill="var(--laterite)" />
    </svg>
  );
}
