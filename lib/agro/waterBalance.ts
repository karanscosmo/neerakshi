/**
 * FAO-56 single crop coefficient, daily root-zone soil water balance.
 * Pure functions, no I/O. Mirrored line-for-line in pipeline/agro.py; both are
 * tested against the shared fixtures in tests/fixtures/water_balance_cases.json.
 *
 * References (Allen, Pereira, Raes & Smith 1998, FAO Irrigation and Drainage Paper 56):
 *   ETc = Kc · ET0                                   (Eq. 56)
 *   Kc curve: constant initial, linear development,  (Fig. 25, Eq. 66)
 *             constant mid-season, linear late season
 *   TAW = 1000 (θFC − θWP) Zr                         (Eq. 82)
 *   RAW = p · TAW                                     (Eq. 83)
 *   p adjusted for ETc: p = p_table + 0.04 (5 − ETc), 0.1 ≤ p ≤ 0.8  (Table 22 footnote)
 *   Ks = (TAW − Dr) / ((1 − p) TAW) when Dr > RAW    (Eq. 84); ETc,adj = Ks · Kc · ET0 (Eq. 80)
 *   Dr,i = Dr,i−1 − Peff,i − Ii + ETc,i  with 0 ≤ Dr ≤ TAW   (Eq. 85, runoff and capillary rise neglected)
 * Effective rainfall (Neerakshi choice, documented in docs/DECISIONS.md):
 *   Peff = 0 when P < 0.2 · ET0 (FAO-56 §8: small events evaporate), otherwise 0.8 · P.
 *   Any excess beyond refilling the root zone is deep percolation (Dr floored at 0).
 * Root depth grows linearly from Zr,min at sowing to Zr,max at the end of the
 * development stage (FAO-56 §8, "root development").
 */

export type CropParams = {
  crop: string;
  lIni: number;
  lDev: number;
  lMid: number;
  lLate: number;
  kcIni: number;
  kcMid: number;
  kcEnd: number;
  zrMin: number;
  zrMax: number;
  p: number;
};

export type SoilParams = { soil: string; thetaFc: number; thetaWp: number };

export type DayWeather = { date: string; et0: number | null; precip: number | null };

export type IrrigationEvent = { date: string; depthMm: number | null }; // null = refill to field capacity

export type Stage = "before" | "initial" | "development" | "mid" | "late" | "after";

export const RAIN_IGNORE_FRACTION_OF_ET0 = 0.2;
export const RAIN_EFFECTIVE_FRACTION = 0.8;
export const MEANINGFUL_RAIN_MM = 10;
export const KC_ADJ_MAX = 0.15;

export function seasonLength(c: CropParams): number {
  return c.lIni + c.lDev + c.lMid + c.lLate;
}

/** Day index since sowing (sowing day = 0). Dates are ISO yyyy-mm-dd, interpreted in UTC. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
}

export function stageOf(c: CropParams, day: number): Stage {
  if (day < 0) return "before";
  if (day < c.lIni) return "initial";
  if (day < c.lIni + c.lDev) return "development";
  if (day < c.lIni + c.lDev + c.lMid) return "mid";
  if (day < seasonLength(c)) return "late";
  return "after";
}

/** FAO-56 Kc curve (Eq. 66). Returns null outside the season. */
export function kcOn(c: CropParams, day: number): number | null {
  const s = stageOf(c, day);
  switch (s) {
    case "initial":
      return c.kcIni;
    case "development":
      return c.kcIni + ((day - c.lIni) / c.lDev) * (c.kcMid - c.kcIni);
    case "mid":
      return c.kcMid;
    case "late": {
      const start = c.lIni + c.lDev + c.lMid;
      return c.kcMid + ((day - start) / c.lLate) * (c.kcEnd - c.kcMid);
    }
    default:
      return null;
  }
}

export function rootDepthOn(c: CropParams, day: number): number {
  const end = c.lIni + c.lDev;
  if (day <= 0) return c.zrMin;
  if (day >= end) return c.zrMax;
  return c.zrMin + (day / end) * (c.zrMax - c.zrMin);
}

export function taw(soil: SoilParams, zr: number): number {
  return 1000 * (soil.thetaFc - soil.thetaWp) * zr;
}

export function adjustedP(pTable: number, etc: number): number {
  return Math.min(0.8, Math.max(0.1, pTable + 0.04 * (5 - etc)));
}

export function effectiveRain(precip: number, et0: number): number {
  if (precip <= 0 || precip < RAIN_IGNORE_FRACTION_OF_ET0 * et0) return 0;
  return RAIN_EFFECTIVE_FRACTION * precip;
}

export type BalanceDay = {
  date: string;
  day: number;
  stage: Stage;
  kc: number;
  et0: number;
  etc: number; // potential Kc·ET0
  etcAdj: number; // Ks·Kc·ET0 (actual)
  ks: number;
  precip: number;
  peff: number;
  irrigation: number;
  zr: number;
  taw: number;
  raw: number;
  p: number;
  dr: number; // depletion at end of day
  deepPercolation: number;
  forecast: boolean;
};

export type BalanceInput = {
  crop: CropParams;
  soil: SoilParams;
  sowingDate: string;
  startDate: string; // balance starts at field capacity (Dr = 0) on this date
  weather: DayWeather[]; // consecutive days, starting at or before startDate
  irrigations?: IrrigationEvent[];
  kcFactor?: number; // satellite adjustment, clamped to 1 ± KC_ADJ_MAX
  forecastFrom?: string; // dates ≥ this are flagged as forecast
};

export type BalanceResult = { days: BalanceDay[]; missing: string[] };

/** Run the daily balance. Stops at the first day with missing ET0 or precipitation (listed in `missing`). */
export function runBalance(inp: BalanceInput): BalanceResult {
  const factor = Math.min(1 + KC_ADJ_MAX, Math.max(1 - KC_ADJ_MAX, inp.kcFactor ?? 1));
  const irr = new Map<string, number | null>();
  for (const e of inp.irrigations ?? []) irr.set(e.date, e.depthMm);
  const days: BalanceDay[] = [];
  const missing: string[] = [];
  let dr = 0;
  for (const w of inp.weather) {
    if (w.date < inp.startDate) continue;
    const day = daysBetween(inp.sowingDate, w.date);
    const stage = stageOf(inp.crop, day);
    const kcBase = kcOn(inp.crop, day);
    if (kcBase === null) {
      if (stage === "after") break;
      continue; // before sowing: nothing to track
    }
    if (w.et0 === null || w.precip === null || !Number.isFinite(w.et0) || !Number.isFinite(w.precip)) {
      missing.push(w.date);
      break;
    }
    const kc = stage === "initial" ? kcBase : kcBase * factor;
    const zr = rootDepthOn(inp.crop, day);
    const tawD = taw(inp.soil, zr);
    const etc = kc * w.et0;
    const p = adjustedP(inp.crop.p, etc);
    const rawD = p * tawD;

    // Irrigation applied at the start of the day
    let irrigation = 0;
    if (irr.has(w.date)) {
      const d = irr.get(w.date);
      irrigation = d === null || d === undefined ? dr : d;
    }
    const peff = effectiveRain(w.precip, w.et0);
    // Ks from the depletion at the start of the day (after irrigation), FAO-56 Eq. 84
    const drStart = Math.max(0, dr - irrigation);
    const ks = drStart > rawD ? Math.max(0, (tawD - drStart) / ((1 - p) * tawD)) : 1;
    const etcAdj = ks * etc;
    let next = dr - peff - irrigation + etcAdj;
    let deep = 0;
    if (next < 0) {
      deep = -next;
      next = 0;
    }
    if (next > tawD) next = tawD;
    dr = next;
    days.push({
      date: w.date,
      day,
      stage,
      kc: round(kc, 3),
      et0: round(w.et0, 2),
      etc: round(etc, 2),
      etcAdj: round(etcAdj, 2),
      ks: round(ks, 3),
      precip: round(w.precip, 1),
      peff: round(peff, 2),
      irrigation: round(irrigation, 1),
      zr: round(zr, 3),
      taw: round(tawD, 1),
      raw: round(rawD, 1),
      p: round(p, 3),
      dr: round(dr, 2),
      deepPercolation: round(deep, 2),
      forecast: inp.forecastFrom ? w.date >= inp.forecastFrom : false,
    });
  }
  return { days, missing };
}

export function round(x: number, d: number): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
