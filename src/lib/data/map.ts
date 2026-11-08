import "server-only";

import { getAtlasData, getPreparedMetadata, mergeKarnatakaGwIntoAtlas } from "@/lib/data/atlas";
import { getSeasonRainfall, getKarnatakaGroundwaterRows } from "@/lib/data/atlas";
import type { MapDistrict } from "@/components/maps/DistrictMap";

export async function getMapData(): Promise<{
  districts: MapDistrict[];
  years: number[];
  latestYear: number;
}> {
  const [atlas, season, metadata, karnatakaGw] = await Promise.all([
    getAtlasData(),
    getSeasonRainfall(),
    getPreparedMetadata(),
    getKarnatakaGroundwaterRows(),
  ]);

  const mergedAtlas = mergeKarnatakaGwIntoAtlas(atlas, karnatakaGw);
  const latest = atlas.metadata.latestYear;
  const years = Array.from({ length: 5 }, (_, index) => latest - 4 + index).filter(
    (year) => year >= 2015,
  );

  const rainfall = new Map<string, Record<string, number | null>>();
  for (const row of season) {
    if (!years.includes(row.year)) continue;
    const entry = rainfall.get(row.district_id) ?? {};
    entry[String(row.year)] = row.departure_pct ?? null;
    rainfall.set(row.district_id, entry);
  }

  const districts: MapDistrict[] = mergedAtlas.districts.map((district) => ({
    id: district.id,
    name: district.name,
    state: district.state,
    centroid: district.centroid,
    stressIndex: district.stress.index,
    stressClass: district.stress.class,
    rainfallDeparture: district.rainfall.departurePct,
    groundwaterDepth: district.groundwater.depthM,
    irrigatedShare: district.irrigation.sharePct,
    rainfallYears: rainfall.get(district.id) ?? {},
    groundwaterYear: district.groundwater.year,
    irrigationYear: district.irrigation.year,
    rainfallScore: district.stress.components.rainfall,
    groundwaterScore: district.stress.components.groundwater,
    irrigationScore: district.stress.components.irrigation,
    componentsAvailable: district.stress.available,
  }));

  return { districts, years, latestYear: mergedAtlas.metadata.latestYear };
}
