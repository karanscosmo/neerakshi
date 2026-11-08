"use client";

import { useMemo } from "react";

export function MonsoonBars({
  series,
  height = 230,
  compact = false,
}: {
  series: { year: number; value: number }[];
  height?: number;
  compact?: boolean;
}) {
  const { bars, mean, width } = useMemo(() => {
    const values = series.map((point) => point.value);
    const average = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    const max = Math.max(...values, average * 1.05);
    const min = Math.min(...values, average * 0.9);
    const chartWidth = 640;
    const gap = 8;
    const barWidth = (chartWidth - gap * (series.length - 1)) / series.length;
    const scale = (value: number) =>
      ((value - min) / Math.max(max - min, 1)) * (height - 46) + 26;
    const bars = series.map((point, index) => ({
      ...point,
      x: index * (barWidth + gap),
      y: height - scale(point.value),
      h: scale(point.value) - 26,
      width: barWidth,
      color: point.value >= average ? "#48D9E8" : "#FF8A72",
      pct: ((point.value - average) / average) * 100,
    }));
    return { bars, mean: average, width: chartWidth };
  }, [series, height]);

  if (!series.length) {
    return <p className="text-sm text-muted">No monsoon series available.</p>;
  }

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="National monsoon rainfall by year with deviation from the period mean"
        className="w-full"
      >
        <defs>
          <linearGradient id="rain-positive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8CE5B1" stopOpacity="0.95" />
            <stop offset="1" stopColor="#48D9E8" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          x2={width}
          y1={height - 26}
          y2={height - 26}
          stroke="rgba(140,168,181,0.25)"
          strokeWidth="1"
        />
        {bars.map((bar) => (
          <g key={bar.year}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={Math.max(bar.h, 1)}
              rx="3"
              fill={bar.value >= mean ? "url(#rain-positive)" : "#FF8A72"}
              opacity={bar.value >= mean ? 0.9 : 0.8}
            >
              <title>{`${bar.year}: ${Math.round(bar.value).toLocaleString("en-IN")} mm monsoon rainfall (${bar.pct >= 0 ? "+" : ""}${bar.pct.toFixed(1)}% vs period mean)`}</title>
            </rect>
            <text
              x={bar.x + bar.width / 2}
              y={height - 10}
              textAnchor="middle"
              fill="#8CA8B5"
              fontFamily="var(--font-plex-mono)"
              fontSize={compact ? 9 : 11}
            >
              {String(bar.year).slice(2)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex items-center justify-between gap-3 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
        <span>National monsoon total · mm</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-glacier" /> ≥ period mean
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-coral" /> below mean
          </span>
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>National monsoon rainfall by year</caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>Monsoon rainfall (mm)</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.year}>
              <td>{point.year}</td>
              <td>{Math.round(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
