import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import { getAtlasData, getPreparedMetadata } from "@/lib/data/atlas";
import { getMapData } from "@/lib/data/map";
import { DistrictMap } from "@/components/maps/DistrictMap";
import { DistrictTable, type TableDistrict } from "@/components/atlas/DistrictTable";
import { DataNotice, PageHeader, SectionHeading, SourceLine } from "@/components/shared/ui";
import { formatDate, formatNumber, formatPercent, STRESS_COLORS } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Water stress atlas",
  description:
    "Interactive district-level water stress atlas for India with rainfall, groundwater and irrigation layers.",
};

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string }>;
}) {
  const [atlas, mapData, metadata, params] = await Promise.all([
    getAtlasData(),
    getMapData(),
    getPreparedMetadata(),
    searchParams,
  ]);

  const tableDistricts: TableDistrict[] = atlas.districts.map((district) => ({
    id: district.id,
    name: district.name,
    state: district.state,
    areaKm2: district.areaKm2,
    stressIndex: district.stress.index,
    stressClass: district.stress.class,
    departurePct: district.rainfall.departurePct,
    departure5yPct: district.rainfall.departure5yPct,
    groundwaterDepth: district.groundwater.depthM,
    irrigatedShare: district.irrigation.sharePct,
  }));

  const sortedStates = [...atlas.states].sort(
    (a, b) => (b.stressIndex ?? -1) - (a.stressIndex ?? -1),
  );

  return (
    <>
      <PageHeader
        eyebrow="Water stress atlas · district level"
        title={
          <>
            One map.
            <br />
            Every district.
          </>
        }
        description="Explore the composite Water Stress Index and each of its components. Every layer is labelled with its provenance, observation period and source. The index is analytical and project-defined, not an official classification."
      >
        <span className="chip">{formatNumber(atlas.metadata.districtCount)} districts</span>
        <span className="chip">Rainfall 2015–2025</span>
        <span className="chip">Index v{metadata.indexVersion}</span>
        <span className="chip">Generated {formatDate(metadata.generatedAt)}</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <DataNotice tone="amber" title="Provenance on every layer">
          Rainfall is NASA POWER / MERRA-2 reanalysis. Boundaries are geoBoundaries gbOpen
          (ODbL). Groundwater, irrigation and crop layers are deterministic demo fixtures
          until the official CGWB, ICRISAT and data.gov.in downloads are completed. The
          composite index is a project-defined analytical construct.
        </DataNotice>

        <section className="mt-8">
          <DistrictMap
            districts={mapData.districts}
            years={mapData.years}
            latestYear={mapData.latestYear}
            heightClassName="h-[72vh] min-h-[520px]"
            initialSelectedId={params.district ?? null}
          />
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="panel-flat p-5 sm:p-6">
            <SectionHeading
              eyebrow="Class summary"
              title="National distribution"
              description="Class boundaries are fixed on the percentile composite so that counts remain comparable when data are refreshed."
            />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["Low", "Moderate", "High", "Severe"].map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-line/70 bg-midnight/25 p-3"
                  style={{ borderColor: `${STRESS_COLORS[key]}44` }}
                >
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
                    {key}
                  </p>
                  <p
                    className="mono mt-1.5 text-2xl"
                    style={{ color: STRESS_COLORS[key] }}
                  >
                    {formatNumber(atlas.classes[key] ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[0.55rem] text-muted">
                    {key === "Low"
                      ? "< 30"
                      : key === "Moderate"
                        ? "30–55"
                        : key === "High"
                          ? "55–75"
                          : "≥ 75"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[0.7rem] leading-relaxed text-muted">
              {atlas.metadata.stressDefinition}
            </p>
          </div>

          <div className="panel-flat p-5 sm:p-6">
            <SectionHeading
              eyebrow="Deeper context"
              title="Read the method behind the numbers"
              description="The atlas is a presentation layer over a reproducible Python pipeline. Interrogate the transformation, validation and limitations."
            />
            <div className="mt-5 space-y-2">
              <Link
                href="/methods"
                className="flex min-h-11 items-center justify-between rounded-lg border border-line px-3 text-sm text-cloud/80 hover:border-glacier/40 hover:text-cloud"
              >
                Methodology and source register <ArrowUpRight className="h-4 w-4 text-glacier" />
              </Link>
              <Link
                href="/monsoon"
                className="flex min-h-11 items-center justify-between rounded-lg border border-line px-3 text-sm text-cloud/80 hover:border-glacier/40 hover:text-cloud"
              >
                Monsoon rainfall analysis <ArrowUpRight className="h-4 w-4 text-glacier" />
              </Link>
              <a
                href="/geo/districts.geojson"
                download
                className="flex min-h-11 items-center justify-between rounded-lg border border-line px-3 text-sm text-cloud/80 hover:border-glacier/40 hover:text-cloud"
              >
                District boundaries GeoJSON <Download className="h-4 w-4 text-glacier" />
              </a>
              <Link
                href="/advisor"
                className="flex min-h-11 items-center justify-between rounded-lg border border-glacier/30 bg-glacier/5 px-3 text-sm text-glacier hover:bg-glacier/10"
              >
                Take a district into the field advisor{" "}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow="State aggregates"
            title="State and union territory summary"
            description="Unweighted means of district values. Small districts therefore carry the same weight as large ones; treat these as descriptive summaries, not official rankings."
          />
          <div className="mt-5 overflow-x-auto rounded-xl border border-line/70">
            <table className="data-table">
              <thead>
                <tr>
                  <th>State / UT</th>
                  <th className="text-right">Districts</th>
                  <th className="text-right">Mean stress</th>
                  <th className="text-right">Monsoon departure</th>
                  <th className="text-right">Groundwater</th>
                  <th className="text-right">Irrigated share</th>
                  <th className="text-right">Severe districts</th>
                </tr>
              </thead>
              <tbody>
                {sortedStates.map((state) => (
                  <tr key={state.state}>
                    <td className="text-cloud/85">{state.state}</td>
                    <td className="mono text-right text-muted">{state.districts}</td>
                    <td
                      className="mono text-right"
                      style={{
                        color: STRESS_COLORS[classFor(state.stressIndex)],
                      }}
                    >
                      {state.stressIndex?.toFixed(1) ?? "—"}
                    </td>
                    <td className="mono text-right text-muted">
                      {formatPercent(state.rainfallDeparturePct, 1)}
                    </td>
                    <td className="mono text-right text-muted">
                      {state.groundwaterDepthM?.toFixed(1) ?? "—"} m
                    </td>
                    <td className="mono text-right text-muted">
                      {state.irrigatedSharePct?.toFixed(0) ?? "—"}%
                    </td>
                    <td className="mono text-right text-muted">{state.severeDistricts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceLine>
            Rainfall · NASA POWER / MERRA-2 reanalysis · groundwater and irrigation · demo
            fixtures for schema demonstration.
          </SourceLine>
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow="District register"
            title="Search, sort and export"
            description="Filter by state, class or name. Sorting is client-side over the prepared dataset. The CSV export preserves provenance fields so downstream analysis cannot silently lose the demo labels."
            aside={
              <span className="chip">
                <Download className="h-3 w-3" /> CSV export
              </span>
            }
          />
          <div className="panel-flat mt-5 p-4 sm:p-5">
            <DistrictTable districts={tableDistricts} />
          </div>
          <SourceLine>
            Boundaries · geoBoundaries gbOpen 2021 ADM2 (ODbL) · rainfall · NASA POWER
            PRECTOTCORR monthly reanalysis · groundwater, irrigation · deterministic demo
            fixtures · index · percentile composite v{metadata.indexVersion}.
          </SourceLine>
        </section>
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
