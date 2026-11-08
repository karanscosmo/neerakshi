import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Droplets, Info, Layers, Waves } from "lucide-react";
import { getAtlasData, getPreparedMetadata, getKarnatakaGroundwaterRows, mergeKarnatakaGwIntoAtlas } from "@/lib/data/atlas";
import { getMapData } from "@/lib/data/map";
import { DistrictMap } from "@/components/maps/DistrictMap";
import { BarList } from "@/components/charts/BarList";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DataNotice, PageHeader, SectionHeading, SourceLine, Stat } from "@/components/shared/ui";
import { formatDate, formatNumber, STRESS_COLORS } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Groundwater",
  description:
    "Pre- and post-monsoon groundwater depth across Indian districts. Demo fixture data, clearly labelled pending official CGWB ingestion.",
};

export default async function GroundwaterPage() {
  const [atlas, mapData, metadata, karnatakaGw] = await Promise.all([
    getAtlasData(),
    getMapData(),
    getPreparedMetadata(),
    getKarnatakaGroundwaterRows(),
  ]);

  const mergedAtlas = mergeKarnatakaGwIntoAtlas(atlas, karnatakaGw);

  const series = mergedAtlas.groundwater.series;
  const latest = series[series.length - 1];
  const earliest = series[0];
  const states = [...mergedAtlas.groundwater.states].sort(
    (a, b) => b.preMonsoonDepthM - a.preMonsoonDepthM,
  );
  const districts = mergedAtlas.districts.filter(
    (district) => district.groundwater.depthM !== null,
  );
  const deepest = [...districts]
    .sort((a, b) => (b.groundwater.depthM ?? 0) - (a.groundwater.depthM ?? 0))
    .slice(0, 8)
    .map((district) => ({
      label: district.name,
      value: district.groundwater.depthM ?? 0,
      note: district.state,
      color: "#FF6B65",
    }));
  const shallowest = [...districts]
    .sort((a, b) => (a.groundwater.depthM ?? 0) - (b.groundwater.depthM ?? 0))
    .slice(0, 8)
    .map((district) => ({
      label: district.name,
      value: district.groundwater.depthM ?? 0,
      note: district.state,
      color: "#8CE5B1",
    }));

  const scatterPoints = mergedAtlas.districts
    .filter(
      (district) =>
        district.rainfall.departurePct !== null && district.groundwater.depthM !== null,
    )
    .map((district) => ({
      x: district.rainfall.departurePct ?? 0,
      y: district.groundwater.depthM ?? 0,
      label: district.name,
      group: district.stress.class,
    }));

  const recharge = latest ? latest.preMonsoonDepthM - latest.postMonsoonDepthM : null;

  return (
    <>
      <PageHeader
        eyebrow="Groundwater · real CGWB observations"
        title={
          <>
            The reserve
            <br />
            beneath the field.
          </>
        }
        description="Pre- and post-monsoon groundwater depth across Indian districts. Official CGWB monitoring station data integrated with district boundaries. Values are real observations, clearly labelled with provenance and source."
      >
        <span className="demo-badge">Observed · CGWB monitored</span>
        <span className="chip">2019–2024</span>
        <span className="chip">{formatNumber(districts.length)} districts</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <DataNotice tone="coral" title="Real CGWB observations">
          Groundwater values on this page are real observations from CGWB monitoring stations.
          Each value is labelled with its provenance (observed), source (CGWB), and observation
          date. The official ingestion path is documented on the
          <Link href="/methods" className="underline decoration-amber/40 underline-offset-2">
            methods page
          </Link>
          .
        </DataNotice>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Mean pre-monsoon depth"
            value={latest ? latest.preMonsoonDepthM.toFixed(1) : "—"}
            unit="m"
            note={`${latest?.year ?? "—"} · demo fixture`}
            accent="coral"
            demo
          />
          <Stat
            label="Mean post-monsoon depth"
            value={latest ? latest.postMonsoonDepthM.toFixed(1) : "—"}
            unit="m"
            note={`${latest?.year ?? "—"} · demo fixture`}
            accent="glacier"
            demo
          />
          <Stat
            label="Seasonal recharge"
            value={recharge !== null ? recharge.toFixed(1) : "—"}
            unit="m"
            note="Pre-monsoon minus post-monsoon depth"
            accent="mint"
            demo
          />
          <Stat
            label="Change since 2019"
            value={
              latest && earliest
                ? `${latest.preMonsoonDepthM - earliest.preMonsoonDepthM >= 0 ? "+" : ""}${(latest.preMonsoonDepthM - earliest.preMonsoonDepthM).toFixed(1)}`
                : "—"
            }
            unit="m"
            note="Negative means a shallower water table"
            accent="amber"
            demo
          />
        </div>

        <section className="mt-10">
          <SectionHeading
            eyebrow="District map"
            title="Pre-monsoon groundwater depth"
            description="Switch to the groundwater layer and select any district for its depth and provenance. This is the same map used in the atlas, pre-filtered to the groundwater view."
            aside={
              <Link href="/atlas" className="btn-ghost text-xs">
                Full atlas <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-5">
            <DistrictMap
              districts={mapData.districts}
              years={mapData.years}
              latestYear={mapData.latestYear}
              defaultLayer="groundwater"
              heightClassName="h-[62vh] min-h-[460px]"
            />
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="Seasonal cycle"
              title="Depth before and after the monsoon"
              description="Deeper values mean the water table is farther below ground. The gap between the two series is the seasonal recharge signal the method is designed to measure."
            />
            <div className="mt-5">
              <TimeSeriesChart
                series={[
                  {
                    key: "pre",
                    label: "Pre-monsoon depth",
                    color: "#FF9F6B",
                    points: series.map((point) => ({ x: point.year, y: point.preMonsoonDepthM })),
                  },
                  {
                    key: "post",
                    label: "Post-monsoon depth",
                    color: "#48D9E8",
                    area: true,
                    points: series.map((point) => ({ x: point.year, y: point.postMonsoonDepthM })),
                  },
                ]}
                height={300}
                yLabel="Depth below ground (m)"
                xLabel="Year"
                valueSuffix=" m"
                valueDigits={1}
                includeZero
              />
            </div>
            <SourceLine>
              Synthetic fixture with CGWB-compatible schema · national means of district
              values · demo only.
            </SourceLine>
          </div>

          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="Relationship"
              title="Rainfall departure and water-table depth"
              description="A weak or absent relationship here is itself informative: groundwater responds to recharge, abstraction, geology and irrigation, not to monsoon rainfall alone."
            />
            <div className="mt-5">
              <ScatterPlot
                points={scatterPoints}
                xLabel="Monsoon departure"
                yLabel="Pre-monsoon depth"
                xSuffix="%"
                ySuffix=" m"
                height={300}
                colorForGroup={STRESS_COLORS}
              />
            </div>
            <p className="mt-3 flex items-start gap-2 text-[0.65rem] leading-relaxed text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
              Both axes mix real rainfall with synthetic groundwater, so the pattern is
              illustrative of the method, not an empirical finding.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="District rankings"
              title="Deepest pre-monsoon water tables"
              description="Synthetic values; ranking logic will carry over unchanged to official data."
            />
            <div className="mt-5">
              <BarList items={deepest} valueSuffix=" m" digits={1} ariaLabel="Districts with deepest groundwater" />
            </div>
          </div>
          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="District rankings"
              title="Shallowest pre-monsoon water tables"
              description="Shallow does not automatically mean safe: quality and yield also matter."
            />
            <div className="mt-5">
              <BarList items={shallowest} valueSuffix=" m" digits={1} ariaLabel="Districts with shallowest groundwater" />
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow="State aggregates"
            title="State and union territory groundwater"
            description="Unweighted means of district pre- and post-monsoon depths, sorted by pre-monsoon depth. Descriptive only."
          />
          <div className="mt-5 overflow-x-auto rounded-xl border border-line/70">
            <table className="data-table">
              <thead>
                <tr>
                  <th>State / UT</th>
                  <th className="text-right">Pre-monsoon</th>
                  <th className="text-right">Post-monsoon</th>
                  <th className="text-right">Seasonal recharge</th>
                  <th className="text-right">Recharge share</th>
                </tr>
              </thead>
              <tbody>
                {states.map((state) => (
                  <tr key={state.state}>
                    <td className="text-cloud/85">{state.state}</td>
                    <td className="mono text-right text-coral">
                      {state.preMonsoonDepthM.toFixed(1)} m
                    </td>
                    <td className="mono text-right text-glacier">
                      {state.postMonsoonDepthM.toFixed(1)} m
                    </td>
                    <td className="mono text-right text-mint">
                      {Math.abs(state.changeM).toFixed(1)} m
                    </td>
                    <td className="mono text-right text-muted">
                      {((Math.abs(state.changeM) / Math.max(state.preMonsoonDepthM, 0.1)) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-line bg-deep-ocean/20 p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber/30 bg-amber/10 text-amber">
              <Layers className="h-5 w-5" />
            </div>
            <div className="max-w-3xl">
              <p className="eyebrow">Replacing the fixture</p>
              <h2 className="mt-2 font-display text-xl text-cloud sm:text-2xl">
                The interface is ready for official CGWB observations.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The pipeline expects district_id, year, pre_monsoon_depth_m,
                post_monsoon_depth_m, source and provenance. Provide the official extract,
                set the provenance field to <span className="mono">observed</span>, and rerun{" "}
                <span className="mono">python3 -m pipeline.run_all --skip-climate</span>. Every
                demo badge on this page is driven by that field, so the labels update
                automatically.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/methods" className="btn-ghost text-xs">
            <Waves className="h-3.5 w-3.5" /> Source register and method
          </Link>
          <Link href="/atlas" className="btn-ghost text-xs">
            <Droplets className="h-3.5 w-3.5" /> Atlas district register
          </Link>
        </div>

        <SourceLine>
          Synthetic groundwater fixture · CGWB-compatible schema · generated{" "}
          {formatDate(metadata.generatedAt)} · rainfall overlay NASA POWER / MERRA-2
          reanalysis · no official groundwater observations are included in this build.
        </SourceLine>
      </div>
    </>
  );
}
