import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CloudRain,
  Droplets,
  Map as MapIcon,
  Satellite,
  Waves,
} from "lucide-react";
import { getAtlasData, getPreparedMetadata } from "@/lib/data/atlas";
import { getMapData } from "@/lib/data/map";
import { DistrictMap } from "@/components/maps/DistrictMap";
import { BarList } from "@/components/charts/BarList";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DataNotice, PageHeader, SectionHeading, SourceLine, Stat } from "@/components/shared/ui";
import { formatDate, formatNumber, formatPercent, STRESS_COLORS } from "@/lib/utils";

export const metadata: Metadata = {
  title: "National overview",
  description:
    "District-level water stress, monsoon departure, groundwater and irrigation signals across 735 Indian districts.",
};

export default async function OverviewPage() {
  const [atlas, mapData, metadata] = await Promise.all([
    getAtlasData(),
    getMapData(),
    getPreparedMetadata(),
  ]);

  const districts = atlas.national.districtsTotal;
  const withRainfall = atlas.national.districtsWithRainfall;
  const severe = atlas.classes.Severe ?? 0;
  const high = atlas.classes.High ?? 0;
  const meanStress = atlas.national.meanStressIndex;

  const classItems = ["Low", "Moderate", "High", "Severe"].map((key) => ({
    label: `${key} stress`,
    value: atlas.classes[key] ?? 0,
    color: STRESS_COLORS[key],
    note:
      key === "Low"
        ? "index < 30"
        : key === "Moderate"
          ? "index 30–55"
          : key === "High"
            ? "index 55–75"
            : "index ≥ 75",
  }));

  const stressedDistricts = [...atlas.districts]
    .filter((district) => district.stress.index !== null)
    .sort((a, b) => (b.stress.index ?? 0) - (a.stress.index ?? 0))
    .slice(0, 8)
    .map((district) => ({
      label: district.name,
      value: district.stress.index ?? 0,
      color: STRESS_COLORS[district.stress.class],
      note: `${district.state} · rainfall ${formatPercent(district.rainfall.departurePct, 1)} · groundwater ${district.groundwater.depthM?.toFixed(1) ?? "—"} m (demo)`,
    }));

  const stressedStates = [...atlas.states]
    .filter((state) => state.stressIndex !== null)
    .sort((a, b) => (b.stressIndex ?? 0) - (a.stressIndex ?? 0))
    .slice(0, 8);

  const monsoonSeries = Object.entries(atlas.national.monsoonSeries)
    .map(([year, total]) => ({
      x: Number(year),
      y: total / Math.max(1, atlas.national.districtsWithRainfall),
    }))
    .sort((a, b) => a.x - b.x);

  const latestDeparture = atlas.national.meanDeparturePct;

  return (
    <>
      <PageHeader
        eyebrow="National overview · 2015–2025"
        title={
          <>
            India&apos;s water stress,
            <br />
            district by district.
          </>
        }
        description="A reproducible, open pipeline combines satellite-era rainfall reanalysis with groundwater, irrigation and crop layers. The result is a national view that can be interrogated down to a single district — and then translated into a field-level irrigation decision."
        aside={
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line">
            <div className="relative h-40">
              <Image
                src="/images/earth/india-satellite.jpg"
                alt="Satellite view of the Indian subcontinent during the monsoon"
                fill
                sizes="(max-width: 1024px) 100vw, 380px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/10 to-transparent" />
              <span className="absolute bottom-3 left-3 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-cloud/80">
                NASA GIBS · VIIRS · 15 Jul 2023
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-line/60 border-t border-line/60 bg-deep-ocean/30">
              <div className="px-4 py-3">
                <p className="font-mono text-[0.52rem] uppercase tracking-[0.12em] text-muted">
                  Districts
                </p>
                <p className="mono mt-1 text-lg text-cloud">{formatNumber(districts)}</p>
              </div>
              <div className="px-4 py-3">
                <p className="font-mono text-[0.52rem] uppercase tracking-[0.12em] text-muted">
                  Data build
                </p>
                <p className="mono mt-1 text-sm text-cloud">{formatDate(metadata.generatedAt)}</p>
              </div>
            </div>
          </div>
        }
      >
        <span className="chip">
          <Satellite className="h-3 w-3" /> Reanalysis rainfall
        </span>
        <span className="chip">
          <MapIcon className="h-3 w-3" /> Official boundaries
        </span>
        <span className="chip">Project-defined composite</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Districts analysed"
            value={formatNumber(districts)}
            note="geoBoundaries ADM2, 36 states and union territories"
            accent="glacier"
          />
          <Stat
            label="Districts with rainfall"
            value={formatNumber(withRainfall)}
            unit={`/ ${formatNumber(districts)}`}
            note="NASA POWER / MERRA-2 monthly reanalysis, 2015–2025"
            accent="mint"
          />
          <Stat
            label="High or severe stress"
            value={formatNumber(high + severe)}
            note={`${formatNumber(severe)} severe · ${formatNumber(high)} high`}
            accent="coral"
          />
          <Stat
            label="Mean stress index"
            value={meanStress !== null ? meanStress.toFixed(1) : "—"}
            unit="/ 100"
            note={`Mean monsoon departure ${formatPercent(latestDeparture, 1)} vs normal`}
            accent="amber"
          />
        </div>

        <div className="mt-5">
          <DataNotice tone="amber" title="Data provenance · read before interpreting">
            Rainfall is a real gridded reanalysis product (NASA POWER / MERRA-2), not an IMD
            gauge interpolation. Groundwater, irrigation and crop production layers are
            deterministic demo fixtures with the same schema as the official sources until
            those downloads are completed. The composite index is project-defined — it is
            not an official government classification.{" "}
            <Link href="/methods" className="underline decoration-amber/50 underline-offset-2">
              Read the methodology
            </Link>
            .
          </DataNotice>
        </div>

        <section className="mt-12">
          <SectionHeading
            eyebrow="Water stress atlas"
            title="Explore the national map"
            description="Switch between the composite index and its underlying components. Scrub rainfall years, compare two monsoons, or search for a district. Click a district to see the full component breakdown."
            aside={
              <Link href="/atlas" className="btn-ghost text-xs">
                Open full atlas <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-5">
            <DistrictMap
              districts={mapData.districts}
              years={mapData.years}
              latestYear={mapData.latestYear}
            />
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="panel-flat p-5 sm:p-6">
            <SectionHeading
              eyebrow="Composite distribution"
              title="How many districts fall in each class?"
              description="Class thresholds are fixed on the 0–100 percentile index so that classes remain comparable across data refreshes."
            />
            <div className="mt-6">
              <BarList
                items={classItems}
                valueSuffix=" districts"
                ariaLabel="District count by water stress class"
              />
            </div>
            <p className="mt-5 text-[0.68rem] leading-relaxed text-muted">
              The index averages percentile ranks for five-year monsoon departure (drier is
              higher), pre-monsoon groundwater depth (deeper is higher) and non-irrigated
              share (less irrigated is higher). Because two components are demo fixtures,
              treat ranking as a demonstration of method, not a policy conclusion.
            </p>
          </div>

          <div className="panel-flat p-5 sm:p-6">
            <SectionHeading
              eyebrow="Hotspots"
              title="Highest composite stress"
              description="Ranked districts under the current build. Hover or follow a district into the atlas."
            />
            <div className="mt-6">
              <BarList
                items={stressedDistricts}
                digits={1}
                max={100}
                ariaLabel="Districts with the highest water stress index"
              />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Monsoon signal"
            title="Eleven years of district rainfall"
            description="Mean monsoon-season rainfall across the 735 districts. Values are derived from monthly NASA POWER / MERRA-2 reanalysis and therefore describe a gridded product, not rain-gauge observations."
            aside={
              <span className="chip">
                <CloudRain className="h-3 w-3" /> mm per district
              </span>
            }
          />
          <div className="panel-flat mt-5 p-4 sm:p-6">
            <TimeSeriesChart
              series={[
                {
                  key: "monsoon",
                  label: "Mean district monsoon rainfall",
                  color: "#48D9E8",
                  area: true,
                  points: monsoonSeries,
                },
              ]}
              height={280}
              yLabel="Monsoon rainfall (mm)"
              xLabel="Year"
              valueSuffix=" mm"
              valueDigits={0}
            />
            <SourceLine>
              Source · NASA POWER API, community AG, parameter PRECTOTCORR · normal
              2015–2024 · generated {formatDate(metadata.generatedAt)}
            </SourceLine>
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel-flat overflow-hidden">
            <div className="border-b border-line/60 p-5 sm:p-6">
              <SectionHeading
                eyebrow="State view"
                title="Where stress concentrates"
                description="State aggregates are unweighted means of district values; they are descriptive, not official state rankings."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State / UT</th>
                    <th className="text-right">Districts</th>
                    <th className="text-right">Stress</th>
                    <th className="text-right">Departure</th>
                    <th className="text-right">Severe</th>
                  </tr>
                </thead>
                <tbody>
                  {stressedStates.map((state) => (
                    <tr key={state.state}>
                      <td className="text-cloud/85">{state.state}</td>
                      <td className="mono text-right text-muted">{state.districts}</td>
                      <td className="mono text-right" style={{ color: STRESS_COLORS[classFor(state.stressIndex)] }}>
                        {state.stressIndex?.toFixed(1) ?? "—"}
                      </td>
                      <td className="mono text-right text-muted">
                        {formatPercent(state.rainfallDeparturePct, 1)}
                      </td>
                      <td className="mono text-right text-muted">{state.severeDistricts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line/60 px-5 py-4">
              <p className="text-[0.65rem] text-muted">
                Top eight states by mean composite stress.
              </p>
              <Link href="/atlas" className="text-xs text-glacier hover:underline">
                All states
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/monsoon"
              className="panel-flat group flex flex-col justify-between p-5 transition-colors hover:border-glacier/40"
            >
              <CloudRain className="h-5 w-5 text-glacier" />
              <div className="mt-8">
                <p className="eyebrow">Monsoon</p>
                <p className="mt-2 font-display text-lg text-cloud">Rainfall departures by year and state</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Time series, heatmaps and district drill-down from reanalysis.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs text-glacier">
                Explore monsoon <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/groundwater"
              className="panel-flat group flex flex-col justify-between p-5 transition-colors hover:border-glacier/40"
            >
              <Droplets className="h-5 w-5 text-glacier" />
              <div className="mt-8">
                <p className="eyebrow">Groundwater · demo</p>
                <p className="mt-2 font-display text-lg text-cloud">Pre- and post-monsoon depth</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  District and state views, clearly labelled as fixtures.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs text-glacier">
                Explore groundwater <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/crops"
              className="panel-flat group flex flex-col justify-between p-5 transition-colors hover:border-glacier/40"
            >
              <Waves className="h-5 w-5 text-mint" />
              <div className="mt-8">
                <p className="eyebrow">Crops · demo</p>
                <p className="mt-2 font-display text-lg text-cloud">Production, area and yield</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Crop-wise trends and rainfall–yield relationships.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-xs text-mint">
                Explore crops <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/advisor"
              className="panel border-glacier/30 bg-glacier/[0.06] p-5 transition-colors hover:bg-glacier/[0.1]"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">Field advisor</span>
                <ArrowUpRight className="h-4 w-4 text-glacier" />
              </div>
              <p className="mt-4 font-display text-lg text-cloud">
                From national signal to one field decision
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Draw a field, pick a crop and soil, and receive an explainable FAO-56
                irrigation recommendation.
              </p>
              <span className="btn-primary mt-5 inline-flex text-xs">Open advisor</span>
            </Link>
          </div>
        </section>

        <SourceLine>
          Build · {metadata.indexVersion} · generated {formatDate(metadata.generatedAt)} ·
          {` ${formatNumber(metadata.districtCount)} districts`} · rainfall source NASA
          POWER / MERRA-2 · boundaries geoBoundaries gbOpen (ODbL) · groundwater,
          irrigation and crop layers are demo fixtures.
        </SourceLine>
      </div>
    </>
  );
}

function classFor(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 30) return "Low";
  if (value < 55) return "Moderate";
  if (value < 75) return "High";
  return "Severe";
}
