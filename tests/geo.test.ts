import { describe, expect, it } from "vitest";
import { polygonAreaHa, polygonCentroid, squareAround } from "@/lib/shared/geo";

describe("field geometry", () => {
  it("gives the same area and centroid for both ring windings", () => {
    const sq = squareAround(76.9, 12.52, 1); // 1 ha square
    const rev: GeoJSON.Polygon = { type: "Polygon", coordinates: [[...sq.coordinates[0]].reverse()] };
    for (const p of [sq, rev]) {
      expect(polygonAreaHa(p)).toBeCloseTo(1, 1);
      const [lon, lat] = polygonCentroid(p);
      expect(lon).toBeCloseTo(76.9, 4);
      expect(lat).toBeCloseTo(12.52, 4);
    }
  });
  it("hand check: 100 m × 100 m ≈ 1 ha", () => {
    const d = 50 / 111_320;
    const p: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[0 - d, -d], [d, -d], [d, d], [-d, d], [-d, -d]]] };
    expect(polygonAreaHa(p)).toBeCloseTo(1.0, 1);
  });
});
