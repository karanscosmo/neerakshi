import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Droplets, Sprout, Wheat } from "lucide-react";
import { getPreparedMetadata } from "@/lib/data/atlas";
import { getCropExplorerData } from "@/lib/data/crops";
import { CropExplorer } from "@/components/crops/CropExplorer";
import { DataNotice, PageHeader, SectionHeading, SourceLine } from "@/components/shared/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Crops & water",
  description:
    "Crop production, area, yield and irrigated share across India, with rainfall-yield analysis. Demo fixtures labelled throughout.",
};

export default async function CropsPage() {
  const [data, metadata] = await Promise.all([getCropExplorerData(), getPreparedMetadata()]);

  return (
    <>
      <PageHeader
        eyebrow="Crops & water · demo fixture"
        title={
          <>
            What we grow,
            <br />
            and the water it takes.
          </>
        }
        description="Crop choice turns rainfall into food and groundwater into yield. This page demonstrates the analytical path from national production to district productivity and rainfall sensitivity — using a documented synthetic crop layer until the official data.gov.in download is completed."
        aside={
          <div className="relative h-44 w-full max-w-sm overflow-hidden rounded-2xl border border-line">
            <Image
              src="/images/crops/farmland-rows.jpg"
              alt="Aerial view of irrigated farmland rows"
              fill
              sizes="(max-width: 1024px) 100vw, 380px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/5 to-transparent" />
            <span className="absolute bottom-3 left-3 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-cloud/80">
              Irrigated farmland · illustrative
            </span>
          </div>
        }
      >
        <span className="demo-badge">Crop layer · demo fixture</span>
        <span className="chip">{data.crops.length} crops</span>
        <span className="chip">2020–{data.latestYear}</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <DataNotice tone="amber" title="Synthetic crop statistics, real rainfall overlay">
          Production, area, yield and irrigated share are deterministic demo fixtures with
          a data.gov.in / ICRISAT-compatible schema. They exist to validate charts, joins
          and the composite index. The rainfall departure overlaid in the scatter is real
          NASA POWER / MERRA-2 reanalysis. Do not cite any crop statistic on this page.
        </DataNotice>

        <section className="mt-8">
          <CropExplorer data={data} />
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
          Crop layer · deterministic demo fixture with data.gov.in / ICRISAT-compatible
          schema · generated {formatDate(metadata.generatedAt)} · rainfall · NASA POWER /
          MERRA-2 reanalysis · no official crop production observations are included in this
          build.
        </SourceLine>
      </div>
    </>
  );
}
