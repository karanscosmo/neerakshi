import { describe, expect, it } from "vitest";
import { buildStatsRequest, EVALSCRIPT, parseStats } from "@/lib/server/cdse";

// Shape follows the Sentinel Hub Statistical API documentation. The numbers are
// test inputs for the parser, not satellite observations.
const response = {
  status: "OK",
  data: [
    {
      interval: { from: "2025-08-03T00:00:00Z", to: "2025-08-04T00:00:00Z" },
      outputs: {
        ndvi: { bands: { B0: { stats: { min: 0.2, max: 0.8, mean: 0.61, stDev: 0.05, sampleCount: 100, noDataCount: 10, percentiles: { "50.0": 0.63 } } } } },
        ndwi: { bands: { B0: { stats: { min: 0.0, max: 0.4, mean: 0.21, stDev: 0.03, sampleCount: 100, noDataCount: 10, percentiles: { "50.0": 0.22 } } } } },
      },
    },
    {
      interval: { from: "2025-08-01T00:00:00Z", to: "2025-08-02T00:00:00Z" },
      outputs: {
        ndvi: { bands: { B0: { stats: { min: "NaN", max: "NaN", mean: "NaN", stDev: "NaN", sampleCount: 100, noDataCount: 100 } } } },
        ndwi: { bands: { B0: { stats: { min: "NaN", max: "NaN", mean: "NaN", stDev: "NaN", sampleCount: 100, noDataCount: 100 } } } },
      },
    },
  ],
};

describe("Copernicus Statistical API client", () => {
  it("builds a daily, SCL-masked request for the polygon", () => {
    const poly: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[76.7, 12.6], [76.71, 12.6], [76.71, 12.61], [76.7, 12.6]]] };
    const r = buildStatsRequest(poly, "2025-07-01", "2025-08-10");
    expect(r.input.bounds.geometry).toBe(poly);
    expect(r.input.data[0].type).toBe("sentinel-2-l2a");
    expect(r.aggregation.aggregationInterval.of).toBe("P1D");
    expect(r.aggregation.timeRange.from).toBe("2025-07-01T00:00:00Z");
    expect(EVALSCRIPT).toContain("s.SCL == 4 || s.SCL == 5");
  });
  it("parses medians, keeps cloudy days as gaps, sorts by date", () => {
    const out = parseStats(response);
    expect(out).toEqual([
      { date: "2025-08-01", ndvi: null, ndwi: null, validPct: 0 },
      { date: "2025-08-03", ndvi: 0.63, ndwi: 0.22, validPct: 90 },
    ]);
  });
  it("rejects malformed responses instead of inventing values", () => {
    expect(() => parseStats({ foo: 1 })).toThrow();
  });
});
