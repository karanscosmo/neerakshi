import { describe, expect, it } from "vitest";
import { RAMPS, luminance, simulateCvd, colorFor } from "@/lib/shared/scales";

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("colour scales", () => {
  it("sequential ramps change lightness monotonically", () => {
    for (const k of ["stress", "groundwater", "irrigation"] as const) {
      const L = RAMPS[k].stops.map(luminance);
      const inc = L.every((x, i) => i === 0 || x <= L[i - 1] + 1e-9);
      const dec = L.every((x, i) => i === 0 || x >= L[i - 1] - 1e-9);
      expect(inc || dec, k).toBe(true);
    }
  });
  it("diverging ends stay distinguishable under protan, deutan and tritan simulation", () => {
    for (const k of ["monsoon", "ndvi"] as const) {
      const s = RAMPS[k].stops;
      for (const cvd of ["protan", "deutan", "tritan"] as const) {
        expect(dist(simulateCvd(s[0], cvd), simulateCvd(s[s.length - 1], cvd)), `${k} ${cvd}`).toBeGreaterThan(0.25);
        // each end is distinguishable from the neutral midpoint
        const mid = s[Math.floor(s.length / 2)];
        expect(dist(simulateCvd(s[0], cvd), simulateCvd(mid, cvd))).toBeGreaterThan(0.25);
        expect(dist(simulateCvd(s[s.length - 1], cvd), simulateCvd(mid, cvd))).toBeGreaterThan(0.25);
      }
    }
  });
  it("missing values never get a ramp colour", () => {
    expect(colorFor(RAMPS.stress, null)).toBeNull();
    expect(colorFor(RAMPS.stress, Number.NaN)).toBeNull();
  });
});
