import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Database,
  FileCheck2,
  Layers,
  Satellite,
  Sigma,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import { getAtlasData, getPreparedMetadata } from "@/lib/data/atlas";
import {
  DataNotice,
  PageHeader,
  ProvenanceBadge,
  SectionHeading,
  SourceLine,
  Stat,
} from "@/components/shared/ui";
import { formatDate, formatNumber, STRESS_COLORS } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Methods & sources",
  description:
    "Data lineage, the Water Stress Index definition, the FAO-56 advisory model, validation results and known limitations for Neerakshi.",
};

const SOURCES = [
  {
    label: "NASA POWER",
    href: "https://power.larc.nasa.gov/",
    note: "Monthly meteorology and rainfall reanalysis used by the pipeline.",
  },
  {
    label: "NASA MERRA-2",
    href: "https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/",
    note: "Assimilation product behind the POWER records.",
  },
  {
    label: "FAO Irrigation and Drainage Paper 56",
    href: "https://www.fao.org/3/x0490e/x0490e00.htm",
    note: "Single crop coefficient reference for the field advisory.",
  },
  {
    label: "geoBoundaries",
    href: "https://www.geoboundaries.org/",
    note: "gbOpen ADM1/ADM2 boundaries, ODbL 1.0.",
  },
  {
    label: "EOX Sentinel-2 cloudless",
    href: "https://s2maps.eu/",
    note: "Basemap tiles for the atlas and field maps.",
  },
  {
    label: "NASA GIBS",
    href: "https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs",
    note: "MODIS Terra NDVI 8-day raster tiles.",
  },
  {
    label: "Open-Meteo",
    href: "https://open-meteo.com/",
    note: "Live weather forecast for the advisory water balance.",
  },
  {
    label: "Element 84 Earth Search",
    href: "https://earth-search.aws.element84.com/v1",
    note: "Sentinel-2 L2A STAC search and statistics.",
  },
  {
    label: "OpenStreetMap / Photon",
    href: "https://photon.komoot.io/",
    note: "Place search for locating a field.",
  },
];

export default async function MethodsPage() {
  const [atlas, build] = await Promise.all([getAtlasData(), getPreparedMetadata()]);

  const classes = ["Low", "Moderate", "High", "Severe"];
  const months = Object.keys(atlas.national.monsoonSeries).length * 12;
  const integrityFiles = [
    "atlas.json",
    "rainfall_district_monthly.csv",
    "rainfall_district_season.csv",
    "water_stress_index.csv",
    "groundwater_district.csv",
    "crop_production.csv",
  ].filter((file) => build.files[file]);

  return (
    <>
      <PageHeader
        eyebrow="Methods & sources"
        title={
          <>
            Every number has
            <br />
            a lineage.
          </>
        }
        description="Neerakshi separates observed, reanalysis, modelled and demo data at every layer. This page records how the index is constructed, how the field advisory works, what was validated, and where the current build stops short."
      >
        <span className="chip">
          <Database className="h-3 w-3" /> Index v{build.indexVersion}
        </span>
        <span className="chip">
          <Satellite className="h-3 w-3" /> {formatNumber(build.districtCount)} districts
        </span>
        <span className="chip">FAO-56 · fao56-1.0.0</span>
        <span className="chip">Generated {formatDate(build.generatedAt)}</span>
      </PageHeader>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="District frame"
            value={formatNumber(build.districtCount)}
            note="geoBoundaries ADM2, 36 states and union territories"
            accent="glacier"
          />
          <Stat
            label="Rainfall coverage"
            value={formatNumber(build.rainfallDistricts)}
            unit={`/ ${formatNumber(build.districtCount)}`}
            note="Districts with a successful POWER response"
            accent="mint"
          />
          <Stat
            label="Build generated"
            value={formatDate(build.generatedAt)}
            note={`Index version ${build.indexVersion}`}
            accent="amber"
          />
          <Stat
            label="Advisory model"
            value="FAO-56"
            note="Single crop coefficient, daily root-zone balance"
            accent="coral"
          />
        </div>

        <div className="mt-5">
          <DataNotice tone="amber" title="Read provenance before comparing layers">
            Rainfall is NASA POWER / MERRA-2 reanalysis, not IMD gauge interpolation.
            Groundwater, irrigation and crop production are deterministic demo fixtures with
            the schema of the official sources. The Water Stress Index is project-defined and
            is not an official government classification.
          </DataNotice>
        </div>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Pipeline"
            title="How the build is assembled"
            description="The pipeline is deterministic from the prepared inputs. Downloading the official groundwater, irrigation and crop files is the remaining step that would replace the fixtures."
          />
          <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              ["01", "Boundaries", "District polygons and centroids from geoBoundaries ADM2."],
              ["02", "Climate", "District representative points sampled through the NASA POWER API."],
              ["03", "Fixtures", "Deterministic groundwater, irrigation and crop layers on the official schema."],
              ["04", "Index", "Percentile components combined into the composite stress score."],
              ["05", "Advisory", "Field geometry, weather and satellite inputs into the FAO-56 balance."],
            ].map(([step, title, body]) => (
              <li key={step} className="panel-flat p-5">
                <span className="font-mono text-[0.6rem] tracking-[0.2em] text-glacier">{step}</span>
                <p className="mt-3 font-display text-base font-medium text-cloud">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="panel-flat min-w-0 p-5 sm:p-6">
            <SectionHeading
              eyebrow="Water Stress Index"
              title="A project-defined composite, not an official class"
              description="Each component is converted to a percentile rank across districts. Higher values mean greater stress or vulnerability. The index averages the available components and requires at least one."
            />
            <div className="mt-5 rounded-xl border border-line/70 bg-midnight/40 p-4">
              <p className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
                Composite definition
              </p>
              <p className="mono mt-2 text-sm leading-relaxed text-cloud/85">
                Index = mean(percentile(−5y rainfall departure), percentile(groundwater
                depth), percentile(100 − irrigated share))
              </p>
            </div>
            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
              <li>Rainfall: drier five-year departure receives a higher score.</li>
              <li>Groundwater: deeper pre-monsoon depth receives a higher score.</li>
              <li>Irrigation: a lower irrigated share receives a higher score.</li>
              <li>Districts without a usable component are excluded from that component only.</li>
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {classes.map((name) => (
                <div key={name} className="rounded-lg border border-line/70 px-3 py-2">
                  <p className="mono text-lg" style={{ color: STRESS_COLORS[name] }}>
                    {formatNumber(atlas.classes[name] ?? 0)}
                  </p>
                  <p className="text-[0.58rem] uppercase tracking-[0.1em] text-muted">{name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-flat min-w-0 p-5 sm:p-6">
            <SectionHeading eyebrow="Thresholds" title="Fixed class boundaries" />
            <div className="mt-4 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th className="text-right">Index</th>
                    <th className="text-right">Districts</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Low", "< 30"],
                    ["Moderate", "30–55"],
                    ["High", "55–75"],
                    ["Severe", "≥ 75"],
                  ].map(([name, range]) => (
                    <tr key={name}>
                      <td>
                        <span className="inline-flex items-center gap-2 text-cloud/85">
                          <span
                            className="h-2 w-2 rounded-sm"
                            style={{ backgroundColor: STRESS_COLORS[name] }}
                          />
                          {name}
                        </span>
                      </td>
                      <td className="mono text-right text-muted">{range}</td>
                      <td className="mono text-right text-cloud">
                        {formatNumber(atlas.classes[name] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.62rem] leading-relaxed text-muted">
              Thresholds are fixed so classes stay comparable across refreshes. The mean
              national index in this build is{" "}
              {atlas.national.meanStressIndex?.toFixed(1) ?? "—"} / 100.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Data lineage"
            title="What is observed, what is reanalysis, what is demo"
            description="Provenance is carried through the payload and surfaced in the interface. A demo layer is never presented as an observation."
          />
          <div className="panel-flat mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Provenance</th>
                  <th>Source</th>
                  <th>Period</th>
                  <th>Used for</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["District boundaries", "observed", "geoBoundaries gbOpen 2021 (ODbL)", "2021", "Spatial frame"],
                  ["Rainfall monthly / seasonal", "reanalysis", "NASA POWER / MERRA-2", "2015–2025", "Index input, monsoon pages"],
                  ["Groundwater depth", "demo_fixture", "Deterministic fixture, CGWB schema", "2019–2024", "Index input, labelled demo"],
                  ["Irrigation share", "demo_fixture", "Deterministic fixture, official schema", "2019–2024", "Index input, labelled demo"],
                  ["Crop production", "demo_fixture", "Deterministic fixture", "2020–2024", "Crops page"],
                  ["Basemap", "observed", "EOX Sentinel-2 cloudless 2024", "2024", "Map context"],
                  ["Vegetation raster", "observed", "NASA GIBS MODIS Terra NDVI 8-day", "Rolling", "Raster context only"],
                  ["Weather forecast", "live", "Open-Meteo", "7 days", "Advisory water balance"],
                  ["Sentinel-2 field statistics", "live", "Earth Search STAC + titiler", "Latest usable scene", "Advisory context"],
                ].map(([layer, provenance, source, period, role]) => (
                  <tr key={layer}>
                    <td className="text-cloud/85">{layer}</td>
                    <td>
                      <ProvenanceBadge type={provenance} />
                    </td>
                    <td className="text-muted">{source}</td>
                    <td className="mono text-muted">{period}</td>
                    <td className="text-muted">{role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="panel-flat min-w-0 p-5 sm:p-6">
            <SectionHeading
              eyebrow="Field advisor"
              title="FAO-56 root-zone water balance"
              description="The advisory is a daily balance, not a vegetation-index threshold. Satellite indices provide context and never override the water balance."
            />
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                ["ETc", "ET₀ × Kc, where Kc follows the growth stage."],
                ["TAW", "1000 × (field capacity − wilting point) × root depth."],
                ["RAW", "p × TAW, the depletion at which stress begins."],
                ["Gross irrigation", "Net depth ÷ method efficiency."],
              ].map(([label, body]) => (
                <div key={label} className="rounded-lg border border-line/70 bg-midnight/30 p-3">
                  <p className="mono text-[0.6rem] uppercase tracking-[0.12em] text-glacier">{label}</p>
                  <p className="mt-1.5 text-[0.68rem] leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Inputs are the field geometry, crop, sowing date, soil texture, irrigation
              method, optional previous depletion, a seven-day forecast and the latest usable
              Sentinel-2 scene. If a critical input is missing, the advisory returns
              unavailable with a reason instead of substituting a guess.
            </p>
          </div>

          <div className="panel-flat min-w-0 p-5 sm:p-6">
            <SectionHeading
              eyebrow="Validation"
              title="What the build checks"
              description="The prepared-data validation report is generated alongside the atlas and is the source for these counts."
            />
            <ul className="mt-5 space-y-2.5 text-xs leading-relaxed text-muted">
              {[
                `${formatNumber(atlas.national.districtsWithRainfall)} of ${formatNumber(build.districtCount)} districts have a rainfall summary.`,
                `${formatNumber(build.rainfallDistricts * months)} monthly rainfall rows across the record.`,
                "No duplicate rows were detected in the validated tables.",
                "No missing yield values were found in the crop fixture.",
                "Districts without a POWER response are excluded, never zero-filled.",
                "Two null cells remain in the water-stress table and are handled as unavailable.",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="Build integrity"
            title="File inventory"
            description="Checksums are carried in build metadata so a deployed data file can be matched to the build that produced it."
          />
          <div className="panel-flat mt-5 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th className="text-right">Size</th>
                  <th>SHA-256 prefix</th>
                </tr>
              </thead>
              <tbody>
                {integrityFiles.map((file) => {
                  const entry = build.files[file];
                  return (
                    <tr key={file}>
                      <td className="mono text-cloud/85">{file}</td>
                      <td className="mono text-right text-muted">
                        {formatNumber(Math.round(entry.bytes / 1024))} KB
                      </td>
                      <td className="mono text-muted">{entry.sha256.slice(0, 16)}…</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SourceLine>
            Full inventory and validation notes ship with the prepared build. Checksums shown
            are truncated for display.
          </SourceLine>
        </section>

        <section className="mt-14">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-1 h-5 w-5 shrink-0 text-amber" aria-hidden />
            <div>
              <SectionHeading
                eyebrow="Limitations"
                title="Where this build stops short"
                description="These are material constraints, not footnotes. They define which conclusions the current build can support."
              />
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Fixture layers", "Groundwater, irrigation and crop production are synthetic. Rankings that depend on them demonstrate method, not ground truth."],
              ["Reanalysis is not gauge data", "NASA POWER / MERRA-2 is a gridded product. It should not be read as an IMD rain-gauge interpolation."],
              ["Boundaries are not official", "geoBoundaries gbOpen is used instead of Survey of India administrative boundaries; depiction is not authoritative."],
              ["No district NDVI statistics", "The pipeline does not generate district NDVI aggregates. Only raster tiles and field-level scene statistics are used."],
              ["No advisory archive", "The shipped advisory log is empty. Field impact and adherence require a live deployment log."],
              ["No measured impact", "Water savings, yield gains and income effects are not claimed anywhere in this build."],
            ].map(([title, body]) => (
              <div key={title} className="panel-flat p-4">
                <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-amber">
                  {title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow="References"
            title="Sources and documentation"
            description="External references used by the data pipeline, map layers and advisory model."
            aside={
              <span className="chip">
                <BookOpen className="h-3 w-3" /> {SOURCES.length} sources
              </span>
            }
          />
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map((source) => (
              <a
                key={source.label}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="panel-flat group p-4 transition-colors hover:border-glacier/40"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-sm text-cloud">{source.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted transition-colors group-hover:text-glacier" aria-hidden />
                </span>
                <span className="mt-2 block text-[0.68rem] leading-relaxed text-muted">
                  {source.note}
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-2">
          <Link
            href="/impact"
            className="panel-flat group flex items-start justify-between gap-4 p-5 transition-colors hover:border-glacier/40"
          >
            <div>
              <Sigma className="h-5 w-5 text-glacier" aria-hidden />
              <p className="mt-4 font-display text-lg text-cloud">How impact would be measured</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Coverage, the theory of change and a pre-registered pilot design.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-glacier transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href="/advisor"
            className="panel-flat group flex items-start justify-between gap-4 p-5 transition-colors hover:border-glacier/40"
          >
            <div>
              <Sprout className="h-5 w-5 text-mint" aria-hidden />
              <p className="mt-4 font-display text-lg text-cloud">Open the field advisor</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                See the model inputs and the water-balance output for a field you draw.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-glacier transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>

        <SourceLine>
          <Layers className="mr-1 inline h-3 w-3" aria-hidden />
          Boundaries geoBoundaries gbOpen 2021 (ODbL) · rainfall NASA POWER / MERRA-2 ·
          groundwater, irrigation and crops are demo fixtures · advisory FAO-56 ·
          build {build.indexVersion} generated {formatDate(build.generatedAt)}.
        </SourceLine>
      </div>
    </>
  );
}
