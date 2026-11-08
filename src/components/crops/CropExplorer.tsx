"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Droplets, Sprout, TrendingUp, Wheat } from "lucide-react";
import { BarList } from "@/components/charts/BarList";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import type { CropExplorerData } from "@/lib/data/crops";
import { cn, compactNumber, formatNumber, formatPercent } from "@/lib/utils";

const CROP_COLORS: Record<string, string> = {
  rice: "#48D9E8",
  wheat: "#F2B85B",
  maize: "#8CE5B1",
  sugarcane: "#FF9F6B",
};

export function CropExplorer({ data }: { data: CropExplorerData }) {
  const [activeKey, setActiveKey] = useState(data.crops[0]?.key ?? "rice");
  const crop = data.crops.find((item) => item.key === activeKey) ?? data.crops[0]!;
  const color = CROP_COLORS[crop.key] ?? "#48D9E8";

  const latest = crop.series[crop.series.length - 1];
  const previous = crop.series[crop.series.length - 2];

  const productionSeries = crop.series.map((point) => ({
    x: point.year,
    y: point.productionTonnes / 1_000_000,
  }));
  const yieldSeries = crop.series.map((point) => ({
    x: point.year,
    y: point.yieldKgHa,
  }));

  const topStates = crop.states.slice(0, 10).map((state) => ({
    label: state.state,
    value: state.productionTonnes / 1_000_000,
    note: `Yield ${formatNumber(state.yieldKgHa)} kg/ha`,
    color,
  }));

  const scatter = useMemo(
    () =>
      crop.districts
        .filter((district) => district.departurePct !== null)
        .map((district) => ({
          x: district.departurePct ?? 0,
          y: district.yieldKgHa,
          label: district.name,
          group:
            district.irrigatedSharePct >= 50
              ? "Irrigated ≥ 50%"
              : "Irrigated < 50%",
        })),
    [crop],
  );

  const yieldGrowth =
    latest && previous && previous.yieldKgHa > 0
      ? ((latest.yieldKgHa - previous.yieldKgHa) / previous.yieldKgHa) * 100
      : null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.crops.map((item) => {
          const active = item.key === crop.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveKey(item.key)}
              aria-pressed={active}
              className={cn(
                "group relative overflow-hidden rounded-xl border text-left transition-all",
                active
                  ? "border-glacier/60 ring-1 ring-glacier/30"
                  : "border-line/70 hover:border-glacier/30",
              )}
            >
              <div className="relative h-24">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(max-width: 1024px) 50vw, 300px"
                  className={cn(
                    "object-cover transition-transform duration-500 group-hover:scale-105",
                    active ? "opacity-100" : "opacity-60",
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/20 to-transparent" />
                <span className="absolute bottom-2 left-3 font-display text-base font-medium text-cloud">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                  {formatNumber(
                    (item.series[item.series.length - 1]?.productionTonnes ?? 0) / 1_000_000,
                    1,
                  )}{" "}
                  Mt
                </span>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CROP_COLORS[item.key] ?? "#48D9E8" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CropStat
          icon={<Wheat className="h-4 w-4" />}
          label={`${crop.name} production ${data.latestYear}`}
          value={latest ? `${(latest.productionTonnes / 1_000_000).toFixed(1)} Mt` : "—"}
          note={latest ? `Area ${compactNumber(latest.areaHa / 1_000_000)} Mha` : undefined}
          color={color}
        />
        <CropStat
          icon={<TrendingUp className="h-4 w-4" />}
          label="Yield"
          value={latest ? `${formatNumber(latest.yieldKgHa)} kg/ha` : "—"}
          note={
            yieldGrowth !== null
              ? `${yieldGrowth >= 0 ? "+" : ""}${yieldGrowth.toFixed(1)}% vs ${previous?.year}`
              : undefined
          }
          color="#8CE5B1"
        />
        <CropStat
          icon={<Droplets className="h-4 w-4" />}
          label="Irrigated share"
          value={latest ? `${latest.irrigatedSharePct.toFixed(0)}%` : "—"}
          note="Of national cropped area for this crop (demo)"
          color="#48D9E8"
        />
        <CropStat
          icon={<Sprout className="h-4 w-4" />}
          label="Districts reporting"
          value={formatNumber(crop.districts.length)}
          note="Synthetic district rows with this crop"
          color="#F2B85B"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="panel-flat p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="eyebrow">National production</p>
              <h3 className="mt-1 font-display text-xl text-cloud">
                {crop.name}, 2020–{data.latestYear}
              </h3>
            </div>
            <span className="chip">{crop.name}</span>
          </div>
          <div className="mt-5">
            <TimeSeriesChart
              series={[
                {
                  key: "production",
                  label: "Production",
                  color,
                  area: true,
                  points: productionSeries,
                },
              ]}
              height={260}
              yLabel="Production (million tonnes)"
              xLabel="Year"
              valueSuffix=" Mt"
              valueDigits={1}
            />
          </div>
        </div>

        <div className="panel-flat p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="eyebrow">Productivity</p>
              <h3 className="mt-1 font-display text-xl text-cloud">
                Yield per hectare
              </h3>
            </div>
            <span className="chip">kg / ha</span>
          </div>
          <div className="mt-5">
            <TimeSeriesChart
              series={[
                {
                  key: "yield",
                  label: "Yield",
                  color: "#8CE5B1",
                  area: true,
                  points: yieldSeries,
                },
              ]}
              height={260}
              yLabel="Yield (kg/ha)"
              xLabel="Year"
              valueSuffix=" kg/ha"
              valueDigits={0}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="panel-flat p-4 sm:p-6">
          <p className="eyebrow">Concentration</p>
          <h3 className="mt-1 font-display text-xl text-cloud">Leading producing states</h3>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
            Production in million tonnes for {data.latestYear}. Synthetic district values
            rolled up to states; ranking logic is production-ready.
          </p>
          <div className="mt-5">
            <BarList items={topStates} valueSuffix=" Mt" digits={1} ariaLabel={`Top states producing ${crop.name}`} />
          </div>
        </div>

        <div className="panel-flat p-4 sm:p-6">
          <p className="eyebrow">Rainfall and yield</p>
          <h3 className="mt-1 font-display text-xl text-cloud">
            Does monsoon departure explain yield?
          </h3>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">
            District-level scatter for {crop.name}, coloured by irrigated share. Yield is
            synthetic, so the relationship is illustrative of the analytical method only.
          </p>
          <div className="mt-4">
            <ScatterPlot
              points={scatter}
              xLabel="Monsoon departure"
              yLabel="Yield"
              xSuffix="%"
              ySuffix=" kg/ha"
              height={300}
              colorForGroup={{
                "Irrigated ≥ 50%": "#48D9E8",
                "Irrigated < 50%": "#FF9F6B",
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 panel-flat overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-4 py-4 sm:px-6">
          <div>
            <p className="eyebrow">District leaderboard</p>
            <h3 className="mt-1 font-display text-lg text-cloud">
              Highest {crop.name.toLowerCase()} yields
            </h3>
          </div>
          <Link href="/advisor" className="btn-ghost min-h-11 text-xs">
            Advise a {crop.name.toLowerCase()} field <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>District</th>
                <th>State / UT</th>
                <th className="text-right">Yield</th>
                <th className="text-right">Production</th>
                <th className="text-right">Irrigated</th>
                <th className="text-right">Monsoon departure</th>
              </tr>
            </thead>
            <tbody>
              {crop.districts.slice(0, 15).map((district) => (
                <tr key={district.id}>
                  <td className="text-cloud/90">{district.name}</td>
                  <td className="text-muted">{district.state}</td>
                  <td className="mono text-right text-mint">
                    {formatNumber(district.yieldKgHa)} kg/ha
                  </td>
                  <td className="mono text-right text-muted">
                    {compactNumber(district.productionTonnes)} t
                  </td>
                  <td className="mono text-right text-muted">
                    {district.irrigatedSharePct.toFixed(0)}%
                  </td>
                  <td
                    className={cn(
                      "mono text-right",
                      district.departurePct !== null && district.departurePct < 0
                        ? "text-coral"
                        : "text-mint",
                    )}
                  >
                    {formatPercent(district.departurePct, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[0.65rem] leading-relaxed text-muted">
        Crop production, area, yield and irrigated share are deterministic demo fixtures with
        a data.gov.in / ICRISAT-compatible schema. Rainfall departure is real NASA POWER /
        MERRA-2 reanalysis. Never interpret this scatter as an empirical yield response.
      </p>
    </div>
  );
}

function CropStat({
  icon,
  label,
  value,
  note,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
  color: string;
}) {
  return (
    <div className="panel-flat p-4">
      <p className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase leading-tight tracking-[0.1em] text-muted">
        <span style={{ color }}>{icon}</span>
        {label}
      </p>
      <p className="mono mt-2 text-xl text-cloud">{value}</p>
      {note && <p className="mt-1 text-[0.6rem] leading-tight text-muted">{note}</p>}
    </div>
  );
}
