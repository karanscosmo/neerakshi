import { geoArea, geoCentroid } from "d3-geo";

const EARTH_R = 6_371_008.8; // mean radius, m

/** Area of a GeoJSON polygon in hectares (spherical excess, d3-geo). */
export function polygonAreaHa(p: GeoJSON.Polygon): number {
  // d3-geo expects clockwise exterior rings for "small" polygons; GeoJSON (RFC 7946) is counter-clockwise.
  const sr = geoArea({ type: "Feature", properties: {}, geometry: p } as GeoJSON.Feature);
  const steradians = sr > 2 * Math.PI ? 4 * Math.PI - sr : sr;
  return (steradians * EARTH_R * EARTH_R) / 10_000;
}

export function polygonCentroid(p: GeoJSON.Polygon): [number, number] {
  return geoCentroid({ type: "Feature", properties: {}, geometry: p } as GeoJSON.Feature) as [number, number];
}

/** A square of `areaHa` around a point (used when a farmer drops a pin instead of drawing). */
export function squareAround(lon: number, lat: number, areaHa: number): GeoJSON.Polygon {
  const side = Math.sqrt(areaHa * 10_000); // m
  const dLat = side / 2 / 111_320;
  const dLon = side / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    type: "Polygon",
    coordinates: [
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ],
    ],
  };
}

export const HA_PER_ACRE = 0.40468564224;
export const haToAcres = (ha: number) => ha / HA_PER_ACRE;

/** Rough India bounding box check (mainland + islands). */
export function inIndia(lon: number, lat: number): boolean {
  return lon >= 67 && lon <= 98.5 && lat >= 6 && lat <= 37.5;
}
