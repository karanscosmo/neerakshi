import { describe, expect, it } from "vitest";
import { clamp, formatNumber, formatPercent, stressColor } from "../../src/lib/utils";

describe("utils", () => {
  it("formats Indian-grouped numbers", () => {
    expect(formatNumber(97020)).toBe("97,020");
    expect(formatNumber(null)).toBe("—");
  });

  it("keeps the sign on percentage departures", () => {
    expect(formatPercent(10.829, 1)).toBe("+10.8%");
    expect(formatPercent(-4.2, 1)).toBe("-4.2%");
  });

  it("maps stress classes to their boundary colours", () => {
    expect(stressColor(29.9)).toBe("#8CE5B1");
    expect(stressColor(30)).toBe("#F2B85B");
    expect(stressColor(75)).toBe("#FF6B65");
    expect(stressColor(null)).toBe("#8CA8B5");
  });

  it("clamps values to a range", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
  });
});
