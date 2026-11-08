"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3";
import { cn } from "@/lib/utils";

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  group?: string;
  size?: number;
}

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  height = 320,
  xSuffix = "",
  ySuffix = "",
  className,
  colorForGroup,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  height?: number;
  xSuffix?: string;
  ySuffix?: string;
  className?: string;
  colorForGroup?: Record<string, string>;
}) {
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  const width = 760;
  const margin = { top: 18, right: 20, bottom: 42, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const { xScale, yScale } = useMemo(() => {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    return {
      xScale: scaleLinear()
        .domain([xMin - (xMax - xMin) * 0.05, xMax + (xMax - xMin) * 0.05])
        .range([0, innerWidth]),
      yScale: scaleLinear()
        .domain([yMin - (yMax - yMin) * 0.08, yMax + (yMax - yMin) * 0.08])
        .range([innerHeight, 0]),
    };
  }, [points, innerWidth, innerHeight]);

  const groups = Array.from(new Set(points.map((point) => point.group ?? ""))).filter(Boolean);
  const palette = ["#48D9E8", "#8CE5B1", "#F2B85B", "#FF6B65"];

  return (
    <figure className={cn("w-full", className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={`${yLabel} against ${xLabel} scatter plot`}
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {yScale.ticks(5).map((value) => (
              <g key={value} transform={`translate(0,${yScale(value)})`}>
                <line x1={0} x2={innerWidth} stroke="rgba(140,168,181,0.12)" />
                <text x={-10} y={0} dy="0.32em" textAnchor="end" fill="#8CA8B5" fontSize={10} fontFamily="var(--font-plex-mono)">
                  {value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                </text>
              </g>
            ))}
            {xScale.ticks(5).map((value) => (
              <g key={value} transform={`translate(${xScale(value)},${innerHeight})`}>
                <line y1={0} y2={5} stroke="rgba(140,168,181,0.3)" />
                <text y={20} textAnchor="middle" fill="#8CA8B5" fontSize={10} fontFamily="var(--font-plex-mono)">
                  {value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                </text>
              </g>
            ))}
            {points.map((point, index) => (
              <circle
                key={`${point.label}-${index}`}
                cx={xScale(point.x)}
                cy={yScale(point.y)}
                r={hover === point ? 5 : point.size ?? 2.8}
                fill={
                  point.group && colorForGroup?.[point.group]
                    ? colorForGroup[point.group]
                    : palette[index % palette.length]
                }
                opacity={0.72}
                onPointerEnter={() => setHover(point)}
                onPointerLeave={() => setHover(null)}
                className="cursor-crosshair"
              >
                <title>{`${point.label}: ${point.x.toFixed(1)}${xSuffix}, ${point.y.toFixed(1)}${ySuffix}`}</title>
              </circle>
            ))}
          </g>
        </svg>
        {hover && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-line bg-midnight/95 px-3 py-2 text-[0.68rem] shadow-xl">
            <p className="font-medium text-cloud">{hover.label}</p>
            <p className="mono mt-1 text-muted">
              {xLabel}: {hover.x.toFixed(1)}
              {xSuffix}
            </p>
            <p className="mono text-muted">
              {yLabel}: {hover.y.toFixed(1)}
              {ySuffix}
            </p>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
        <span>x · {xLabel}</span>
        <span>y · {yLabel}</span>
      </figcaption>
      {groups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {groups.map((group, index) => (
            <span key={group} className="flex items-center gap-1.5 text-[0.65rem] text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: colorForGroup?.[group] ?? palette[index % palette.length],
                }}
              />
              {group}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
