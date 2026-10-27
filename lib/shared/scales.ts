/**
 * Map/chart colour scales built only from the Neerakshi hues. Sequential ramps
 * change lightness monotonically; the diverging ramp runs laterite ↔ paper ↔ teal
 * (a red–blue-like pair that stays distinguishable for deuteranopia,
 * protanopia and tritanopia — checked in tests/scales.test.ts). Missing values
 * use a hatch pattern, never a colour from the ramp.
 */
export type Ramp = { stops: string[]; domain: number[]; label: (v: number) => string };

export const NODATA = "url(#nk-hatch)";

export const RAMPS = {
  // 0–100 stress index: paper → saffron → ochre → laterite → deep laterite
  stress: { stops: ["#F3EAD3", "#E9C48E", "#D49A57", "#B8834A", "#A9533E", "#6E2F22"], domain: [0, 20, 40, 60, 80, 100], label: (v: number) => `${Math.round(v)}` },
  // JJAS departure %: deficit laterite ↔ normal paper ↔ excess teal
  monsoon: { stops: ["#7A3324", "#A9533E", "#D9A27F", "#EFE6D2", "#8FBFC2", "#2F7F86", "#1F5C62"], domain: [-60, -30, -10, 0, 10, 30, 60], label: (v: number) => `${v > 0 ? "+" : ""}${Math.round(v)}%` },
  // Groundwater depth m: shallow (pale teal) → deep (laterite), lightness falls with depth
  groundwater: { stops: ["#E4EFEA", "#C8DCD3", "#E3C38F", "#C99355", "#A9533E", "#6E2F22"], domain: [0, 3, 6, 10, 20, 40], label: (v: number) => `${v.toFixed(0)} m` },
  // Irrigated share %: paper → teal
  irrigation: { stops: ["#F3EAD3", "#BFD8D2", "#7FB2B5", "#2F7F86", "#1F5C62"], domain: [0, 25, 50, 75, 100], label: (v: number) => `${Math.round(v)}%` },
  // NDVI anomaly: lighter ochre (less green) ↔ paper ↔ dark olive (greener); lightness carries the sign under protanopia
  ndvi: { stops: ["#C9A066", "#DCC495", "#EFE6D2", "#8FA374", "#3D5C2E"], domain: [-0.2, -0.07, 0, 0.07, 0.2], label: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}` },
} satisfies Record<string, Ramp>;

export type RampKey = keyof typeof RAMPS;

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function colorFor(ramp: Ramp, v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const { stops, domain } = ramp;
  if (v <= domain[0]) return stops[0];
  if (v >= domain[domain.length - 1]) return stops[stops.length - 1];
  for (let i = 0; i < domain.length - 1; i++) {
    if (v <= domain[i + 1]) {
      const t = (v - domain[i]) / (domain[i + 1] - domain[i]);
      const a = hexToRgb(stops[i]);
      const b = hexToRgb(stops[i + 1]);
      const c = a.map((x, k) => Math.round(x + (b[k] - x) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return stops[stops.length - 1];
}

/** Relative luminance (WCAG) for contrast checks. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Brettel/Viénot-style dichromacy simulation (sRGB, linear approximation) for tests. */
export function simulateCvd(hex: string, kind: "protan" | "deutan" | "tritan"): [number, number, number] {
  const M = {
    protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
    tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  }[kind];
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  return [M[0] * r + M[1] * g + M[2] * b, M[3] * r + M[4] * g + M[5] * b, M[6] * r + M[7] * g + M[8] * b].map((x) => Math.min(1, Math.max(0, x))) as [number, number, number];
}

/** Leaf tint for an absolute NDVI value: bare/dry (≤ 0.15) ochre → dense green (≥ 0.75) olive. */
export function ndviLeafTint(ndvi: number): string {
  const t = Math.min(1, Math.max(0, (ndvi - 0.15) / 0.6));
  const a = hexToRgb("#C9A066");
  const b = hexToRgb("#55673C");
  const c = a.map((x, k) => Math.round(x + (b[k] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
