"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CloudRain, Droplets, Sun } from "lucide-react";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { MonthlyHeatmap } from "@/components/charts/MonthlyHeatmap";
import { SectionHeading } from "@/components/shared/ui";
import type { ClimateExplorerData } from "@/lib/data/climate";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export function MonsoonExplorer({ data }: { data: ClimateExplorerData }) {
  const [state, setState] = useState("all");
  const selectedStates = state === "all" ? null : state;

  const series = selectedStates ? data.stateSeries[selectedStates] ?? [] : data.nationalSeries;
  const months = selectedStates ? data.stateMonths[selectedStates] ?? [] : data.nationalMonths;
  const districts = useMemo(
    () =>
      selectedStates
        ? data.districtLatest.filter((district) => district.state === selectedStates)
        : data.districtLatest,
    [data.districtLatest, selectedStates],
  );

  const ranked = useMemo(
    () => [...districts].sort((a, b) => b.departurePct - a.departurePct),
    [districts],
  );
  const wettest = ranked.slice(0, 10);
  const driest = [...ranked].reverse().slice(0, 10);

  const meanDeparture =
    districts.reduce((sum, district) => sum + district.departurePct, 0) /
    Math.max(1, districts.length);
  const meanMonsoon =
    districts.reduce((sum, district) => sum + district.monsoonMm, 0) /
    Math.max(1, districts.length);
  const normalMonsoon =
    districts.reduce((sum, district) => sum + district.normalMm, 0) /
    Math.max(1, districts.length);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Geography</p>
          <label className="mt-2 block">
            <span className="sr-only">Choose a state or the national aggregate</span>
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
              className="field min-h-11 min-w-[16rem]"
            >
              <option value="all">All India · national aggregate</option>
              {data.states.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="max-w-md text-[0.65rem] leading-relaxed text-muted">
          Values are area-unweighted means of district rainfall from NASA POWER / MERRA-2
          monthly reanalysis. They describe a gridded product, not rain-gauge observations.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-flat p-4">
          <p className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
            <CloudRain className="h-3 w-3" /> Mean departure {data.latestYear}
          </p>
          <p
            className={cn(
              "mono mt-2 text-2xl",
              meanDeparture >= 0 ? "text-mint" : "text-coral",
            )}
          >
            {formatPercent(meanDeparture, 1)}
          </p>
          <p className="mt-1 text-[0.6rem] text-muted">
            {meanDeparture >= 0 ? "Above the 2015–2024 normal" : "Below the 2015–2024 normal"}
          </p>
        </div>
        <div className="panel-flat p-4">
          <p className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
            <Droplets className="h-3 w-3" /> Mean monsoon rainfall
          </p>
          <p className="mono mt-2 text-2xl text-glacier">{formatNumber(meanMonsoon)} mm</p>
          <p className="mt-1 text-[0.6rem] text-muted">Normal {formatNumber(normalMonsoon)} mm</p>
        </div>
        <div className="panel-flat p-4">
          <p className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
            <ArrowUpRight className="h-3 w-3" /> Wettest district
          </p>
          <p className="mt-2 truncate font-display text-lg text-cloud">{wettest[0]?.name ?? "—"}</p>
          <p className="mono mt-1 text-[0.68rem] text-mint">
            {formatPercent(wettest[0]?.departurePct ?? null, 1)}
          </p>
        </div>
        <div className="panel-flat p-4">
          <p className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
            <ArrowDownRight className="h-3 w-3" /> Driest district
          </p>
          <p className="mt-2 truncate font-display text-lg text-cloud">{driest[0]?.name ?? "—"}</p>
          <p className="mono mt-1 text-[0.68rem] text-coral">
            {formatPercent(driest[0]?.departurePct ?? null, 1)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel-flat p-4 sm:p-6">
          <SectionHeading
            eyebrow="Time series"
            title="Monsoon rainfall, 2015–2025"
            description="Mean monsoon-season rainfall across the selected geography, derived from monthly reanalysis. The series is descriptive; departures in the cards above compare the latest year with the 2015–2024 normal."
          />
          <div className="mt-5">
            <TimeSeriesChart
              series={[
                {
                  key: "monsoon",
                  label: "Monsoon rainfall",
                  color: "#48D9E8",
                  area: true,
                  points: series,
                },
              ]}
              height={300}
              yLabel="Mean monsoon rainfall (mm)"
              xLabel="Year"
              valueSuffix=" mm"
            />
          </div>
        </div>

        <div className="panel-flat p-4 sm:p-6">
          <SectionHeading
            eyebrow="Seasonality"
            title="Monthly rainfall pattern"
            description="Each cell is the mean monthly rainfall for the selected geography. Hover for exact values; the accessible table follows."
          />
          <div className="mt-5">
            <MonthlyHeatmap rows={months} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <RankingCard
          title="Driest districts"
          subtitle={`${data.latestYear} monsoon departure, most negative first`}
          rows={driest}
          year={data.latestYear}
          tone="coral"
        />
        <RankingCard
          title="Wettest districts"
          subtitle={`${data.latestYear} monsoon departure, most positive first`}
          rows={wettest}
          year={data.latestYear}
          tone="mint"
        />
      </div>

      <p className="mt-5 flex items-start gap-2 text-[0.68rem] leading-relaxed text-muted">
        <Sun className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        A positive departure does not mean water security, and a negative departure does not
        by itself imply crop failure. Interpret rainfall alongside groundwater, irrigation,
        soils and crop stage. The atlas composite combines these signals explicitly.
      </p>
    </div>
  );
}

function RankingCard({
  title,
  subtitle,
  rows,
  year,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: ClimateExplorerData["districtLatest"];
  year: number;
  tone: "coral" | "mint";
}) {
  return (
    <div className="panel-flat p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-cloud">{title}</h3>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted">
          {year}
        </span>
      </div>
      <p className="mt-1 text-[0.62rem] text-muted">{subtitle}</p>
      <ol className="mt-4 space-y-1.5">
        {rows.map((district, index) => (
          <li key={district.id}>
            <Link
              href={`/atlas?district=${encodeURIComponent(district.id)}`}
              className="flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-white/5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="mono w-4 shrink-0 text-[0.58rem] text-muted">{index + 1}</span>
                <span className="truncate text-cloud/85">{district.name}</span>
                <span className="hidden truncate text-[0.58rem] text-muted sm:inline">
                  {district.state}
                </span>
              </span>
              <span
                className={cn(
                  "mono shrink-0 text-[0.65rem]",
                  tone === "coral" ? "text-coral" : "text-mint",
                )}
              >
                {formatPercent(district.departurePct, 1)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
