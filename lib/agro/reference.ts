/**
 * Reference tables (FAO-56) bundled from data/reference/*.csv at build time.
 * Keep in sync by running `npm run test` — tests/reference.test.ts compares them with the CSVs.
 */
import type { CropParams, SoilParams } from "./waterBalance";

export const CROPS = ["rice", "wheat", "maize", "sugarcane"] as const;
export type Crop = (typeof CROPS)[number];
export const SOILS = ["sandy", "loam", "clay_loam", "clay"] as const;
export type Soil = (typeof SOILS)[number];
export const METHODS = ["flood", "furrow", "drip"] as const;
export type Method = (typeof METHODS)[number];

export const CROP_PARAMS: Record<Crop, CropParams> = {
  rice: { crop: "rice", lIni: 30, lDev: 30, lMid: 60, lLate: 30, kcIni: 1.05, kcMid: 1.2, kcEnd: 0.75, zrMin: 0.15, zrMax: 0.7, p: 0.2 },
  wheat: { crop: "wheat", lIni: 15, lDev: 25, lMid: 50, lLate: 30, kcIni: 0.3, kcMid: 1.15, kcEnd: 0.3, zrMin: 0.15, zrMax: 1.25, p: 0.55 },
  maize: { crop: "maize", lIni: 20, lDev: 35, lMid: 40, lLate: 30, kcIni: 0.3, kcMid: 1.2, kcEnd: 0.35, zrMin: 0.15, zrMax: 1.35, p: 0.55 },
  sugarcane: { crop: "sugarcane", lIni: 30, lDev: 50, lMid: 180, lLate: 60, kcIni: 0.4, kcMid: 1.25, kcEnd: 0.75, zrMin: 0.2, zrMax: 1.6, p: 0.65 },
};

export const SOIL_PARAMS: Record<Soil, SoilParams> = {
  sandy: { soil: "sandy", thetaFc: 0.23, thetaWp: 0.11 },
  loam: { soil: "loam", thetaFc: 0.25, thetaWp: 0.12 },
  clay_loam: { soil: "clay_loam", thetaFc: 0.335, thetaWp: 0.205 },
  clay: { soil: "clay", thetaFc: 0.36, thetaWp: 0.22 },
};

export const METHOD_EFFICIENCY: Record<Method, number> = { flood: 0.6, furrow: 0.6, drip: 0.9 };
