import { geoArea, geoCentroid } from "d3-geo";

const EARTH_R = 6_371_008.8; // mean radius, m

/** Planar signed area of a lon/lat ring (> 0 = counter-clockwise). */
function signedArea(ring: GeoJSON.Position[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a / 2;
}

/**
 * d3-geo treats a ring's interior by winding: exterior rings must be clockwise,
 * otherwise the polygon is read as "the whole sphere minus this field".
 * GeoJSON (RFC 7946) and drawing tools produce counter-clockwise rings, so rewind.
 */
export function forD3(p: GeoJSON.Polygon): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: p.coordinates.map((ring, i) => {
      const ccw = signedArea(ring) < 0 ? false : true;
      const wantCw = i === 0;
      return wantCw === !ccw ? ring : [...ring].reverse();
    }),
  };
}

/** Area of a GeoJSON polygon in hectares (spherical excess, d3-geo). */
export function polygonAreaHa(p: GeoJSON.Polygon): number {
  const sr = geoArea({ type: "Feature", properties: {}, geometry: forD3(p) } as GeoJSON.Feature);
  return (sr * EARTH_R * EARTH_R) / 10_000;
}

export function polygonCentroid(p: GeoJSON.Polygon): [number, number] {
  return geoCentroid({ type: "Feature", properties: {}, geometry: forD3(p) } as GeoJSON.Feature) as [number, number];
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
