import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CloudRain, Compass, Gauge } from "lucide-react";
import { getAtlasData, getPreparedMetadata } from "@/lib/data/atlas";
import { getClimateExplorerData } from "@/lib/data/climate";
import { MonsoonExplorer } from "@/components/monsoon/MonsoonExplorer";
import { DataNotice, PageHeader, SectionHeading, SourceLine } from "@/components/shared/ui";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Monsoon story",
  description:
    "Eleven years of monsoon rainfall across Indian districts from NASA POWER reanalysis, with state drill-down and year comparison.",
};

export default async function MonsoonPage() {
  const [data, atlas, metadata] = await Promise.all([
    getClimateExplorerData(),
    getAtlasData(),
    getPreparedMetadata(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Monsoon story · 2015–2025"
        title={
          <>
            The rain arrives.
            <br />
            Then the question.
          </>
        }
        description="India's agricultural year is written by the monsoon. This page traces eleven years of district rainfall from a gridded reanalysis product, exposes the year-to-year volatility, and connects the national pattern to the districts that carry the most risk."
      >
        <span className="chip">
          <CloudRain className="h-3 w-3" /> {formatNumber(data.districtLatest.length)} districts
        </span>
        <span className="chip">{data.years[0]}–{data.latestYear}</span>
        <span className="chip">NASA POWER / MERRA-2</span>
        <span className="chip">Generated {formatDate(metadata.generatedAt)}</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <DataNotice tone="glacier" title="What this page can and cannot tell you">
          Rainfall is a real NASA POWER / MERRA-2 monthly reanalysis product, aggregated to
          district boundaries. It is not an IMD rain-gauge interpolation and it does not
          resolve field-scale variation. A district departure describes a gridded area, not
          a farmer&apos;s plot. Groundwater, irrigation and crop context are demo fixtures
          and are labelled as such elsewhere.
        </DataNotice>

        <section className="mt-8">
          <MonsoonExplorer data={data} />
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Interpretation"
            title="Reading a monsoon departure"
            description="A single percentage hides as much as it reveals. These three lenses keep the analysis honest."
          />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <article className="panel-flat p-5">
              <Compass className="h-5 w-5 text-glacier" />
              <h3 className="mt-4 font-display text-lg text-cloud">Spatial concentration</h3>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                A normal national total can conceal a severely dry west and a flooded east.
                District-level departures preserve that spatial variance instead of averaging
                it away.
              </p>
            </article>
            <article className="panel-flat p-5">
              <Gauge className="h-5 w-5 text-amber" />
              <h3 className="mt-4 font-display text-lg text-cloud">Timing, not just total</h3>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                Monsoon totals merge June–September. A late onset or a mid-season break can
                matter more for crop water stress than the seasonal total. Monthly heatmaps
                expose that timing.
              </p>
            </article>
            <article className="panel-flat p-5">
              <CloudRain className="h-5 w-5 text-mint" />
              <h3 className="mt-4 font-display text-lg text-cloud">Rainfall is not water supply</h3>
              <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                Groundwater storage, canal delivery, soil texture, crop stage and irrigation
                infrastructure determine whether rainfall becomes usable water. The atlas
                composite combines these dimensions explicitly.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-line bg-deep-ocean/20 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow">From signal to decision</p>
              <p className="mt-2 font-display text-xl text-cloud sm:text-2xl">
                The monsoon tells you when water might arrive. The field advisor tells you
                what to do about it.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The advisory engine uses live weather and a documented FAO-56 root-zone
                balance, not a rainfall anomaly alone.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/advisor" className="btn-primary text-xs">
                Open field advisor <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/methods" className="btn-ghost text-xs">
                Read methodology
              </Link>
            </div>
          </div>
        </section>

        <SourceLine>
          Rainfall · NASA POWER API, community AG, parameter PRECTOTCORR · monthly totals
          summed to June–September · normal 2015–2024 · boundaries geoBoundaries gbOpen
          (ODbL) · {formatNumber(atlas.national.districtsWithRainfall)} districts with
          complete rainfall records.
        </SourceLine>
      </div>
    </>
  );
}
