"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useDistrict } from "@/lib/client/district";
import { useJson } from "@/lib/client/useJson";
import { ChartFrame, LineChart, RankBars, useWidth } from "@/components/charts/kit";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { RAMPS } from "@/lib/shared/scales";
import { LOCALE_BCP47 } from "@/lib/i18n/config";

type Row = { id: string; year: number; season: "pre_monsoon" | "post_monsoon"; depth: number | null; change: number | null; wells: number; name: string; state: string };
type Resp = { ids: string[]; rows: Row[]; latest: number | null; decline: { id: string; name: string; state: string; change: number; wells: number }[] };

const SOURCE = "CGWB observation wells 1996–2017 (via craigdsouza/cgwb), May and November readings";

export function GroundwaterView() {
  const { t, locale } = useI18n();
  const { districtId, districts } = useDistrict();
  const [extra, setExtra] = useState<string[]>([]);
  const ids = extra.length ? [districtId, ...extra.filter((x) => x !== districtId)].slice(0, 6) : [];
  const r = useJson<Resp>(`/api/atlas/groundwater?d=${districtId}${ids.length ? `&ids=${ids.slice(1).join(",")}` : ""}`);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 1 }), [locale]);
  const data = r.data;
  const me = districts.find((d) => d.id === districtId);
  const stateDistricts = districts.filter((d) => d.stateCode === me?.stateCode && d.id !== districtId);

  // Latest year where each well-district has both seasons
  const wellsYear = useMemo(() => {
    if (!data) return null;
    const ys = [...new Set(data.rows.map((x) => x.year))].sort((a, b) => b - a);
    return ys.find((y) => data.ids.every((id) => data.rows.some((x) => x.id === id && x.year === y && x.season === "pre_monsoon" && x.depth !== null))) ?? ys[0] ?? null;
  }, [data]);
  const wells = useMemo(() => {
    if (!data || wellsYear === null) return [];
    return data.ids
      .map((id) => {
        const pre = data.rows.find((x) => x.id === id && x.year === wellsYear && x.season === "pre_monsoon");
        const post = data.rows.find((x) => x.id === id && x.year === wellsYear && x.season === "post_monsoon");
        const name = pre?.name ?? post?.name ?? districts.find((d) => d.id === id)?.name ?? id;
        return { id, name, pre: pre?.depth ?? null, post: post?.depth ?? null, n: pre?.wells ?? post?.wells ?? 0 };
      })
      .filter((w) => w.pre !== null || w.post !== null);
  }, [data, wellsYear, districts]);

  const trend = useMemo(() => {
    const mine = (data?.rows ?? []).filter((x) => x.id === districtId);
    const years = [...new Set(mine.map((x) => x.year))].sort();
    const pick = (s: Row["season"]) => years.map((y) => ({ x: y, y: mine.find((m) => m.year === y && m.season === s)?.depth ?? null }));
    return [
      { key: "pre", label: t.seasons.pre_monsoon, color: "var(--soil-ochre)", points: pick("pre_monsoon") },
      { key: "post", label: t.seasons.post_monsoon, color: "var(--neer-teal)", dash: "5 3", points: pick("post_monsoon") },
    ];
  }, [data, districtId, t]);
  const hasTrend = trend.some((s) => s.points.some((p) => p.y !== null));

  // Animated map by year
  const [mapYear, setMapYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const lay = useJson<{ years: number[]; year: number; values: { id: string; v: number | null }[] }>(`/api/atlas/layer?layer=groundwater${mapYear ? `&year=${mapYear}` : ""}`);
  useEffect(() => {
    if (!playing || !lay.data) return;
    const ys = lay.data.years;
    const id = window.setTimeout(() => {
      const i = ys.indexOf(lay.data!.year);
      if (i + 1 >= ys.length) setPlaying(false);
      else setMapYear(ys[i + 1]);
    }, 800);
    return () => window.clearTimeout(id);
  }, [playing, lay.data]);

  return (
    <div className="page">
      <header style={{ maxWidth: 760 }}>
        <h2>{t.groundwater.title}</h2>
        <p>{t.groundwater.lead}</p>
      </header>
      <ChartFrame
        title={`${t.groundwater.wellTitle}${wellsYear ? ` · ${wellsYear}` : ""}`}
        subtitle={t.groundwater.wellLead}
        source={SOURCE}
        loading={r.loading}
        error={r.error}
        onRetry={r.retry}
        empty={!r.loading && data && !wells.length ? t.common.noDataHint : null}
        about={{ method: "Median depth to water of all wells read in the district, May (pre-monsoon) and November (post-monsoon) of the same year, drawn to scale.", coverage: "1996–2016, 24 states. Mostly dug wells (shallow aquifer)." }}
        table={{
          columns: [
            { key: "name", label: t.common.district },
            { key: "pre", label: `${t.seasons.pre_monsoon} (m)`, numeric: true },
            { key: "post", label: `${t.seasons.post_monsoon} (m)`, numeric: true },
            { key: "n", label: "wells", numeric: true },
          ],
          rows: wells,
        }}
      >
        <Wells wells={wells} labels={{ pre: t.seasons.pre_monsoon, post: t.seasons.post_monsoon, wells: t.groundwater.wells }} nf={nf} />
        <div className="row" style={{ marginTop: 8 }}>
          <label className="field" style={{ minWidth: 220 }}>
            <span className="annot">{t.groundwater.addDistrict}</span>
            <select
              className="select"
              value=""
              onChange={(e) => e.target.value && setExtra((x) => [...new Set([...(x.length ? x : (data?.ids ?? []).filter((i) => i !== districtId)), e.target.value])].slice(-5))}
            >
              <option value="">—</option>
              {stateDistricts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ChartFrame>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <ChartFrame
          title={fmt(t.groundwater.trendTitle, { district: me?.name ?? "" })}
          source={SOURCE}
          loading={r.loading}
          empty={!r.loading && !hasTrend ? t.common.noDataHint : null}
          about={{ method: "District median depth below ground level; the axis points down like a well. Gaps are years without readings — never interpolated.", coverage: "1996–2016." }}
          table={{ columns: [{ key: "x", label: t.common.year }, { key: "y", label: "m bgl", numeric: true }], rows: trend[0].points }}
        >
          <LineChart series={trend} yLabel="m below ground" invertY yDomain={[0, Math.max(5, ...trend.flatMap((s) => s.points.map((p) => p.y ?? 0)))]} format={(s, p) => `${s.label}: ${nf.format(p.y)} m`} label={t.groundwater.trendTitle} />
        </ChartFrame>
        <ChartFrame
          title={`${t.groundwater.rankTitle}${data?.latest ? ` · ${data.latest}` : ""}`}
          subtitle={t.groundwater.rankLead}
          source={SOURCE}
          loading={r.loading}
          about={{ method: "For each well with ≥ 3 readings in 1996–2005: depth minus that well's own baseline mean; district value = median over wells. Districts with ≥ 5 wells only.", coverage: "Latest pre-monsoon reading." }}
          table={{ columns: [{ key: "name", label: t.common.district }, { key: "state", label: t.common.state }, { key: "change", label: "m", numeric: true }], rows: data?.decline ?? [] }}
        >
          <RankBars rows={(data?.decline ?? []).map((x) => ({ key: x.id, label: `${x.name}, ${x.state}`, v: x.change }))} format={(v) => `${v > 0 ? "+" : ""}${nf.format(v)} m`} label={t.groundwater.rankTitle} />
        </ChartFrame>
      </div>

      <ChartFrame
        title={`${t.groundwater.mapTitle}${lay.data ? ` · ${lay.data.year}` : ""}`}
        source={SOURCE}
        loading={false}
        about={{ method: "Median pre-monsoon depth per district; hatched = no wells read that year.", coverage: "1996–2016." }}
      >
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn btn--sm btn--ghost" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? `❚❚ ${t.atlas.pause}` : `▶ ${t.atlas.play}`}
          </button>
          {lay.data ? (
            <label className="row" style={{ gap: 8 }}>
              <input type="range" min={lay.data.years[0]} max={lay.data.years.at(-1)} value={lay.data.year} onChange={(e) => setMapYear(Number(e.target.value))} aria-label={t.common.year} />
              <span className="num">{lay.data.year}</span>
            </label>
          ) : null}
        </div>
        <div style={{ position: "relative", height: 460 }}>
          <AtlasMap values={lay.data?.values ?? []} ramp={RAMPS.groundwater} selected={districtId} label={t.groundwater.mapTitle} />
        </div>
        <div className="legend__ramp" style={{ display: "flex", height: 10, maxWidth: 320, marginTop: 8, border: "1px solid var(--ink)" }}>
          {RAMPS.groundwater.stops.map((c) => (
            <span key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <p className="annot" style={{ maxWidth: 320, display: "flex", justifyContent: "space-between" }}>
          <span>{t.atlas.shallow} 0 m</span>
          <span>{t.atlas.deep} 40 m+</span>
        </p>
      </ChartFrame>
    </div>
  );
}

/** Aquifer cross-section: one well per district, water table drawn to scale; it rises after the monsoon and falls before it. */
function Wells({ wells, labels, nf }: { wells: { id: string; name: string; pre: number | null; post: number | null; n: number }[]; labels: { pre: string; post: string; wells: string }; nf: Intl.NumberFormat }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [post, setPost] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setPost((p) => !p), 2600);
    return () => window.clearInterval(id);
  }, []);
  const H = 300;
  const top = 40;
  const maxD = Math.max(10, ...wells.flatMap((x) => [x.pre ?? 0, x.post ?? 0])) * 1.15;
  const y = (m: number) => top + (m / maxD) * (H - top - 30);
  const col = w / Math.max(1, wells.length);
  return (
    <div ref={ref}>
      <div className="row" role="group" style={{ gap: 6, marginBottom: 6 }}>
        <button className="chip" aria-pressed={!post} onClick={() => setPost(false)}>
          {labels.pre}
        </button>
        <button className="chip" aria-pressed={post} onClick={() => setPost(true)}>
          {labels.post}
        </button>
      </div>
      <svg className="chart" width={w} height={H} role="img" aria-label="Wells cross-section">
        <rect x={0} y={top} width={w} height={H - top} fill="var(--soil-ochre)" fillOpacity={0.15} />
        <line x1={0} x2={w} y1={top} y2={top} stroke="var(--ink)" strokeWidth={1.2} />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            <line x1={0} x2={8} y1={y((maxD / 6) * i)} y2={y((maxD / 6) * i)} stroke="var(--ink)" />
            <text x={10} y={y((maxD / 6) * i) + 4}>{`−${Math.round((maxD / 6) * i)} m`}</text>
          </g>
        ))}
        {wells.map((wl, i) => {
          const cx = col * i + col / 2 + 20;
          const d = post ? wl.post : wl.pre;
          const wy = d === null ? null : y(d);
          return (
            <g key={wl.id}>
              <text x={cx} y={16} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 600 }}>
                {wl.name.length > 14 ? wl.name.slice(0, 13) + "…" : wl.name}
              </text>
              <text x={cx} y={31} textAnchor="middle">
                {d === null ? "—" : `${nf.format(d)} m`}
              </text>
              <rect x={cx - 14} y={top} width={28} height={H - top - 20} fill="var(--paper-light)" stroke="var(--ink)" />
              <clipPath id={`well-${wl.id}`}>
                <rect x={cx - 13} y={top} width={26} height={H - top - 21} />
              </clipPath>
              {wy !== null ? (
                <g clipPath={`url(#well-${wl.id})`}>
                  <rect x={cx - 13} y={0} width={26} height={H} fill="var(--neer-teal)" fillOpacity={0.75} style={{ transform: `translateY(${wy}px)`, transition: "transform 900ms var(--ease)" }} />
                </g>
              ) : null}
              <text x={cx} y={H - 4} textAnchor="middle">{fmt(labels.wells, { count: wl.n })}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
