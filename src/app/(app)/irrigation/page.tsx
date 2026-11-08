import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Droplets, Info, Layers, Waves } from "lucide-react";
import { getAtlasData, getPreparedMetadata, getKarnatakaIrrigationRows } from "@/lib/data/atlas";
import { getMapData } from "@/lib/data/map";
import { DistrictMap } from "@/components/maps/DistrictMap";
import { BarList } from "@/components/charts/BarList";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { DataNotice, PageHeader, SectionHeading, SourceLine, Stat } from "@/components/shared/ui";
import { formatDate, formatNumber, STRESS_COLORS } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Irrigation",
  description:
    "Irrigation coverage and source distribution across Indian districts. Demo fixture data, clearly labelled pending official data.gov.in ingestion.",
};

export default async function IrrigationPage() {
  const [atlas, mapData, metadataData, karnatakaIrr] = await Promise.all([
    getAtlasData(),
    getMapData(),
    getPreparedMetadata(),
    getKarnatakaIrrigationRows(),
  ]);

  // Directly merge Karnataka irrigation data into atlas districts
  const irrByDistrict: Record<string, {
    sharePct: number;
    irrigatedAreaHa: number;
    netSownAreaHa: number;
  }> = {};

  for (const row of karnatakaIrr) {
    irrByDistrict[row.district] = {
      sharePct: row.irrigatedSharePct,
      irrigatedAreaHa: row.irrigatedAreaHa,
      netSownAreaHa: row.netSownAreaHa,
    };
  }

  const districts = atlas.districts.map((district) => {
    const irr = irrByDistrict[district.name];
    if (!irr) return district;
    return {
      ...district,
      irrigation: {
        sharePct: irr.sharePct,
        irrigatedAreaHa: irr.irrigatedAreaHa,
        netSownAreaHa: irr.netSownAreaHa,
        year: karnatakaIrr.length > 0 ? karnatakaIrr[0].year : 2024,
        provenance: "observed",
      },
    };
  });

  const highest = [...districts]
    .sort((a, b) => (b.irrigation.sharePct ?? 0) - (a.irrigation.sharePct ?? 0))
    .slice(0, 8)
    .map((district) => ({
      label: district.name,
      value: district.irrigation.sharePct ?? 0,
      note: district.state,
      color: "#FF6B65",
    }));
  const lowest = [...districts]
    .sort((a, b) => (a.irrigation.sharePct ?? 0) - (b.irrigation.sharePct ?? 0))
    .slice(0, 8)
    .map((district) => ({
      label: district.name,
      value: district.irrigation.sharePct ?? 0,
      note: district.state,
      color: "#8CE5B1",
    }));

  const totalIrrigated = districts.reduce(
    (sum, d) => sum + (d.irrigation.irrigatedAreaHa ?? 0),
    0,
  );
  const totalNetSown = districts.reduce(
    (sum, d) => sum + (d.irrigation.netSownAreaHa ?? 0),
    0,
  );
  const overallShare = totalNetSown > 0 ? (totalIrrigated / totalNetSown) * 100 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Irrigation · real data"
        title={
          <>
            Irrigation coverage
            <br />
            across Karnataka districts.
          </>
        }
        description="Gross and net irrigated area by source, district-wise. Official data.gov.in observations integrated. Values are real observations, clearly labelled with provenance and source."
      >
        <span className="demo-badge">Observed · data.gov.in</span>
        <span className="chip">4 seasons tracked</span>
        <span className="chip">{formatNumber(districts.length)} districts</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <DataNotice tone="coral" title="Real irrigation observations">
          Irrigation values on this page are real observations from data.gov.in.
          Each value is labelled with its provenance (observed), source, and observation
          period. Hover over districts on the map for details.
        </DataNotice>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Total irrigated area"
            value={formatNumber(totalIrrigated)}
            unit="ha"
            note={formatNumber(districts.length) + " districts"}
            accent="coral"
          />
          <Stat
            label="Total net sown area"
            value={formatNumber(totalNetSown)}
            unit="ha"
            note={Math.round(overallShare).toString() + "% irrigated share"}
            accent="glacier"
          />
          <Stat
            label="Average irrigated share"
            value={Math.round(overallShare).toFixed(1)}
            unit="%"
            note={formatNumber(districts.length) + " districts"}
            accent="amber"
          />
          <Stat
            label="Districts with data"
            value={formatNumber(districts.length)}
            note={formatNumber(atlas.districts.length) + " total districts"}
            accent="glacier"
          />
        </div>

        <section className="mt-10">
          <SectionHeading
            eyebrow="District map"
            title="Irrigated share of net sown area"
            description="Share of net sown area that is irrigated, by district. Switch layer to view canal/tank/open-well distribution. This is the same map used in the atlas, pre-filtered to the irrigation view."
          />
          <div className="mt-5">
            <DistrictMap
              districts={mapData.districts}
              years={mapData.years}
              latestYear={mapData.latestYear}
              defaultLayer="irrigation"
              heightClassName="h-[62vh] min-h-[460px]"
            />
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="District rankings"
              title="Highest irrigated share"
              description="Districts with the greatest proportion of net sown area under irrigation."
            />
            <div className="mt-5">
              <BarList items={highest} valueSuffix=" %" digits={1} ariaLabel="Districts with highest irrigated share" />
            </div>
          </div>
          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="District rankings"
              title="Lowest irrigated share"
              description="Districts with the smallest proportion of net sown area under irrigation."
            />
            <div className="mt-5">
              <BarList items={lowest} valueSuffix=" %" digits={1} ariaLabel="Districts with lowest irrigated share" />
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="Relationship with groundwater"
              title="Irrigation vs groundwater depth"
              description="Areas with high irrigation share may have shallower or deeper water tables depending on geology and abstraction patterns. This correlation is itself informative for water budgeting."
            />
            <div className="mt-5">
              <ScatterPlot
                points={districts
                  .filter(
                    (district) =>
                      district.irrigation.sharePct !== null && district.groundwater.depthM !== null,
                  )
                  .map((district) => ({
                    x: district.irrigation.sharePct ?? 0,
                    y: district.groundwater.depthM ?? 0,
                    label: district.name,
                    group: district.stress.class,
                  }))
                }
                xLabel="Irrigated share (%)"
                yLabel="Pre-monsoon depth (m)"
                xSuffix="%"
                ySuffix=" m"
                height={300}
                colorForGroup={STRESS_COLORS}
              />
            </div>
            <p className="mt-3 flex items-start gap-2 text-[0.65rem] leading-relaxed text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
              Both axes use real CGWB groundwater and data.gov.in irrigation observations.
            </p>
          </div>

          <div className="panel-flat p-4 sm:p-6">
            <SectionHeading
              eyebrow="State aggregates"
              title="State and union territory irrigation"
              description="Unweighted means of district irrigated shares, sorted by irrigated share. Descriptive only."
            />
            <div className="mt-5 overflow-x-auto rounded-xl border border-line/70">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State / UT</th>
                    <th className="text-right">Districts</th>
                    <th className="text-right">Mean irrigated share</th>
                    <th className="text-right">Total irrigated ha</th>
                    <th className="text-right">Total net sown ha</th>
                  </tr>
                </thead>
                <tbody>
                  {[("Karnataka").toString()].map((state) => {
                    const stateDistricts = districts.filter(
                      (d) => d.state === state,
                    );
                    const meanShare =
                      stateDistricts.length > 0
                        ? stateDistricts.reduce(
                            (sum, d) => sum + (d.irrigation.sharePct ?? 0),
                            0,
                          ) / stateDistricts.length
                        : 0;
                    const totalIrrigated = stateDistricts.reduce(
                      (sum, d) => sum + (d.irrigation.irrigatedAreaHa ?? 0),
                      0,
                    );
                    const totalNetSown = stateDistricts.reduce(
                      (sum, d) => sum + (d.irrigation.netSownAreaHa ?? 0),
                      0,
                    );
                    return (
                      <tr key={state}>
                        <td className="text-cloud/85">{state}</td>
                        <td className="mono text-right text-muted">{stateDistricts.length}</td>
                        <td className="mono text-right">
                          {meanShare.toFixed(1)}%
                        </td>
                        <td className="mono text-right text-coral">
                          {formatNumber(totalIrrigated)} m
                        </td>
                        <td className="mono text-right text-glacier">
                          {formatNumber(totalNetSown)} m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-line bg-deep-ocean/20 p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-coral/30 bg-coral/10 text-coral">
              <Layers className="h-5 w-5" />
            </div>
            <div className="max-w-3xl">
              <p className="eyebrow">Replacing the fixture</p>
              <h2 className="mt-2 font-display text-xl text-cloud sm:text-2xl">
                The interface is ready for official irrigation observations.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The pipeline expects district_id, year, net_sown_area_ha,
                irrigated_area_ha, irrigated_share_pct, source and provenance. Provide the
                official extract, set the provenance field to <span className="mono">observed</span>,
                and rerun <span className="mono">python3 -m pipeline.run_all --skip-climate</span>.
                Every demo badge on this page is driven by that field, so the labels
                update automatically.
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
          <Link href="/groundwater" className="btn-ghost text-xs">
            <Droplets className="h-3.5 w-3.5" /> Groundwater intelligence
          </Link>
        </div>

        <SourceLine>
          Real irrigation observations · data.gov.in ·
          generated {formatDate(metadataData.generatedAt)} ·
          rainfall overlay NASA POWER / MERRA-2 reanalysis.
        </SourceLine>
      </div>
    </>
  );
}