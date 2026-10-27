import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/shared/csv";
import { CROP_PARAMS, SOIL_PARAMS, METHOD_EFFICIENCY } from "@/lib/agro/reference";

const ref = (f: string) => parseCsv(fs.readFileSync(path.join(process.cwd(), "data/reference", f), "utf8"));

describe("bundled FAO-56 tables match data/reference CSVs", () => {
  it("crops", () => {
    for (const r of ref("fao56_crops.csv")) {
      const c = CROP_PARAMS[r.crop as keyof typeof CROP_PARAMS];
      expect(c, r.crop).toBeDefined();
      for (const k of ["lIni", "lDev", "lMid", "lLate"] as const) expect(c[k]).toBe(Number(r[`${k[0]}_${k.slice(1).toLowerCase()}_d`]));
      expect(c.kcIni).toBe(Number(r.kc_ini));
      expect(c.kcMid).toBe(Number(r.kc_mid));
      expect(c.kcEnd).toBe(Number(r.kc_end));
      expect(c.zrMin).toBe(Number(r.zr_min_m));
      expect(c.zrMax).toBe(Number(r.zr_max_m));
      expect(c.p).toBe(Number(r.p));
    }
  });
  it("soils", () => {
    for (const r of ref("soil_types.csv")) {
      const s = SOIL_PARAMS[r.soil as keyof typeof SOIL_PARAMS];
      expect(s.thetaFc).toBe(Number(r.theta_fc));
      expect(s.thetaWp).toBe(Number(r.theta_wp));
      expect(Math.round(1000 * (s.thetaFc - s.thetaWp))).toBe(Number(r.taw_mm_per_m));
    }
  });
  it("irrigation methods", () => {
    for (const r of ref("irrigation_methods.csv")) expect(METHOD_EFFICIENCY[r.method as keyof typeof METHOD_EFFICIENCY]).toBe(Number(r.application_efficiency));
  });
});
