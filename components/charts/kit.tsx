"use client";
/**
 * Minimal chart kit: D3 scales/shapes rendered as React SVG in the engraved
 * atlas style. Every chart sits in a ChartFrame with a title that states the
 * finding, units on axes, a source line, tooltips, an "About this data"
 * drawer and a data-table alternative.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { line as d3line, area as d3area, curveMonotoneX } from "d3-shape";
import { extent, max, min } from "d3-array";
import { useI18n } from "@/lib/i18n/client";

export function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export type Col = { key: string; label: string; numeric?: boolean; format?: (v: unknown) => string };

export function ChartFrame({
  title,
  subtitle,
  source,
  about,
  table,
  children,
  empty,
  loading,
  error,
  onRetry,
}: {
  title: string;
  subtitle?: ReactNode;
  source: string;
  about?: { method: ReactNode; coverage: ReactNode; limitations?: ReactNode };
  table?: { columns: Col[]; rows: Record<string, unknown>[] };
  children: ReactNode;
  empty?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <figure className="chart-frame card" aria-labelledby={`${id}-t`}>
      <figcaption>
        <h3 id={`${id}-t`} className="chart-title">
          {title}
        </h3>
        {subtitle ? <p className="annot" style={{ margin: "2px 0 8px", textTransform: "none", letterSpacing: 0 }}>{subtitle}</p> : null}
      </figcaption>
      {loading ? <div className="skeleton" style={{ height: 220 }} aria-busy="true" /> : null}
      {!loading && error ? (
        <div className="notice" role="alert">
          {t.common.error} {error}{" "}
          {onRetry ? (
            <button className="btn btn--ghost btn--sm" onClick={onRetry}>
              {t.common.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && empty ? (
        <div className="notice notice--info">
          <strong>{t.common.noData}.</strong> {empty}
        </div>
      ) : null}
      {!loading && !error && !empty ? children : null}
      <p className="chart-source">
        {t.common.source}: {source}
      </p>
      <div className="row" style={{ gap: 8 }}>
        {table && table.rows.length ? (
          <button className="btn btn--ghost btn--sm" aria-expanded={showTable} onClick={() => setShowTable((x) => !x)}>
            {showTable ? t.common.hideTable : t.common.showTable}
          </button>
        ) : null}
      </div>
      {showTable && table ? <DataTable columns={table.columns} rows={table.rows} caption={title} /> : null}
      {about ? (
        <details className="about">
          <summary>{t.common.aboutThisData}</summary>
          <p>
            <strong>{t.common.method}.</strong> {about.method}
          </p>
          <p>
            <strong>{t.common.coverage}.</strong> {about.coverage}
          </p>
          {about.limitations ? (
            <p>
              <strong>{t.common.limitations}.</strong> {about.limitations}
            </p>
          ) : null}
        </details>
      ) : null}
    </figure>
  );
}

export function DataTable({ columns, rows, caption }: { columns: Col[]; rows: Record<string, unknown>[]; caption: string }) {
  return (
    <div style={{ maxHeight: 320, overflow: "auto", marginTop: 8 }}>
      <table className="data">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? "n" : undefined}>
                  {c.format ? c.format(r[c.key]) : r[c.key] === null || r[c.key] === undefined ? "—" : String(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tip = { x: number; y: number; text: string } | null;
function TipLayer({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }} role="status">
      {tip.text}
    </div>
  );
}

const M = { t: 12, r: 14, b: 30, l: 46 };

/** Bars by year diverging from zero (e.g. monsoon departure). */
export function DivergingBars({
  data,
  yLabel,
  height = 240,
  colorFor,
  format,
  label,
}: {
  data: { x: number; y: number | null }[];
  yLabel: string;
  height?: number;
  colorFor: (y: number) => string;
  format: (d: { x: number; y: number }) => string;
  label: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const valid = data.filter((d): d is { x: number; y: number } => d.y !== null);
  const x = scaleBand<number>().domain(data.map((d) => d.x)).range([M.l, w - M.r]).padding(0.15);
  const lim = Math.max(10, max(valid, (d) => Math.abs(d.y)) ?? 10);
  const y = scaleLinear().domain([-lim, lim]).nice().range([height - M.b, M.t]);
  const ticks = x.domain().filter((v, i, a) => i === 0 || i === a.length - 1 || v % (a.length > 60 ? 20 : 10) === 0);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart" width={w} height={height} role="img" aria-label={label}>
        {y.ticks(5).map((tk) => (
          <g key={tk}>
            <line className="gridline" x1={M.l} x2={w - M.r} y1={y(tk)} y2={y(tk)} />
            <text x={M.l - 6} y={y(tk) + 4} textAnchor="end">
              {tk > 0 ? `+${tk}` : tk}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={w - M.r} y1={y(0)} y2={y(0)} stroke="var(--ink)" />
        {valid.map((d) => (
          <rect
            key={d.x}
            x={x(d.x)}
            width={Math.max(1, x.bandwidth())}
            y={Math.min(y(0), y(d.y))}
            height={Math.max(0.5, Math.abs(y(d.y) - y(0)))}
            fill={colorFor(d.y)}
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: format(d) })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        {ticks.map((v) => (
          <text key={v} x={(x(v) ?? 0) + x.bandwidth() / 2} y={height - 10} textAnchor="middle">
            {v}
          </text>
        ))}
        <text x={4} y={M.t - 2} textAnchor="start">
          {yLabel}
        </text>
      </svg>
      <TipLayer tip={tip} />
    </div>
  );
}

export type Series = { key: string; label: string; color: string; dash?: string; points: { x: number; y: number | null }[] };

/** Multi-series line chart; null values break the line (never interpolated). */
export function LineChart({
  series,
  yLabel,
  height = 240,
  invertY = false,
  yDomain,
  format,
  label,
  band,
}: {
  series: Series[];
  yLabel: string;
  height?: number;
  invertY?: boolean;
  yDomain?: [number, number];
  format: (s: Series, p: { x: number; y: number }) => string;
  label: string;
  band?: { x0: number; x1: number; label: string };
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const all = series.flatMap((s) => s.points.filter((p): p is { x: number; y: number } => p.y !== null));
  const xs = extent(series.flatMap((s) => s.points.map((p) => p.x))) as [number, number];
  const x = scaleLinear().domain(xs[0] === undefined ? [0, 1] : xs).range([M.l, w - M.r]);
  const yd = yDomain ?? ([Math.min(0, min(all, (p) => p.y) ?? 0), max(all, (p) => p.y) ?? 1] as [number, number]);
  const y = scaleLinear().domain(yd).nice().range(invertY ? [M.t, height - M.b] : [height - M.b, M.t]);
  const gen = d3line<{ x: number; y: number | null }>()
    .defined((p) => p.y !== null)
    .x((p) => x(p.x))
    .y((p) => y(p.y as number))
    .curve(curveMonotoneX);
  const xt = x.ticks(Math.max(2, Math.floor(w / 90))).filter((v) => Number.isInteger(v));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        className="chart"
        width={w}
        height={height}
        role="img"
        aria-label={label}
        onMouseLeave={() => setTip(null)}
        onMouseMove={(e) => {
          const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const xv = Math.round(x.invert(e.clientX - box.left));
          const lines = series
            .map((s) => {
              const p = s.points.find((q) => q.x === xv);
              return p && p.y !== null ? format(s, p as { x: number; y: number }) : null;
            })
            .filter(Boolean);
          setTip(lines.length ? { x: e.clientX, y: e.clientY, text: `${xv} · ${lines.join(" · ")}` } : null);
        }}
      >
        {band ? (
          <g>
            <rect x={x(band.x0)} width={Math.max(0, x(band.x1) - x(band.x0))} y={M.t} height={height - M.t - M.b} fill="var(--grid)" opacity={0.5} />
            <text x={x(band.x0) + 4} y={M.t + 12}>
              {band.label}
            </text>
          </g>
        ) : null}
        {y.ticks(5).map((tk) => (
          <g key={tk}>
            <line className="gridline" x1={M.l} x2={w - M.r} y1={y(tk)} y2={y(tk)} />
            <text x={M.l - 6} y={y(tk) + 4} textAnchor="end">
              {tk}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={v} x={x(v)} y={height - 10} textAnchor="middle">
            {v}
          </text>
        ))}
        <line x1={M.l} x2={w - M.r} y1={height - M.b} y2={height - M.b} stroke="var(--ink)" strokeWidth={0.75} />
        {series.map((s) => (
          <g key={s.key}>
            <path d={gen(s.points) ?? ""} fill="none" stroke={s.color} strokeWidth={1.8} strokeDasharray={s.dash} />
            {s.points.map((p) => (p.y === null ? null : <circle key={p.x} cx={x(p.x)} cy={y(p.y)} r={2.2} fill={s.color} />))}
          </g>
        ))}
        <text x={4} y={M.t - 2}>
          {yLabel}
        </text>
      </svg>
      {series.length > 1 ? (
        <div className="row" style={{ gap: 14, fontSize: ".8rem" }}>
          {series.map((s) => (
            <span key={s.key} className="row" style={{ gap: 6 }}>
              <svg width="22" height="8" aria-hidden>
                <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <TipLayer tip={tip} />
    </div>
  );
}

/** Month × year heatmap (calendar strip). */
export function Heatmap({
  cells,
  years,
  monthLabels,
  colorFor,
  format,
  label,
}: {
  cells: { year: number; month: number; v: number | null }[];
  years: number[];
  monthLabels: string[];
  colorFor: (v: number) => string;
  format: (c: { year: number; month: number; v: number }) => string;
  label: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const L = 40;
  const cw = (w - L - 8) / 12;
  const ch = Math.max(5, Math.min(14, 520 / Math.max(1, years.length)));
  const h = years.length * ch + 26;
  const map = useMemo(() => new Map(cells.map((c) => [`${c.year}-${c.month}`, c.v])), [cells]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart" width={w} height={h} role="img" aria-label={label}>
        <defs>
          <pattern id="hm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--monsoon-slate)" strokeWidth="1" />
          </pattern>
        </defs>
        {monthLabels.map((m, i) => (
          <text key={m} x={L + i * cw + cw / 2} y={12} textAnchor="middle">
            {m}
          </text>
        ))}
        {years.map((y, r) => (
          <g key={y}>
            {(r % 5 === 0 || years.length < 25) && (
              <text x={L - 6} y={20 + r * ch + ch * 0.8} textAnchor="end">
                {y}
              </text>
            )}
            {Array.from({ length: 12 }, (_, m) => {
              const v = map.get(`${y}-${m + 1}`);
              return (
                <rect
                  key={m}
                  x={L + m * cw}
                  y={18 + r * ch}
                  width={cw - 1}
                  height={ch - 1}
                  fill={v === null || v === undefined ? "url(#hm-hatch)" : colorFor(v)}
                  onMouseMove={(e) => v !== null && v !== undefined && setTip({ x: e.clientX, y: e.clientY, text: format({ year: y, month: m + 1, v }) })}
                  onMouseLeave={() => setTip(null)}
                />
              );
            })}
          </g>
        ))}
      </svg>
      <TipLayer tip={tip} />
    </div>
  );
}

/** Scatter plot with optional colour channel. */
export function Scatter({
  points,
  xLabel,
  yLabel,
  height = 300,
  colorFor,
  format,
  label,
}: {
  points: { x: number; y: number; c?: number | null; key: string }[];
  xLabel: string;
  yLabel: string;
  height?: number;
  colorFor?: (c: number | null | undefined) => string;
  format: (p: { x: number; y: number; c?: number | null; key: string }) => string;
  label: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const x = scaleLinear().domain((extent(points, (p) => p.x) as [number, number]) ?? [0, 1]).nice().range([M.l, w - M.r]);
  const y = scaleLinear().domain([0, max(points, (p) => p.y) ?? 1]).nice().range([height - M.b - 10, M.t]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg className="chart" width={w} height={height} role="img" aria-label={label}>
        {y.ticks(5).map((tk) => (
          <g key={tk}>
            <line className="gridline" x1={M.l} x2={w - M.r} y1={y(tk)} y2={y(tk)} />
            <text x={M.l - 6} y={y(tk) + 4} textAnchor="end">
              {tk}
            </text>
          </g>
        ))}
        {x.ticks(6).map((tk) => (
          <text key={tk} x={x(tk)} y={height - 22} textAnchor="middle">
            {tk}
          </text>
        ))}
        <line x1={x(0)} x2={x(0)} y1={M.t} y2={height - M.b - 10} stroke="var(--ink)" strokeDasharray="3 3" strokeWidth={0.75} />
        {points.map((p) => (
          <circle
            key={p.key}
            cx={x(p.x)}
            cy={y(p.y)}
            r={2.6}
            fill={colorFor ? colorFor(p.c) : "var(--leaf-olive)"}
            fillOpacity={0.6}
            stroke="var(--ink)"
            strokeWidth={0.3}
            onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: format(p) })}
            onMouseLeave={() => setTip(null)}
          />
        ))}
        <text x={w - M.r} y={height - 4} textAnchor="end">
          {xLabel}
        </text>
        <text x={4} y={M.t - 2}>
          {yLabel}
        </text>
      </svg>
      <TipLayer tip={tip} />
    </div>
  );
}

/** Horizontal ranked bars (strip). */
export function RankBars({ rows, format, color = "var(--soil-ochre)", label }: { rows: { key: string; label: string; v: number; sub?: string }[]; format: (v: number) => string; color?: string; label: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const lim = max(rows, (r) => Math.abs(r.v)) ?? 1;
  const lw = Math.min(170, w * 0.42);
  const x = scaleLinear().domain([0, lim]).range([0, w - lw - 60]);
  return (
    <div ref={ref}>
      <svg className="chart" width={w} height={rows.length * 24 + 4} role="img" aria-label={label}>
        {rows.map((r, i) => (
          <g key={r.key} transform={`translate(0 ${i * 24 + 2})`}>
            <text x={lw - 6} y={14} textAnchor="end" style={{ fill: "var(--ink)" }}>
              {r.label.length > 24 ? r.label.slice(0, 23) + "…" : r.label}
            </text>
            <rect x={lw} y={3} width={Math.max(1, x(Math.abs(r.v)))} height={14} fill={r.v < 0 ? "var(--neer-teal)" : color} />
            <text x={lw + x(Math.abs(r.v)) + 4} y={14}>
              {format(r.v)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Small area sparkline with first/last labels for bottom sheets. */
export function MiniTrend({ points, color = "var(--neer-teal)", label, invert = false, unit = "" }: { points: { x: number; y: number | null }[]; color?: string; label: string; invert?: boolean; unit?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(300);
  const h = 56;
  const v = points.filter((p): p is { x: number; y: number } => p.y !== null);
  if (v.length < 2) return null;
  const x = scaleLinear().domain(extent(v, (p) => p.x) as [number, number]).range([4, w - 4]);
  const yd = extent(v, (p) => p.y) as [number, number];
  const y = scaleLinear().domain(yd).range(invert ? [6, h - 14] : [h - 14, 6]);
  const ar = d3area<{ x: number; y: number }>()
    .x((p) => x(p.x))
    .y0(invert ? 6 : h - 14)
    .y1((p) => y(p.y));
  const ln = d3line<{ x: number; y: number }>()
    .x((p) => x(p.x))
    .y((p) => y(p.y));
  return (
    <div ref={ref}>
      <svg className="chart" width={w} height={h} role="img" aria-label={label}>
        <path d={ar(v) ?? ""} fill={color} fillOpacity={0.15} />
        <path d={ln(v) ?? ""} fill="none" stroke={color} strokeWidth={1.5} />
        <text x={4} y={h - 2}>
          {v[0].x}
        </text>
        <text x={w - 4} y={h - 2} textAnchor="end">
          {v[v.length - 1].x}: {v[v.length - 1].y.toFixed(1)}
          {unit}
        </text>
      </svg>
    </div>
  );
}
