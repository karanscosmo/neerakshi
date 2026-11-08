import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

export type Provenance = "observed" | "reanalysis" | "demo_fixture";

export interface AtlasDistrict {
  id: string;
  name: string;
  state: string;
  centroid: [number, number];
  areaKm2: number | null;
  rainfall: {
    departurePct: number | null;
    departure5yPct: number | null;
    monsoonMm: number | null;
    normalMm: number | null;
    soilMoisture: number | null;
    soilMoistureAnomaly: number | null;
    tempC: number | null;
    provenance: Provenance;
    source: string;
  };
  groundwater: {
    depthM: number | null;
    preMonsoonM: number | null;
    postMonsoonM: number | null;
    year: number | null;
    provenance: Provenance;
  };
  irrigation: {
    sharePct: number | null;
    irrigatedAreaHa: number | null;
    netSownAreaHa: number | null;
    year: number | null;
    provenance: Provenance;
  };
  stress: {
    index: number | null;
    class: string;
    components: { rainfall: number | null; groundwater: number | null; irrigation: number | null };
    available: number;
  };
}

export interface AtlasState {
  state: string;
  districts: number;
  stressIndex: number | null;
  rainfallDeparturePct: number | null;
  groundwaterDepthM: number | null;
  irrigatedSharePct: number | null;
  severeDistricts: number;
}

export interface CropSeriesPoint {
  crop: string;
  cropName: string;
  year: number;
  areaHa: number;
  productionTonnes: number;
  yieldKgHa: number | null;
  irrigatedSharePct: number;
}

export interface CropStateRow {
  crop: string;
  state: string;
  productionTonnes: number;
  areaHa: number;
  yieldKgHa: number | null;
}

export interface AtlasData {
  metadata: {
    generatedAt: string;
    latestYear: number;
    indexVersion: string;
    districtCount: number;
    stressDefinition: string;
    stressNotice: string;
    provenance: Record<string, { type: string; source: string }>;
    demoNotice: string;
  };
  classes: Record<string, number>;
  districts: AtlasDistrict[];
  states: AtlasState[];
  national: {
    monsoonSeries: Record<string, number>;
    stateSeries: Record<string, Record<string, number>>;
    meanStressIndex: number | null;
    meanDeparturePct: number | null;
    meanGroundwaterDepthM: number | null;
    meanIrrigatedSharePct: number | null;
    districtsWithRainfall: number;
    districtsTotal: number;
  };
  crops: {
    latestYear?: number;
    series: CropSeriesPoint[];
    states: CropStateRow[];
  };
  groundwater: {
    series: { year: number; preMonsoonDepthM: number; postMonsoonDepthM: number }[];
    states: { state: string; preMonsoonDepthM: number; postMonsoonDepthM: number; changeM: number }[];
  };
}

export interface SeasonRow {
  district_id: string;
  district_name: string;
  state: string;
  year: number;
  monsoon_mm: number;
  annual_mm: number;
  monsoon_normal_mm: number;
  annual_normal_mm: number;
  departure_pct: number;
  source: string;
  provenance: string;
}

export interface GroundwaterRow {
  district_id: string;
  district_name: string;
  state: string;
  year: number;
  pre_monsoon_depth_m: number;
  post_monsoon_depth_m: number;
  change_m: number;
  source: string;
  provenance: string;
}

export interface CropRow {
  district_id: string;
  district_name: string;
  state: string;
  year: number;
  season: string;
  crop: string;
  crop_name: string;
  area_ha: number;
  production_tonnes: number;
  yield_kg_per_ha: number;
  irrigated_share_pct: number;
  source: string;
  provenance: string;
}

const DATA_DIR = path.join(process.cwd(), "data", "prepared");

let atlasCache: AtlasData | null = null;

export async function getAtlasData(): Promise<AtlasData> {
  if (atlasCache) return atlasCache;
  const raw = await fs.readFile(path.join(DATA_DIR, "atlas.json"), "utf8");
  atlasCache = JSON.parse(raw) as AtlasData;
  return atlasCache;
}

async function readCsv<T>(filename: string): Promise<T[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf8");
  const result = Papa.parse<T>(raw, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return result.data;
}

let seasonCache: SeasonRow[] | null = null;
export async function getSeasonRainfall(): Promise<SeasonRow[]> {
  if (!seasonCache) seasonCache = await readCsv<SeasonRow>("rainfall_district_season.csv");
  return seasonCache;
}

let groundwaterCache: GroundwaterRow[] | null = null;
export async function getGroundwaterRows(): Promise<GroundwaterRow[]> {
  if (!groundwaterCache) groundwaterCache = await readCsv<GroundwaterRow>("groundwater_district.csv");
  return groundwaterCache;
}

let cropCache: CropRow[] | null = null;
export async function getCropRows(): Promise<CropRow[]> {
  if (!cropCache) cropCache = await readCsv<CropRow>("crop_production.csv");
  return cropCache;
}

export async function getPreparedMetadata() {
  const raw = await fs.readFile(path.join(DATA_DIR, "metadata.json"), "utf8");
  return JSON.parse(raw) as {
    generatedAt: string;
    indexVersion: string;
    districtCount: number;
    rainfallDistricts: number;
    datasets: Record<string, { provenance: string; source?: string; period?: string }>;
    files: Record<string, { bytes: number; sha256: string }>;
  };
}

export function districtById(atlas: AtlasData, id: string) {
  return atlas.districts.find((district) => district.id === id) ?? null;
}

export interface MonthlyRow {
  district_id: string;
  district_name: string;
  state: string;
  year: number;
  month: number;
  rainfall_mm: number;
  temp_mean_c: number;
  soil_moisture: number;
  source: string;
  provenance: string;
}

let monthlyCache: MonthlyRow[] | null = null;
export async function getMonthlyRainfall(): Promise<MonthlyRow[]> {
  if (!monthlyCache) monthlyCache = await readCsv<MonthlyRow>("rainfall_district_monthly.csv");
  return monthlyCache;
}

interface KarnatakaGwRow {
  district: string;
  latitude: number;
  longitude: number;
  groundwaterLevel_m: number;
  observationDate: string;
  year: number;
}

let karnatakaGwCache: KarnatakaGwRow[] | null = null;

export async function getKarnatakaGroundwaterRows(): Promise<KarnatakaGwRow[]> {
  if (!karnatakaGwCache) {
    const raw = await fs.readFile(path.join(DATA_DIR, "groundwater_karnataka.csv"), "utf8");
    const parsed = Papa.parse<KarnatakaGwRow>(raw, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    }).data;
    karnatakaGwCache = parsed.length > 0 ? parsed : [];
  }
  return karnatakaGwCache;
}

interface KarnatakaIrrRow {
  district: string;
  year: number;
  netSownAreaHa: number;
  irrigatedAreaHa: number;
  irrigatedSharePct: number;
  source: string;
  provenance: string;
}

let karnatakaIrrCache: KarnatakaIrrRow[] | null = null;

export async function getKarnatakaIrrigationRows(): Promise<KarnatakaIrrRow[]> {
  if (!karnatakaIrrCache) {
    const raw = await fs.readFile(path.join(DATA_DIR, "irrigation_district.csv"), "utf8");
    const parsed = Papa.parse<KarnatakaIrrRow>(raw, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    }).data;
    karnatakaIrrCache = parsed.length > 0 ? parsed : [];
  }
  return karnatakaIrrCache;
}

function aggregateKarnatakaGwDistricts(
  gwRows: KarnatakaGwRow[]
): Record<string, { preMonsoonDepthM: number; postMonsoonDepthM: number; year: number; count: number }> {
  const districtData: Record<string, { depths: number[]; years: number[] }> = {};

  for (const row of gwRows) {
    const district = row.district;
    if (!districtData[district]) {
      districtData[district] = { depths: [], years: [] };
    }
    districtData[district].depths.push(parseFloat(String(row.groundwaterLevel_m)));
    districtData[district].years.push(row.year);
  }

  const result: Record<string, { preMonsoonDepthM: number; postMonsoonDepthM: number; year: number; count: number }> = {};

  for (const [district, data] of Object.entries(districtData)) {
    const preMean =
      data.depths.length > 0 ? data.depths.reduce((a, b) => a + b, 0) / data.depths.length : null;
    const postMean = preMean;
    const latestYear = data.years.length > 0 ? Math.max(...data.years) : null;

    result[district] = {
      preMonsoonDepthM: preMean ?? 0,
      postMonsoonDepthM: postMean ?? 0,
      year: latestYear ?? 0,
      count: data.depths.length,
    };
  }

  return result;
}

export function mergeKarnatakaGwIntoAtlas(
  atlas: AtlasData,
  gwRows: KarnatakaGwRow[]
): AtlasData {
  const districtStats = aggregateKarnatakaGwDistricts(gwRows);

  const hasAnyRealData = atlas.districts.some((district) => {
    const districtName = district.name;
    const stats = districtStats[districtName];
    return !!stats && stats.count > 0;
  });

  const updatedDistricts = atlas.districts.map((district) => {
    const districtName = district.name;
    const stats = districtStats[districtName];
    if (!stats) return district;

    const updated: AtlasDistrict = {
      ...district,
      groundwater: {
        depthM: hasAnyRealData ? stats.preMonsoonDepthM : district.groundwater.depthM,
        preMonsoonM: hasAnyRealData ? stats.preMonsoonDepthM : district.groundwater.preMonsoonM,
        postMonsoonM: hasAnyRealData ? stats.postMonsoonDepthM : district.groundwater.postMonsoonM,
        year: hasAnyRealData ? stats.year : district.groundwater.year,
        provenance: hasAnyRealData ? "observed" : district.groundwater.provenance,
      },
    };

    return updated;
  });

  return {
    ...atlas,
    districts: updatedDistricts,
    metadata: {
      ...atlas.metadata,
      provenance: {
        ...atlas.metadata.provenance,
        groundwater: hasAnyRealData
          ? { type: "observed", source: "CGWB monitoring stations" }
          : atlas.metadata.provenance.groundwater,
      },
      demoNotice:
        hasAnyRealData
          ? "Groundwater data includes real CGWB observations for Karnataka districts. Other districts use demo fixtures."
          : atlas.metadata.demoNotice,
    },
  };
}