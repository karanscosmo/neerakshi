import "server-only";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";

type DistrictFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { id: string; name: string; st: string }>;
let cache: DistrictFeature[] | null = null;

function load(): DistrictFeature[] {
  if (cache) return cache;
  const topo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "districts.topo.json"), "utf8")) as Topology;
  const fc = feature(topo, topo.objects.districts as GeometryCollection) as unknown as GeoJSON.FeatureCollection;
  cache = fc.features as DistrictFeature[];
  return cache;
}

/** Census 2011 district containing a point, or null (point-in-polygon on the simplified boundaries). */
export function districtAt(lon: number, lat: number): { id: string; name: string } | null {
  for (const f of load()) {
    if (geoContains(f, [lon, lat])) return { id: f.properties.id, name: f.properties.name };
  }
  return null;
}
