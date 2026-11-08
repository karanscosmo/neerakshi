import "server-only";

import { getAtlasData, getCropRows } from "@/lib/data/atlas";
import { CROP_IMAGES, DEFAULT_CROP_IMAGE } from "@/lib/cropImages";

export interface CropDistrictPoint {
  id: string;
  name: string;
  state: string;
  yieldKgHa: number;
  productionTonnes: number;
  irrigatedSharePct: number;
  departurePct: number | null;
}

export interface CropExplorerCrop {
  key: string;
  name: string;
  image: string;
  series: {
    year: number;
    productionTonnes: number;
    areaHa: number;
    yieldKgHa: number;
    irrigatedSharePct: number;
  }[];
  states: {
    state: string;
    productionTonnes: number;
    areaHa: number;
    yieldKgHa: number;
  }[];
  districts: CropDistrictPoint[];
}

export interface CropExplorerData {
  latestYear: number;
  crops: CropExplorerCrop[];
}

export async function getCropExplorerData(): Promise<CropExplorerData> {
  const [atlas, rows] = await Promise.all([getAtlasData(), getCropRows()]);
  const latestYear = atlas.crops.latestYear ?? atlas.metadata.latestYear;
  const departure = new Map(
    atlas.districts.map((district) => [district.id, district.rainfall.departurePct]),
  );

  const rowsByCrop = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.year !== latestYear) continue;
    const list = rowsByCrop.get(row.crop) ?? [];
    list.push(row);
    rowsByCrop.set(row.crop, list);
  }

  const crops: CropExplorerCrop[] = thunkCrops(atlas).map((crop) => {
    const cropRows = rowsByCrop.get(crop.key) ?? [];
    return {
      key: crop.key,
      name: crop.name,
      image: CROP_IMAGES[crop.key] ?? DEFAULT_CROP_IMAGE,
      series: atlas.crops.series
        .filter((point) => point.crop === crop.key)
        .sort((a, b) => a.year - b.year)
        .map((point) => ({
          year: point.year,
          productionTonnes: point.productionTonnes,
          areaHa: point.areaHa,
          yieldKgHa: point.yieldKgHa ?? 0,
          irrigatedSharePct: point.irrigatedSharePct,
        })),
      states: atlas.crops.states
        .filter((state) => state.crop === crop.key)
        .sort((a, b) => b.productionTonnes - a.productionTonnes)
        .map((state) => ({
          state: state.state,
          productionTonnes: state.productionTonnes,
          areaHa: state.areaHa,
          yieldKgHa: state.yieldKgHa ?? 0,
        })),
      districts: cropRows
        .map((row) => ({
          id: row.district_id,
          name: row.district_name,
          state: row.state,
          yieldKgHa: Number(row.yield_kg_per_ha),
          productionTonnes: Number(row.production_tonnes),
          irrigatedSharePct: Number(row.irrigated_share_pct),
          departurePct: departure.get(row.district_id) ?? null,
        }))
        .filter((row) => Number.isFinite(row.yieldKgHa) && row.yieldKgHa > 0)
        .sort((a, b) => b.yieldKgHa - a.yieldKgHa),
    };
  });

  return { latestYear, crops: crops.filter((crop) => crop.series.length > 0) };
}

function thunkCrops(atlas: Awaited<ReturnType<typeof getAtlasData>>) {
  const seen = new Map<string, string>();
  for (const point of atlas.crops.series) seen.set(point.crop, point.cropName);
  return Array.from(seen, ([key, name]) => ({ key, name }));
}
