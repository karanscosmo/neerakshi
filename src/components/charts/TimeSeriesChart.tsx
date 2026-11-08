"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3";
import { line as d3Line, area as d3Area } from "d3";
import { cn } from "@/lib/utils";

export interface SeriesPoint {
  x: number;
  y: number | null;
}

export interface Series {
  key: string;
  label: string;
  color: string;
  points: SeriesPoint[];
  dashed?: boolean;
  area?: boolean;
}

const WIDTH = 820;

export function TimeSeriesChart({
  series,
  height = 260,
  yLabel,
  xLabel,
  valueSuffix = "",
  valueDigits = 0,
  includeZero = false,
  className,
}: {
  series: Series[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
  valueSuffix?: string;
  valueDigits?: number;
  includeZero?: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const margin = { top: 18, right: 18, bottom: 36, left: 56 };
  const innerWidth = WIDTH - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const { xScale, yScale, ticks } = useMemo(() => {
    const allPoints = series.flatMap((entry) => entry.points.filter((p) => p.y !== null));
    const xValues = allPoints.map((p) => p.x);
    const yValues = allPoints.map((p) => p.y as number);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    let yMin = includeZero ? 0 : Math.min(...yValues);
    let yMax = Math.max(...yValues);
    if (yMin === yMax) {
      yMin = yMin - 1;
      yMax = yMax + 1;
    }
    const yPad = (yMax - yMin) * 0.12;
    const xScale = scaleLinear()
      .domain([xMin === xMax ? xMin - 1 : xMin, xMin === xMax ? xMax + 1 : xMax])
      .range([0, innerWidth]);
    const yScale = scaleLinear()
      .domain([includeZero ? 0 : yMin - yPad, yMax + yPad])
      .nice()
      .range([innerHeight, 0]);
    const ticks = xScale.ticks(Math.min(8, Math.max(2, xValues.length))).map((value) => Math.round(value));
    return { xScale, yScale, ticks };
  }, [series, innerWidth, innerHeight, includeZero]);

  const primary = series[0];
  const hoverPoint = primary?.points[hover ?? -1];

  const xTickSet = new Set(ticks);
  const xTicks = Array.from(
    new Set(series.flatMap((entry) => entry.points.map((p) => p.x))),
  )
    .sort((a, b) => a - b)
    .filter((value) => xTickSet.has(value) || series[0]?.points.length <= 8);

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const svgX = ratio * WIDTH - margin.left;
    const value = xScale.invert(svgX);
    const values = primary?.points.map((p) => p.x) ?? [];
    let nearest = 0;
    let best = Infinity;
    values.forEach((v, index) => {
      const distance = Math.abs(v - value);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  }

  return (
    <figure className={cn("relative w-full", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((entry) => (
          <span key={entry.key} className="flex items-center gap-1.5 text-[0.7rem] text-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            {entry.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-full touch-pan-y"
          role="img"
          aria-label={`${yLabel ?? "Time series"} chart`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            {series.map((entry, index) => (
              <linearGradient key={entry.key} id={`grad-${index}-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={entry.color} stopOpacity="0.28" />
                <stop offset="1" stopColor={entry.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {yScale.ticks(5).map((value) => (
              <g key={value} transform={`translate(0,${yScale(value)})`}>
                <line x1={0} x2={innerWidth} stroke="rgba(140,168,181,0.14)" strokeWidth={1} />
                <text
                  x={-10}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#8CA8B5"
                  fontSize={10}
                  fontFamily="var(--font-plex-mono)"
                >
                  {value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </text>
              </g>
            ))}
            {xTicks.map((value) => (
              <text
                key={value}
                x={xScale(value)}
                y={innerHeight + 22}
                textAnchor="middle"
                fill="#8CA8B5"
                fontSize={10}
                fontFamily="var(--font-plex-mono)"
              >
                {value}
              </text>
            ))}
            {series.map((entry, index) => {
              const generator = d3Line<SeriesPoint>()
                .defined((point) => point.y !== null)
                .x((point) => xScale(point.x))
                .y((point) => yScale(point.y as number));
              const path = generator(entry.points) ?? undefined;
              const areaPath = d3Area<SeriesPoint>()
                .defined((point) => point.y !== null)
                .x((point) => xScale(point.x))
                .y0(innerHeight)
                .y1((point) => yScale(point.y as number))(entry.points);
              return (
                <g key={entry.key}>
                  {entry.area && areaPath && (
                    <path d={areaPath} fill={`url(#grad-${index}-${entry.key})`} />
                  )}
                  <path
                    d={path}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={2}
                    strokeDasharray={entry.dashed ? "5 5" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
            {hover !== null && hoverPoint && (
              <g>
                <line
                  x1={xScale(hoverPoint.x)}
                  x2={xScale(hoverPoint.x)}
                  y1={0}
                  y2={innerHeight}
                  stroke="rgba(72,217,232,0.35)"
                  strokeDasharray="3 3"
                />
                {series.map((entry) => {
                  const point = entry.points[hover];
                  if (!point || point.y === null) return null;
                  return (
                    <circle
                      key={entry.key}
                      cx={xScale(point.x)}
                      cy={yScale(point.y)}
                      r={3.5}
                      fill="#071521"
                      stroke={entry.color}
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            )}
          </g>
        </svg>
        {hover !== null && hoverPoint && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[9rem] rounded-lg border border-line bg-midnight/95 px-3 py-2 shadow-xl"
            style={{
              left: `${Math.min(78, Math.max(2, (xScale(hoverPoint.x) / WIDTH) * 100))}%`,
            }}
          >
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted">
              {hoverPoint.x}
            </p>
            <ul className="mt-1 space-y-0.5">
              {series.map((entry) => {
                const point = entry.points[hover];
                return (
                  <li key={entry.key} className="flex items-center justify-between gap-3 text-[0.68rem]">
                    <span className="flex items-center gap-1.5 text-cloud/70">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.label}
                    </span>
                    <span className="mono text-cloud">
                      {point?.y === null || point?.y === undefined
                        ? "—"
                        : point.y.toLocaleString("en-IN", {
                            maximumFractionDigits: valueDigits,
                            minimumFractionDigits: valueDigits,
                          })}
                      {valueSuffix}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
        <span>{xLabel ?? "Year"}</span>
        {yLabel && <span>{yLabel}</span>}
      </figcaption>
      <table className="sr-only">
        <caption>{yLabel ?? "Time series"}</caption>
        <thead>
          <tr>
            <th>X</th>
            {series.map((entry) => (
              <th key={entry.key}>{entry.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {primary?.points.map((point, index) => (
            <tr key={point.x}>
              <td>{point.x}</td>
              {series.map((entry) => (
                <td key={entry.key}>{entry.points[index]?.y ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
