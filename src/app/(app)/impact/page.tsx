import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  Droplets,
  Gauge,
  Map as MapIcon,
  Satellite,
  Sprout,
  Target,
} from "lucide-react";
import { getAtlasData, getPreparedMetadata } from "@/lib/data/atlas";
import { DataNotice, PageHeader, SectionHeading, SourceLine, Stat } from "@/components/shared/ui";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Advisory impact",
  description:
    "How Neerakshi connects national water intelligence to field-level irrigation decisions, and how that impact is designed to be measured.",
};

const EFFICIENCY = [
  { method: "Flood", efficiency: 60, grossFor40mm: 66.7 },
  { method: "Furrow", efficiency: 70, grossFor40mm: 57.1 },
  { method: "Drip", efficiency: 90, grossFor40mm: 44.4 },
];

export default async function ImpactPage() {
  const [atlas, build] = await Promise.all([getAtlasData(), getPreparedMetadata()]);

  const years = Object.keys(atlas.national.monsoonSeries).sort();
  const districts = build.districtCount;
  const states = atlas.states.length;
  const monthlyRows = districts * years.length * 12;
  const monsoonRows = districts * years.length;
  const cropRows = districts * 4 * 5;
  const groundwaterRows = districts * 6;
  const illustrativeSaving = ((66.7 - 44.4) / 1000) * 10_000;

  return (
    <>
      <PageHeader
        eyebrow="Advisory impact · evaluation framework"
        title={
          <>
            From a national signal
            <br />
            to one field decision.
          </>
        }
        description="Neerakshi is built to shorten the distance between a district-level water signal and the next irrigation decision on a farm. This page documents the intended pathway, what is already measurable today, and what must be measured in the field before any impact is claimed."
      >
        <span className="chip">
          <MapIcon className="h-3 w-3" /> {formatNumber(districts)} districts
        </span>
        <span className="chip">
          <Satellite className="h-3 w-3" /> Rainfall {years[0]}–{years[years.length - 1]}
        </span>
        <span className="chip">FAO-56 advisory</span>
        <span className="chip">Build {build.indexVersion}</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Districts in the pipeline"
            value={formatNumber(districts)}
            note={`${formatNumber(states)} states and union territories, geoBoundaries ADM2`}
            accent="glacier"
          />
          <Stat
            label="Monsoon district-years"
            value={formatNumber(monsoonRows)}
            note={`${years.length} seasons of NASA POWER / MERRA-2 reanalysis`}
            accent="mint"
          />
          <Stat
            label="Monthly rainfall rows"
            value={formatNumber(monthlyRows)}
            note="District × month × year, no zero-filled gaps"
            accent="amber"
          />
          <Stat
            label="Advisory model"
            value="FAO-56"
            note="Single crop coefficient root-zone water balance"
            accent="coral"
          />
        </div>

        <div className="mt-5">
          <DataNotice tone="amber" title="Impact is a hypothesis until it is measured">
            Neerakshi does not yet ship a deployment log or a controlled field trial. The
            numbers below describe coverage and arithmetic, not observed water savings. Any
            claim of impact should wait for the evaluation design in the final section to be
            executed and reported.
          </DataNotice>
        </div>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Theory of change"
            title="Four steps from observation to verification"
            description="Each step exists to keep the recommendation traceable. If an input is missing, the system says so instead of substituting a guess."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: Satellite,
                step: "01 · Observe",
                title: "Build a common water signal",
                body: "Rainfall reanalysis, district boundaries and satellite vegetation give every district a comparable starting point.",
              },
              {
                icon: Target,
                step: "02 · Prioritise",
                title: "Find where the signal is acute",
                body: "The composite stress index ranks districts so that attention and field verification start where the exposure is highest.",
              },
              {
                icon: Droplets,
                step: "03 · Advise",
                title: "Translate to a field decision",
                body: "A drawn boundary, crop, soil and weather forecast feed an explainable FAO-56 water balance with a dated recommendation.",
              },
              {
                icon: ClipboardCheck,
                step: "04 · Verify",
                title: "Measure what changed",
                body: "Applied water, pumping time, yield and adoption are compared against the recommendation and a counterfactual.",
              },
            ].map((item) => (
              <article key={item.step} className="panel-flat flex flex-col p-5">
                <item.icon className="h-5 w-5 text-glacier" aria-hidden />
                <p className="mt-5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted">
                  {item.step}
                </p>
                <h3 className="mt-2 font-display text-lg font-medium text-cloud">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Coverage today"
            title="What the current build already contains"
            description="These counts come from the prepared build metadata and the atlas payload, not from an impact estimate. They define the reach of the analysis layer."
          />
          <div className="panel-flat mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Provenance</th>
                  <th className="text-right">Rows</th>
                  <th>Period</th>
                  <th>Role in the pathway</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-cloud/85">District boundaries</td>
                  <td className="text-muted">Observed / open</td>
                  <td className="mono text-right text-muted">{formatNumber(districts)}</td>
                  <td className="text-muted">2021</td>
                  <td className="text-muted">Spatial frame for every metric</td>
                </tr>
                <tr>
                  <td className="text-cloud/85">Monsoon rainfall</td>
                  <td className="text-glacier">Reanalysis</td>
                  <td className="mono text-right text-muted">{formatNumber(monsoonRows)}</td>
                  <td className="text-muted">{years[0]}–{years[years.length - 1]}</td>
                  <td className="text-muted">Seasonal water supply signal</td>
                </tr>
                <tr>
                  <td className="text-cloud/85">Monthly rainfall</td>
                  <td className="text-glacier">Reanalysis</td>
                  <td className="mono text-right text-muted">{formatNumber(monthlyRows)}</td>
                  <td className="text-muted">{years[0]}–{years[years.length - 1]}</td>
                  <td className="text-muted">Within-season context</td>
                </tr>
                <tr>
                  <td className="text-cloud/85">Groundwater depth</td>
                  <td className="text-amber">Demo fixture</td>
                  <td className="mono text-right text-muted">{formatNumber(groundwaterRows)}</td>
                  <td className="text-muted">2019–2024</td>
                  <td className="text-muted">Storage pressure proxy</td>
                </tr>
                <tr>
                  <td className="text-cloud/85">Irrigation share</td>
                  <td className="text-amber">Demo fixture</td>
                  <td className="mono text-right text-muted">{formatNumber(groundwaterRows)}</td>
                  <td className="text-muted">2019–2024</td>
                  <td className="text-muted">Exposure and adaptation proxy</td>
                </tr>
                <tr>
                  <td className="text-cloud/85">Crop production</td>
                  <td className="text-amber">Demo fixture</td>
                  <td className="mono text-right text-muted">{formatNumber(cropRows)}</td>
                  <td className="text-muted">2020–2024</td>
                  <td className="text-muted">Yield context for field advice</td>
                </tr>
              </tbody>
            </table>
          </div>
          <SourceLine>
            Counts derived from {formatNumber(districts)} districts · {years.length} rainfall
            seasons · 4 crops · 6 groundwater years · build generated{" "}
            {formatDate(build.generatedAt)}
          </SourceLine>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel-flat min-w-0 p-5 sm:p-6">
            <SectionHeading
              eyebrow="Illustrative water accounting"
              title="Why method efficiency matters"
              description="The FAO-56 balance produces a net irrigation depth. Gross application depends on how efficiently the method delivers it. The example below is arithmetic, not a field result."
            />
            <div className="mt-5 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th className="text-right">Efficiency</th>
                    <th className="text-right">Gross for 40 mm net</th>
                    <th className="text-right">Volume per hectare</th>
                  </tr>
                </thead>
                <tbody>
                  {EFFICIENCY.map((row) => (
                    <tr key={row.method}>
                      <td className="text-cloud/85">{row.method}</td>
                      <td className="mono text-right text-muted">{row.efficiency}%</td>
                      <td className="mono text-right text-cloud">{row.grossFor40mm.toFixed(1)} mm</td>
                      <td className="mono text-right text-muted">
                        {formatNumber(row.grossFor40mm * 10)} m³
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              For a 40 mm net requirement on one hectare, moving from flood to drip changes
              gross application from about 667 m³ to about 444 m³. The illustrative gap is
              roughly {formatNumber(illustrativeSaving)} m³ per hectare per event. Whether
              that gap is realised depends on scheduling, soil, crop, infrastructure and
              farmer behaviour — all of which must be measured.
            </p>
          </div>

          <div className="panel-flat min-w-0 p-5 sm:p-6">
            <SectionHeading
              eyebrow="Evaluation design"
              title="What a credible pilot would report"
              description="A before-and-after comparison is not enough. The pilot should pair advised fields with comparable unadvised fields and pre-register the outcomes."
            />
            <ul className="mt-5 space-y-3 text-xs leading-relaxed text-muted">
              {[
                ["Applied water", "Cubic metres per hectare per season, metered or pumped-volume derived."],
                ["Pumping energy", "kWh per hectare, where electric or diesel pumping is measurable."],
                ["Yield and revenue", "Crop-wise yield with variety, sowing date and input use recorded."],
                ["Decision adherence", "Share of recommendations followed, and reasons for deviation."],
                ["Lead time", "Days between the advisory and the irrigation action."],
                ["Equity of reach", "Coverage by farm size, gender, tenure and irrigation method."],
              ].map(([label, body]) => (
                <li key={label} className="flex gap-3">
                  <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-glacier" aria-hidden />
                  <span>
                    <span className="text-cloud/85">{label}.</span> {body}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <DataNotice tone="coral" title="What we do not claim">
            <ul className="list-disc space-y-1.5 pl-4">
              <li>No measured water savings, yield gains or income effects are claimed.</li>
              <li>
                Groundwater, irrigation and crop layers are deterministic demo fixtures, so
                district rankings that depend on them are demonstrations of method.
              </li>
              <li>
                The composite stress index is project-defined and is not an official
                government classification.
              </li>
              <li>
                Satellite vegetation indices are contextual. They never override the
                documented FAO-56 water balance.
              </li>
              <li>
                The shipped advisory log is empty; field-level impact requires a live
                deployment log and an independent evaluation.
              </li>
            </ul>
          </DataNotice>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          <Link
            href="/advisor"
            className="panel-flat group flex items-start justify-between gap-4 p-5 transition-colors hover:border-glacier/40"
          >
            <div>
              <Sprout className="h-5 w-5 text-mint" aria-hidden />
              <p className="mt-4 font-display text-lg text-cloud">Test the advisory yourself</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Draw a field, choose a crop and soil, and inspect every input behind the
                recommendation.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-glacier transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href="/methods"
            className="panel-flat group flex items-start justify-between gap-4 p-5 transition-colors hover:border-glacier/40"
          >
            <div>
              <ClipboardCheck className="h-5 w-5 text-glacier" aria-hidden />
              <p className="mt-4 font-display text-lg text-cloud">Read the methodology</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                See the index definition, data lineage, FAO-56 equations and known
                limitations in one place.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-glacier transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>

        <SourceLine>
          Advisory model · FAO-56 single crop coefficient · efficiencies from the shared
          model fixtures · coverage from build {build.indexVersion} generated{" "}
          {formatDate(build.generatedAt)} · no impact estimate is published.
        </SourceLine>
      </div>
    </>
  );
}
