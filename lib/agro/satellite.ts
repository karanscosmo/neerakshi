/**
 * Bounded satellite adjustment of the crop coefficient, and a stage check.
 *
 * Kc from NDVI: Kc_ndvi = 1.457 · NDVI − 0.1725
 *   (Kamble, Kilic & Hubbard 2013, "Estimating crop coefficients using remote
 *   sensing-based vegetation index", Remote Sensing 5(4):1588–1602).
 * factor = Kc_ndvi / Kc_FAO, clamped to [0.85, 1.15] (±15 %), applied only when
 *   - the latest cloud-free NDVI is ≤ 10 days old,
 *   - the crop is in the development, mid or late stage, and
 *   - the crop is not rice (standing water depresses NDVI, Kamble's fit is for upland crops).
 *
 * Stage check (flag only, never changes the advice):
 *   expected mid-season but NDVI < 0.30  → "low greenness for mid-season"
 *   expected initial stage but NDVI > 0.60 → "already green: sowing date may be earlier"
 */
import { KC_ADJ_MAX, kcOn, stageOf, type CropParams, type Stage } from "./waterBalance";

export type NdviObs = { date: string; ndvi: number | null; validPct: number };

export const NDVI_MAX_AGE_DAYS = 10;

export type SatelliteAdjustment = {
  factor: number; // 1 = no change
  applied: boolean;
  latest?: NdviObs;
  kcNdvi?: number;
  mismatch: null | "low_for_mid" | "green_for_initial";
  stage: Stage;
};

export function satelliteAdjustment(crop: CropParams, sowingDate: string, today: string, series: NdviObs[]): SatelliteAdjustment {
  const day = Math.round((Date.parse(today) - Date.parse(sowingDate)) / 86_400_000);
  const stage = stageOf(crop, day);
  const valid = series.filter((s) => s.ndvi !== null && s.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const latest = valid.at(-1);
  const res: SatelliteAdjustment = { factor: 1, applied: false, latest, mismatch: null, stage };
  if (!latest || latest.ndvi === null) return res;
  const age = Math.round((Date.parse(today) - Date.parse(latest.date)) / 86_400_000);
  if (age > NDVI_MAX_AGE_DAYS) return res;
  if (stage === "mid" && latest.ndvi < 0.3) res.mismatch = "low_for_mid";
  if (stage === "initial" && latest.ndvi > 0.6) res.mismatch = "green_for_initial";
  const latestDay = Math.round((Date.parse(latest.date) - Date.parse(sowingDate)) / 86_400_000);
  const kcFao = kcOn(crop, latestDay);
  if (crop.crop === "rice" || kcFao === null || !["development", "mid", "late"].includes(stageOf(crop, latestDay))) return res;
  const kcNdvi = 1.457 * latest.ndvi - 0.1725;
  const f = Math.min(1 + KC_ADJ_MAX, Math.max(1 - KC_ADJ_MAX, kcNdvi / kcFao));
  return { ...res, factor: Math.round(f * 1000) / 1000, applied: true, kcNdvi: Math.round(kcNdvi * 1000) / 1000 };
}
