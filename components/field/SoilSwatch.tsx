/** Illustrated soil swatch: texture drawn as grains (sand), crumbs (loam) or cracks (clay). */
export function SoilSwatch({ soil, size = 84 }: { soil: "sandy" | "loam" | "clay_loam" | "clay"; size?: number }) {
  const fill = { sandy: "#E3C38F", loam: "#B8834A", clay_loam: "#8A5F2F", clay: "#3F3A36" }[soil];
  let seed = soil.length * 31;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const marks: React.ReactNode[] = [];
  if (soil === "sandy") for (let i = 0; i < 70; i++) marks.push(<circle key={i} cx={4 + rnd() * 92} cy={4 + rnd() * 62} r={0.8 + rnd() * 1.4} fill="#6E4A28" opacity={0.55} />);
  if (soil === "loam") for (let i = 0; i < 26; i++) marks.push(<ellipse key={i} cx={6 + rnd() * 88} cy={6 + rnd() * 58} rx={2 + rnd() * 4} ry={1.5 + rnd() * 3} fill="#5c3d22" opacity={0.5} />);
  if (soil === "clay_loam")
    for (let i = 0; i < 16; i++) {
      const x = rnd() * 100;
      const y = rnd() * 70;
      marks.push(<path key={i} d={`M${x},${y} l${6 + rnd() * 10},${(rnd() - 0.5) * 8}`} stroke="#2f2216" strokeWidth={0.9} opacity={0.6} />);
    }
  if (soil === "clay")
    marks.push(
      <path key="c" d="M0,22 L22,30 L40,18 L62,28 L100,20 M22,30 L28,50 L18,70 M62,28 L58,48 L76,70 M40,18 L36,0 M28,50 L58,48 M76,0 L80,24" stroke="#EFE6D2" strokeWidth={1.1} fill="none" opacity={0.75} />,
    );
  return (
    <svg viewBox="0 0 100 70" width={size} height={(size * 70) / 100} aria-hidden style={{ borderRadius: 6, border: "1px solid var(--ink)" }}>
      <rect width="100" height="70" fill={fill} />
      {marks}
    </svg>
  );
}
