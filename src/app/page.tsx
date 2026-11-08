import { EarthJourney, type JourneyData } from "@/components/journey/EarthJourney";
import { getAtlasData } from "@/lib/data/atlas";

export default async function Home() {
  const atlas = await getAtlasData();
  const latestCropYear = atlas.crops.latestYear ?? atlas.metadata.latestYear;
  const cropTotals = new Map<string, { production: number; yieldSum: number; count: number }>();
  for (const row of atlas.crops.series) {
    if (row.year !== latestCropYear) continue;
    const entry = cropTotals.get(row.crop) ?? { production: 0, yieldSum: 0, count: 0 };
    entry.production += row.productionTonnes;
    entry.yieldSum += row.yieldKgHa ?? 0;
    entry.count += 1;
    cropTotals.set(row.crop, entry);
  }
  const cropOrder = ["rice", "wheat", "maize", "sugarcane"];
  const crops = cropOrder.map((crop) => {
    const entry = cropTotals.get(crop);
    const meta = atlas.crops.series.find((row) => row.crop === crop);
    return {
      crop,
      cropName: meta?.cropName ?? crop,
      productionTonnes: entry?.production ?? 0,
      yieldKgHa: entry && entry.count > 0 ? entry.yieldSum / entry.count : null,
    };
  });

  const years = Object.keys(atlas.national.monsoonSeries).length;
  const data: JourneyData = {
    districtCount: atlas.metadata.districtCount,
    latestYear: atlas.metadata.latestYear,
    meanDeparturePct: atlas.national.meanDeparturePct,
    meanGroundwaterDepthM: atlas.national.meanGroundwaterDepthM,
    meanIrrigatedSharePct: atlas.national.meanIrrigatedSharePct,
    monsoonSeries: Object.entries(atlas.national.monsoonSeries).map(([year, value]) => ({
      year: Number(year),
      value,
    })),
    stressClasses: atlas.classes,
    generatedAt: atlas.metadata.generatedAt,
    monthlyObservations: atlas.metadata.districtCount * years * 12,
    crops,
  };

  return <EarthJourney data={data} />;
}
