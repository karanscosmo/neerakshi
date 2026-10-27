import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { adjustedP, effectiveRain, kcOn, rootDepthOn, runBalance, stageOf, taw, addDays } from "@/lib/agro/waterBalance";
import { computeAdvisory } from "@/lib/agro/advisory";
import { satelliteAdjustment } from "@/lib/agro/satellite";
import { CROP_PARAMS, SOIL_PARAMS } from "@/lib/agro/reference";

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/water_balance_cases.json"), "utf8"));

describe("FAO-56 building blocks (hand-checked)", () => {
  const maize = CROP_PARAMS.maize;
  it("Kc curve: constant, linear development, mid, linear late", () => {
    expect(kcOn(maize, 0)).toBe(0.3);
    expect(kcOn(maize, 19)).toBe(0.3);
    // halfway through development (day 20 + 17.5): 0.3 + 0.5 × 0.9 = 0.75
    expect(kcOn(maize, 37.5)).toBeCloseTo(0.75, 10);
    expect(kcOn(maize, 60)).toBe(1.2);
    // late season day 95 + 15 of 30: 1.2 + 0.5 × (0.35 − 1.2) = 0.775
    expect(kcOn(maize, 110)).toBeCloseTo(0.775, 10);
    expect(kcOn(maize, 125)).toBeNull();
    expect(stageOf(maize, -1)).toBe("before");
  });
  it("root depth grows linearly to Zr,max at end of development", () => {
    expect(rootDepthOn(maize, 0)).toBe(0.15);
    expect(rootDepthOn(maize, 27.5)).toBeCloseTo(0.75, 10);
    expect(rootDepthOn(maize, 80)).toBe(1.35);
  });
  it("TAW and RAW for loam, Zr 1.0 m", () => {
    expect(taw(SOIL_PARAMS.loam, 1)).toBeCloseTo(130, 10);
    expect(adjustedP(0.55, 5) * 130).toBeCloseTo(71.5, 10);
  });
  it("p adjusts with ETc and stays within 0.1–0.8", () => {
    expect(adjustedP(0.55, 6)).toBeCloseTo(0.51, 10);
    expect(adjustedP(0.55, 3)).toBeCloseTo(0.63, 10);
    expect(adjustedP(0.2, 12)).toBe(0.1);
    expect(adjustedP(0.65, -10)).toBe(0.8);
  });
  it("effective rainfall rule", () => {
    expect(effectiveRain(0.8, 5)).toBe(0);
    expect(effectiveRain(3, 5)).toBeCloseTo(2.4, 10);
    expect(effectiveRain(0, 5)).toBe(0);
  });
});

describe("shared fixtures", () => {
  for (const c of cases) {
    it(c.name, () => {
      const adv = computeAdvisory({ ...c, startAssumedFc: true });
      const e = c.expected;
      if (e.type) expect(adv.type).toBe(e.type);
      if (e.reason) expect(adv.reason).toBe(e.reason);
      if (e.inDays !== undefined) expect(adv.inDays).toBe(e.inDays);
      if (e.nextCheck) expect(adv.nextCheck).toBe(e.nextCheck);
      if (e.dr !== undefined) expect(adv.today?.dr).toBeCloseTo(e.dr, 2);
      if (e.raw !== undefined) expect(adv.today?.raw).toBeCloseTo(e.raw, 1);
      if (e.taw !== undefined) expect(adv.today?.taw).toBeCloseTo(e.taw, 1);
      if (e.ks !== undefined) expect(adv.today?.ks).toBeCloseTo(e.ks, 3);
      if (e.netDepthMm !== undefined) expect(adv.netDepthMm).toBeCloseTo(e.netDepthMm, 1);
      if (e.grossDepthMm !== undefined) expect(adv.grossDepthMm).toBeCloseTo(e.grossDepthMm, 1);
      if (e.grossLitres !== undefined) expect(adv.grossLitres).toBe(e.grossLitres);
    });
  }
  it("balance never leaves [0, TAW]", () => {
    for (const c of cases) {
      const r = runBalance({ ...c, forecastFrom: addDays(c.today, 1) });
      for (const d of r.days) {
        expect(d.dr).toBeGreaterThanOrEqual(0);
        expect(d.dr).toBeLessThanOrEqual(d.taw + 1e-9);
      }
    }
  });
});

describe("satellite adjustment", () => {
  const maize = CROP_PARAMS.maize;
  it("is bounded to ±15 % and skipped for stale or rice observations", () => {
    const hi = satelliteAdjustment(maize, "2025-06-01", "2025-08-10", [{ date: "2025-08-05", ndvi: 0.95, validPct: 90 }]);
    expect(hi.applied).toBe(true);
    expect(hi.factor).toBeLessThanOrEqual(1.15);
    // 1.457·0.95 − 0.1725 = 1.2117; / 1.2 = 1.0098
    expect(hi.factor).toBeCloseTo(1.01, 2);
    const lo = satelliteAdjustment(maize, "2025-06-01", "2025-08-10", [{ date: "2025-08-05", ndvi: 0.2, validPct: 90 }]);
    expect(lo.factor).toBe(0.85);
    expect(lo.mismatch).toBe("low_for_mid");
    const stale = satelliteAdjustment(maize, "2025-06-01", "2025-08-10", [{ date: "2025-07-01", ndvi: 0.8, validPct: 90 }]);
    expect(stale.applied).toBe(false);
    const rice = satelliteAdjustment(CROP_PARAMS.rice, "2025-06-01", "2025-08-10", [{ date: "2025-08-05", ndvi: 0.8, validPct: 90 }]);
    expect(rice.applied).toBe(false);
    const cloudy = satelliteAdjustment(maize, "2025-06-01", "2025-08-10", [{ date: "2025-08-08", ndvi: null, validPct: 0 }]);
    expect(cloudy.applied).toBe(false);
  });
});
