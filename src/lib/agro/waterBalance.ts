/**
 * FAO-56 single crop coefficient water balance.
 *
 * Mirrors pipeline/agro.py. Shared JSON fixtures in tests/fixtures are executed
 * by both the TypeScript and Python test suites.
 *
 * References:
 *   FAO Irrigation and Drainage Paper 56 (Allen et al., 1998), Chapters 1, 4, 6, 8.
 *   Crop coefficient tables: FAO-56 Tables 11 and 12.
 *   Soil water retention: FAO-56 Table 19 (approximate texture classes).
 */

export const MODEL_VERSION = "fao56-1.0.0";
export const SIGNIFICANT_RAIN_MM = 10;
const MIN_ROOT_DEPTH_M = 0.15;

export const CROP_REFERENCE = {
  rice: {
    name: "Rice / Paddy",
    kcIni: 1.05,
    kcMid: 1.2,
    kcEnd: 0.9,
    stageLengths: [30, 30, 60, 30],
    zrMaxM: 0.6,
    pDepletion: 0.2,
    yieldKgHa: 3900,
  },
  wheat: {
    name: "Wheat",
    kcIni: 0.3,
    kcMid: 1.15,
    kcEnd: 0.4,
    stageLengths: [20, 30, 50, 30],
    zrMaxM: 1.5,
    pDepletion: 0.55,
    yieldKgHa: 3200,
  },
  maize: {
    name: "Maize",
    kcIni: 0.3,
    kcMid: 1.2,
    kcEnd: 0.5,
    stageLengths: [20, 35, 40, 30],
    zrMaxM: 1.2,
    pDepletion: 0.55,
    yieldKgHa: 2800,
  },
  sugarcane: {
    name: "Sugarcane",
    kcIni: 0.4,
    kcMid: 1.25,
    kcEnd: 0.75,
    stageLengths: [30, 60, 180, 60],
    zrMaxM: 1.2,
    pDepletion: 0.65,
    yieldKgHa: 70000,
  },
} as const;

export const SOIL_REFERENCE = {
  sandy: { name: "Sandy", fieldCapacity: 0.1, wiltingPoint: 0.05, infiltration: 30 },
  loam: { name: "Loam", fieldCapacity: 0.29, wiltingPoint: 0.12, infiltration: 15 },
  clay_loam: { name: "Clay loam", fieldCapacity: 0.36, wiltingPoint: 0.18, infiltration: 5 },
  clay: { name: "Clay", fieldCapacity: 0.42, wiltingPoint: 0.24, infiltration: 2 },
} as const;

export const IRRIGATION_EFFICIENCY = { flood: 0.6, furrow: 0.7, drip: 0.9 } as const;

export type CropKey = keyof typeof CROP_REFERENCE;
export type SoilKey = keyof typeof SOIL_REFERENCE;
export type IrrigationMethod = keyof typeof IRRIGATION_EFFICIENCY;
export type Decision =
  | "IRRIGATE_NOW"
  | "IRRIGATE_IN_DAYS"
  | "WAIT_FOR_RAIN"
  | "NO_IRRIGATION"
  | "UNAVAILABLE";

export interface ForecastInput {
  date?: string;
  et0Mm: number | null;
  rainMm: number | null;
}

export interface SatelliteInput {
  ndvi?: number | null;
  validFraction?: number | null;
  sceneDate?: string | null;
  cloudCover?: number | null;
}

export interface AdvisoryPayload {
  crop: string;
  soil: string;
  irrigationMethod?: string;
  assessmentDate?: string;
  sowingDate: string;
  previousDepletionMm?: number | null;
  areaHa?: number;
  forecast: ForecastInput[];
  satellite?: SatelliteInput | null;
}

export interface DailyBalance {
  date: string;
  et0Mm: number;
  rainMm: number;
  effectiveRainMm: number;
  kc: number;
  etcMm: number;
  depletionMm: number;
  irrigationMm: number;
}

export interface AdvisoryResult {
  status: "ok" | "unavailable";
  modelVersion: string;
  decision: Decision;
  decisionLabel: string;
  reason?: string;
  reasonCodes: string[];
  daysUntilAction?: number;
  assessmentDate?: string;
  sowingDate?: string;
  nextAssessmentDate?: string;
  crop?: string;
  cropName?: string;
  soil?: string;
  growthStage?: string;
  stageIndex?: number;
  daysAfterSowing?: number;
  kc?: number;
  kcAdjusted?: number;
  satelliteAdjustment?: number;
  rootDepthM?: number;
  tawMm?: number;
  rawMm?: number;
  depletionMm?: number;
  todayDepletionMm?: number;
  et0Mm?: number;
  etcMm?: number;
  effectiveRainMm?: number;
  forecastRain7dMm?: number;
  netIrrigationMm?: number;
  grossIrrigationMm?: number;
  irrigationEfficiency?: number;
  volumeLitres?: number;
  areaHa?: number;
  daily?: DailyBalance[];
  confidence?: number;
  satellite?: { ndvi: number | null; validFraction: number | null; used: boolean };
}

function parseDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const parsed = new Date(value);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

export function stageForDay(
  daysAfterSowing: number,
  stageLengths: readonly number[],
): { stage: string; index: number; fraction: number } {
  const names = ["initial", "development", "mid", "late"];
  let remaining = Math.max(daysAfterSowing, 0);
  for (let index = 0; index < stageLengths.length; index += 1) {
    const length = stageLengths[index];
    if (remaining < length || index === stageLengths.length - 1) {
      const fraction = length > 0 ? Math.min(remaining / length, 1) : 1;
      return { stage: names[index], index, fraction };
    }
    remaining -= length;
  }
  return { stage: "late", index: 3, fraction: 1 };
}

export function cropCoefficient(
  crop: CropKey,
  daysAfterSowing: number,
): { kc: number; stage: string; index: number } {
  const reference = CROP_REFERENCE[crop];
  const { stage, index, fraction } = stageForDay(daysAfterSowing, reference.stageLengths);
  let kc: number;
  if (index === 0) {
    kc = reference.kcIni;
  } else if (index === 1) {
    kc = reference.kcIni + (reference.kcMid - reference.kcIni) * fraction;
  } else if (index === 2) {
    kc = reference.kcMid;
  } else {
    kc = reference.kcMid + (reference.kcEnd - reference.kcMid) * fraction;
  }
  return { kc: round(kc, 4), stage, index };
}

export function rootDepth(crop: CropKey, daysAfterSowing: number): number {
  const reference = CROP_REFERENCE[crop];
  const total = reference.stageLengths.reduce((sum, value) => sum + value, 0);
  const fraction = Math.min(Math.max(daysAfterSowing / Math.max(total * 0.55, 1), 0), 1);
  return round(MIN_ROOT_DEPTH_M + (reference.zrMaxM - MIN_ROOT_DEPTH_M) * fraction, 3);
}

export function totalAvailableWater(soil: SoilKey, rootDepthM: number): number {
  const reference = SOIL_REFERENCE[soil];
  return 1000 * (reference.fieldCapacity - reference.wiltingPoint) * rootDepthM;
}

export function effectiveRainfall(rainMm: number): number {
  if (rainMm <= 0) return 0;
  return round(Math.min(rainMm, (rainMm * (125 - 0.2 * rainMm)) / 125), 2);
}

export function satelliteKcAdjustment(
  ndvi: number | null | undefined,
  validFraction: number | null | undefined,
): number {
  if (ndvi === null || ndvi === undefined || validFraction === null || validFraction === undefined) {
    return 0;
  }
  if (validFraction < 0.3) return 0;
  if (ndvi < 0.25) return -0.05;
  if (ndvi < 0.4) return -0.025;
  if (ndvi > 0.75) return 0.025;
  return 0;
}

function unavailable(message: string): AdvisoryResult {
  return {
    status: "unavailable",
    modelVersion: MODEL_VERSION,
    decision: "UNAVAILABLE",
    decisionLabel: "Advisory unavailable",
    reason: message,
    reasonCodes: ["missing_critical_input"],
  };
}

export function computeAdvisory(payload: AdvisoryPayload): AdvisoryResult {
  const crop = payload.crop as CropKey;
  const soil = payload.soil as SoilKey;
  const method = (payload.irrigationMethod ?? "flood") as IrrigationMethod;

  if (!(crop in CROP_REFERENCE) || !(soil in SOIL_REFERENCE)) {
    return unavailable("Crop or soil type is not in the FAO-56 reference table.");
  }

  const forecast = payload.forecast ?? [];
  if (forecast.length === 0) {
    return unavailable("A seven-day weather forecast is required for the water balance.");
  }

  const et0Values = forecast.map((day) => day.et0Mm);
  if (et0Values.some((value) => value === null || value === undefined || !Number.isFinite(Number(value)))) {
    return unavailable("Reference evapotranspiration (ET0) is missing from the forecast.");
  }

  const assessmentDate = parseDate(payload.assessmentDate ?? isoDate(new Date()));
  const sowingDate = parseDate(payload.sowingDate);
  const daysAfterSowing = daysBetween(assessmentDate, sowingDate);
  if (daysAfterSowing < 0) {
    return unavailable("The sowing date is after the assessment date.");
  }

  const reference = CROP_REFERENCE[crop];
  const { kc, stage, index: stageIndex } = cropCoefficient(crop, daysAfterSowing);
  const zr = rootDepth(crop, daysAfterSowing);
  const taw = totalAvailableWater(soil, zr);
  const raw = reference.pDepletion * taw;
  const satellite = payload.satellite ?? {};
  const adjustment = satelliteKcAdjustment(satellite.ndvi, satellite.validFraction);
  const kcAdjusted = round(Math.max(0.1, kc + adjustment), 4);

  const previous = payload.previousDepletionMm ?? 0;
  const depletion = Math.max(0, Math.min(Number(previous), taw));

  const efficiency = IRRIGATION_EFFICIENCY[method] ?? 0.6;
  const areaHa = Number(payload.areaHa ?? 1);

  const daily: DailyBalance[] = [];
  for (let index = 0; index < Math.min(7, forecast.length); index += 1) {
    const day = forecast[index];
    const dayDate = day.date
      ? parseDate(day.date)
      : addDays(assessmentDate, index);
    const dayKcRaw = cropCoefficient(crop, daysAfterSowing + index).kc;
    const dayKc = round(Math.max(0.1, dayKcRaw + adjustment), 4);
    const et0 = Number(day.et0Mm ?? 0);
    const rain = Number(day.rainMm ?? 0);
    const peff = effectiveRainfall(rain);
    const etc = dayKc * et0;

    let dayDepletion: number;
    if (index === 0) {
      dayDepletion = Math.max(0, Math.min(depletion - peff + etc, taw));
    } else {
      dayDepletion = Math.max(0, Math.min(daily[index - 1].depletionMm - peff + etc, taw));
    }

    daily.push({
      date: isoDate(dayDate),
      et0Mm: round(et0, 2),
      rainMm: round(rain, 2),
      effectiveRainMm: peff,
      kc: dayKc,
      etcMm: round(etc, 2),
      depletionMm: round(dayDepletion, 2),
      irrigationMm: 0,
    });
  }

  const today = daily[0];
  let decision: Decision = "NO_IRRIGATION";
  let targetDay: DailyBalance | null = null;
  const reasonCodes: string[] = [];

  const futureRain2d = daily.slice(1, 3).reduce((sum, day) => sum + day.effectiveRainMm, 0);
  const futureRain7d = daily.slice(1).reduce((sum, day) => sum + day.effectiveRainMm, 0);
  const deficit = Math.max(0, today.depletionMm - raw);

  if (today.depletionMm >= raw) {
    if (futureRain2d >= SIGNIFICANT_RAIN_MM && futureRain2d >= deficit) {
      decision = "WAIT_FOR_RAIN";
      reasonCodes.push("raw_reached_but_rain_expected");
    } else {
      decision = "IRRIGATE_NOW";
      targetDay = today;
      reasonCodes.push("depletion_at_or_above_raw");
    }
  } else {
    let thresholdDay: DailyBalance | null = null;
    for (const day of daily.slice(1)) {
      if (day.depletionMm >= raw) {
        thresholdDay = day;
        break;
      }
    }
    if (thresholdDay) {
      const thresholdIndex = daily.indexOf(thresholdDay);
      const daysBefore = daily.slice(1, thresholdIndex);
      const rainBefore = daysBefore.reduce((sum, day) => sum + day.effectiveRainMm, 0);
      if (futureRain2d >= SIGNIFICANT_RAIN_MM) {
        decision = "WAIT_FOR_RAIN";
        reasonCodes.push("rain_expected_before_threshold");
      } else if (rainBefore >= SIGNIFICANT_RAIN_MM) {
        decision = "WAIT_FOR_RAIN";
        reasonCodes.push("rain_expected_before_threshold");
      } else {
        decision = "IRRIGATE_IN_DAYS";
        targetDay = thresholdDay;
        reasonCodes.push("raw_expected_within_seven_days");
      }
    } else if (futureRain7d >= 20) {
      decision = "WAIT_FOR_RAIN";
      reasonCodes.push("rain_expected_before_threshold");
    } else {
      decision = "NO_IRRIGATION";
      reasonCodes.push("depletion_below_raw");
      targetDay = daily[daily.length - 1];
    }
  }

  let net = 0;
  if (decision === "IRRIGATE_NOW") {
    net = Math.max(0, today.depletionMm);
  } else if (decision === "IRRIGATE_IN_DAYS" && targetDay) {
    net = Math.max(0, targetDay.depletionMm);
  }
  net = round(net, 2);
  const gross = net > 0 ? round(net / efficiency, 2) : 0;
  const volumeLitres = round(gross * areaHa * 10_000, 0);
  const daysUntil = targetDay ? -daysBetween(assessmentDate, parseDate(targetDay.date)) : 0;

  const confidence = round(
    0.6 * 1 +
      0.2 * (satellite.ndvi !== null && satellite.ndvi !== undefined ? 1 : 0) +
      0.2 * (payload.previousDepletionMm !== null && payload.previousDepletionMm !== undefined ? 1 : 0.5),
    2,
  );

  const labels: Record<Decision, string> = {
    IRRIGATE_NOW: "Irrigate now",
    IRRIGATE_IN_DAYS: "Irrigate in {n} days",
    WAIT_FOR_RAIN: "Wait for rain",
    NO_IRRIGATION: "No irrigation required",
    UNAVAILABLE: "Advisory unavailable",
  };

  return {
    status: "ok",
    modelVersion: MODEL_VERSION,
    decision,
    decisionLabel: labels[decision].replace("{n}", String(Math.max(0, daysUntil))),
    daysUntilAction: Math.max(0, daysUntil),
    assessmentDate: isoDate(assessmentDate),
    sowingDate: isoDate(sowingDate),
    nextAssessmentDate: isoDate(addDays(assessmentDate, 1)),
    crop,
    cropName: reference.name,
    soil,
    growthStage: stage,
    stageIndex,
    daysAfterSowing,
    kc,
    kcAdjusted,
    satelliteAdjustment: adjustment,
    rootDepthM: zr,
    tawMm: round(taw, 2),
    rawMm: round(raw, 2),
    depletionMm: round(depletion, 2),
    todayDepletionMm: today.depletionMm,
    et0Mm: today.et0Mm,
    etcMm: today.etcMm,
    effectiveRainMm: today.effectiveRainMm,
    forecastRain7dMm: round(
      daily.slice(1).reduce((sum, day) => sum + day.rainMm, 0),
      2,
    ),
    netIrrigationMm: net,
    grossIrrigationMm: gross,
    irrigationEfficiency: efficiency,
    volumeLitres,
    areaHa,
    reasonCodes,
    daily,
    confidence,
    satellite: {
      ndvi: satellite.ndvi ?? null,
      validFraction: satellite.validFraction ?? null,
      used: satellite.ndvi !== null && satellite.ndvi !== undefined,
    },
  };
}
