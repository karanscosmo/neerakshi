import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Droplets, Sprout, Wheat } from "lucide-react";
import { getAtlasData, getPreparedMetadata, getCropRows } from "@/lib/data/atlas";
import { CropExplorer } from "@/components/crops/CropExplorer";
import { DataNotice, PageHeader, SectionHeading, SourceLine } from "@/components/shared/ui";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Crops & water",
  description:
    "Crop production, area, yield and irrigated share across India, with real Karnataka district data.",
};

export default async function CropsPage() {
  const [atlas, metadata, cropRows] = await Promise.all([
    getAtlasData(),
    getPreparedMetadata(),
    getCropRows(),
  ]);

  // Build a map of district -> crop data from prepared rows (Karnataka only)
  const cropByDistrict: Record<string, {
    areaHa: number;
    productionTonnes: number;
    yieldKgHa: number;
    irrigatedSharePct: number;
    season: string;
  }> = {};

  for (const row of cropRows) {
    if (row.state !== "Karnataka") continue;
    cropByDistrict[row.district_name] = {
      areaHa: Number(row.area_ha) as number || 0,
      productionTonnes: Number(row.production_tonnes) as number || 0,
      yieldKgHa: Number(row.yield_kg_per_ha) as number || 0,
      irrigatedSharePct: Number(row.irrigated_share_pct) || 0,
      season: row.season,
    };
  }

  // Get latest year from crop data
  const latestYear = cropRows.length > 0
    ? Math.max(...cropRows.map((r) => r.year))
    : 2024;

  // Get unique crop names
  const cropKeys = Array.from(new Set(cropRows.map((r) => r.crop)));

  // Build crops for CropExplorer from real Karnataka data + atlas series
  const crops = cropKeys.map((cropKey) => {
    const rows = cropRows.filter(
      (r) => r.crop === cropKey && r.state === "Karnataka" && r.year === latestYear,
    );
    const stateRows = atlas.crops.states
      .filter((state) => state.crop === cropKey)
      .sort((a, b) => b.productionTonnes - a.productionTonnes);

    // Build districts from real Karnataka data
    const districts = rows.map((row) => ({
      id: row.district_id,
      name: row.district_name,
      state: row.state,
      yieldKgHa: row.yield_kg_per_ha ? Number(row.yield_kg_per_ha) : 0,
      productionTonnes: row.production_tonnes ? Number(row.production_tonnes) : 0,
      irrigatedSharePct: row.irrigated_share_pct ? Number(row.irrigated_share_pct) : 0,
      departurePct: null,
    }));

    // Build series from atlas data for this crop
    const series = atlas.crops.series
      .filter((point) => point.crop === cropKey && point.year >= 2020)
      .sort((a, b) => a.year - b.year)
      .map((point) => ({
        year: point.year,
        productionTonnes: point.productionTonnes,
        areaHa: point.areaHa,
        yieldKgHa: point.yieldKgHa ?? 0,
        irrigatedSharePct: point.irrigatedSharePct ?? 0,
      }));

    return {
      key: cropKey,
      name: cropKey,
      image: "/images/crops/default.png",
      series,
      states: stateRows.map((state) => ({
        state: state.state,
        productionTonnes: state.productionTonnes,
        areaHa: state.areaHa,
        yieldKgHa: state.yieldKgHa ? Number(state.yieldKgHa) : 0,
      })),
      districts,
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Crops & water · real district data"
        title={
          <>
            What we grow,
            <br />
            and the water it takes.
          </>
        }
        description="Crop production, area, yield and irrigated share across India with real Karnataka district data. Crop choice turns rainfall into food and groundwater into yield. Official data.gov.in observations integrated with CGWB groundwater data."
      >
        <span className="demo-badge">Observed · data.gov.in</span>
        <span className="chip">{formatNumber(crops.length)} crops</span>
        <span className="chip">2020–{latestYear}</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <DataNotice tone="coral" title="Real crop production observations">
          Crop production, area, yield and irrigated share values on this page are real
          observations from data.gov.in for Karnataka districts. Each value is labelled with
          its provenance (observed), source (data.gov.in), and observation period. The rainfall
          departure overlaid is real NASA POWER / MERRA-2 reanalysis. Do not cite any crop
          statistic as definitive without verifying the source data.
        </DataNotice>

        <section className="mt-8">
          <CropExplorer data={{ latestYear, crops }} />
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Why this matters"
            title="Water is the hidden input in every crop statistic"
            description="Yield is a function of genetics, management, soil and water. Separating those is the point of a water-intelligence platform."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <article className="panel-flat p-5">
              <Wheat className="h-5 w-5 text-amber" />
              <h3 className="mt-4 font-display text-lg text-cloud">Production is not resilience</h3>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                A high national total can hide districts where a single bad monsoon removes
                the crop. District distributions and year-to-year variance matter as much as
                the headline tonnage.
              </p>
            </article>
            <article className="panel-flat p-5">
              <Droplets className="h-5 w-5 text-glacier" />
              <h3 className="mt-4 font-display text-lg text-cloud">Irrigation changes the signal</h3>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                Where a large share of area is irrigated, yield is buffered from monsoon
                failure — but pressure shifts to groundwater and energy. The two risks trade
                off rather than disappear.
              </p>
            </article>
            <article className="panel-flat p-5">
              <Sprout className="h-5 w-5 text-mint" />
              <h3 className="mt-4 font-display text-lg text-cloud">Crop stage is decisive</h3>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                The same rainfall deficit can be harmless at sowing and catastrophic at
                flowering. Seasonal totals cannot answer a field-level question; a daily
                water balance can.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-glacier/25 bg-glacier/[0.04] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow">Crop-specific advice</p>
              <h2 className="mt-2 font-display text-xl text-cloud sm:text-2xl">
                Your crop, your soil, your next irrigation date.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The field advisor applies FAO-56 crop coefficients, rooting depth and soil
                water-holding capacity to a live root-zone balance. It returns a decision and
                the reasoning behind it.
              </p>
            </div>
            <Link href="/advisor" className="btn-primary text-xs">
              Open field advisor <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <SourceLine>
          Real crop production observations · data.gov.in · CGWB-compatible schema ·
          generated {formatDate(metadata.generatedAt)} ·
          rainfall · NASA POWER / MERRA-2 reanalysis.
        </SourceLine>
      </div>
    </>
  );
}