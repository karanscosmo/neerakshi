"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useJson } from "@/lib/client/useJson";
import { useSpeech } from "@/lib/client/speech";
import { adviceText, formatDate } from "@/lib/shared/adviceText";
import type { Advisory } from "@/lib/agro/advisory";
import type { BalanceDay } from "@/lib/agro/waterBalance";
import { ChartFrame, useWidth } from "@/components/charts/kit";
import { CropPlate } from "@/components/art/CropPlate";
import { LOCALE_BCP47 } from "@/lib/i18n/config";

type FieldResp = {
  field: { id: string; name: string | null; crop: "rice" | "wheat" | "maize" | "sugarcane"; soil: string; method: "flood" | "furrow" | "drip"; areaHa: number; sowingDate: string; subscribed: boolean; districtId: string | null; language: string };
  latest: { id: number; date: string; createdAt: string; payload: Advisory & { satellite?: { latest?: { date: string; ndvi: number | null } | null; factor?: number; applied?: boolean; mismatch?: string | null; status?: string } } } | null;
  telegramLinked: boolean;
};
type SatResp = { status: "ok"; series: { date: string; ndvi: number | null; ndwi: number | null; validPct: number }[] } | { status: "not_configured" };

export function AdvisoryView({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const f = useJson<FieldResp>(`/api/fields/${id}`);
  const sat = useJson<SatResp>(`/api/fields/${id}/satellite`);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tg, setTg] = useState<{ code: string; deepLink: string } | null>(null);
  const [offline, setOffline] = useState(false);
  const speech = useSpeech(locale);
  const nf = useMemo(() => new Intl.NumberFormat(LOCALE_BCP47[locale], { maximumFractionDigits: 1 }), [locale]);

  const field = f.data?.field;
  const adv = f.data?.latest?.payload ?? null;
  const text = field && adv ? adviceText(t, locale, adv, field.crop, field.method) : null;

  // Cache the last advisory on this device for offline reopening
  useEffect(() => {
    if (!field || !adv || !text) return;
    try {
      localStorage.setItem("nk_last_advisory", JSON.stringify({ fieldId: field.id, name: field.name ?? t.crops[field.crop], date: adv.date, title: text.title, body: text.body, type: adv.type }));
    } catch {}
  }, [field, adv, text, t]);
  useEffect(() => {
    if (f.error && !navigator.onLine) setOffline(true);
  }, [f.error]);

  const act = async (key: string, fn: () => Promise<Response>, ok?: string) => {
    if (busy) return;
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (ok) setMsg(ok);
      return j;
    } catch (e) {
      setMsg(`${t.common.error} ${e instanceof Error ? e.message : ""}`);
    } finally {
      setBusy(null);
    }
  };

  if (offline) return <OfflineAdvisory />;
  if (f.loading) return <div className="page-narrow"><div className="skeleton" style={{ height: 320 }} /></div>;
  if (f.error || !field)
    return (
      <div className="page-narrow">
        <p className="notice" role="alert">
          {f.error === "Field not found" ? t.common.notFound : `${t.common.error} ${f.error ?? ""}`} <Link href="/field">{t.field.newField}</Link>
        </p>
      </div>
    );

  const today = adv?.today ?? null;
  const day = adv?.dayOfSeason;
  const stage = adv?.stage;
  const series = sat.data && sat.data.status === "ok" ? sat.data.series : null;

  return (
    <div className="page-narrow stack" style={{ ["--stack" as string]: "18px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="annot" style={{ margin: 0 }}>
            {t.crops[field.crop]} · {nf.format(field.areaHa)} ha · {t.field.soils[field.soil as keyof typeof t.field.soils]?.label}
          </p>
          <h2 style={{ margin: 0 }}>{field.name || t.field.title}</h2>
        </div>
        <Link href="/field" className="btn btn--ghost btn--sm">
          + {t.field.newField}
        </Link>
      </div>

      {adv && text ? (
        <section className={`advice advice--${adv.type}`} aria-labelledby="adv-title">
          <div className="advice__icon" aria-hidden>
            <AdviceIcon type={adv.type} />
          </div>
          <div className="advice__main">
            <h3 id="adv-title" className="advice__title">
              {text.title}
            </h3>
            {adv.type === "irrigate_now" || adv.type === "irrigate_in" ? (
              <p className="advice__big num">
                {nf.format(Math.round(adv.netDepthMm ?? 0))} <small>mm</small>
                <span className="advice__sub">{fmt(t.advice.litres, { litres: new Intl.NumberFormat(LOCALE_BCP47[locale]).format(adv.grossLitres ?? 0) })}</span>
              </p>
            ) : null}
            {adv.type === "wait_rain" ? (
              <p className="advice__big num">
                {nf.format(adv.rainNext48hMm ?? 0)} <small>mm</small>
              </p>
            ) : null}
            <p className="advice__body">{text.body}</p>
            {adv.nextCheck ? <p className="annot">{fmt(t.advice.nextCheck, { date: formatDate(adv.nextCheck, locale) })}</p> : null}
            <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>
              {fmt(t.field.updated, { time: new Date(f.data!.latest!.createdAt).toLocaleString(LOCALE_BCP47[locale], { dateStyle: "medium", timeStyle: "short" }) })}
            </p>
            <div className="row" style={{ gap: 8 }}>
              {speech.available ? (
                <button className="btn btn--ghost" onClick={() => (speech.speaking ? speech.stop() : speech.speak(`${text.title}. ${text.body}`))}>
                  {speech.speaking ? `■ ${t.field.stopListening}` : `🔊 ${t.field.listen}`}
                </button>
              ) : null}
              <button
                className="btn btn--ghost"
                disabled={busy !== null}
                onClick={async () => {
                  const j = await act("tg", () => fetch(`/api/fields/${id}/telegram`, { method: "POST" }));
                  if (j?.code) setTg(j);
                }}
              >
                ✈ {t.field.sendTelegram}
              </button>
              <button className="btn btn--ghost" disabled={busy !== null} onClick={async () => (await act("refresh", () => fetch(`/api/fields/${id}/advisory`))) && f.retry()}>
                {busy === "refresh" ? t.common.loading : `↻ ${t.field.refresh}`}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="card">
          <p>{t.common.noData}</p>
          <button className="btn" disabled={busy !== null} onClick={async () => (await act("refresh", () => fetch(`/api/fields/${id}/advisory`))) && f.retry()}>
            {t.field.getAdvice}
          </button>
        </section>
      )}

      {tg ? (
        <div className="card" role="status">
          <h3 style={{ fontSize: "var(--step-1)" }}>{t.field.telegramTitle}</h3>
          <p>{t.field.telegramSteps}</p>
          <p className="num" style={{ fontSize: "var(--step-3)", letterSpacing: ".12em" }}>/start {tg.code}</p>
          <a className="btn btn--teal" href={tg.deepLink} target="_blank" rel="noopener noreferrer">
            {t.field.telegramOpen}
          </a>
        </div>
      ) : null}
      {msg ? <p className="notice notice--info" role="status">{msg}</p> : null}

      {/* Notes behind the advice */}
      {adv ? (
        <div className="stack" style={{ ["--stack" as string]: "6px" }}>
          {stage && day !== undefined ? <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>{fmt(t.field.stage, { stage: t.field.stages[stage], day })}</p> : null}
          {adv.startAssumedFc ? <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>{fmt(t.field.startAssumed, { date: formatDate(adv.startDate, locale) })}</p> : null}
          {adv.satellite?.applied && adv.satellite.factor && adv.satellite.factor !== 1 ? (
            <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>{fmt(t.field.kcAdjusted, { pct: `${adv.satellite.factor > 1 ? "+" : ""}${Math.round((adv.satellite.factor - 1) * 100)}` })}</p>
          ) : null}
          {adv.satellite?.mismatch ? <p className="notice">{fmt(t.field.stageMismatch, { stage: stage ? t.field.stages[stage] : "" })}</p> : null}
        </div>
      ) : null}

      {/* Why this advice */}
      {adv && today ? (
        <section className="stack" aria-labelledby="why">
          <h3 id="why">{t.field.whyTitle}</h3>
          <p className="num" style={{ fontSize: ".9rem" }}>
            {fmt(t.field.numbers, { etc: nf.format(today.etcAdj), rain: nf.format(adv.rainNext3dMm ?? 0), dep: nf.format(today.dr), raw: nf.format(today.raw) })}
          </p>
          <div className="grid-2">
            <ChartFrame title={t.field.bucketTitle} source="FAO-56 water balance (Neerakshi); weather: Open-Meteo">
              <Bucket taw={today.taw} raw={today.raw} dr={today.dr} labels={{ dep: fmt(t.field.bucketDepleted, { dep: nf.format(today.dr), taw: nf.format(today.taw) }), raw: fmt(t.field.bucketRaw, { raw: nf.format(today.raw) }) }} />
            </ChartFrame>
            <ChartFrame
              title={t.field.forecastTitle}
              source="Open-Meteo forecast (ET₀, precipitation)"
              table={{ columns: [{ key: "date", label: "Date" }, { key: "precip", label: t.field.forecastRain, numeric: true }, { key: "etc", label: t.field.forecastEt, numeric: true }, { key: "dr", label: "Dr mm", numeric: true }], rows: adv.forecast }}
            >
              <ForecastStrip days={adv.forecast} rainLabel={t.field.forecastRain} etLabel={t.field.forecastEt} locale={locale} />
            </ChartFrame>
          </div>
          <ChartFrame
            title={t.field.ndviTitle}
            source="Sentinel-2 L2A, Copernicus Data Space Statistical API (SCL cloud mask)"
            loading={sat.loading}
            error={sat.error}
            onRetry={sat.retry}
            empty={sat.data?.status === "not_configured" ? t.field.satelliteNotConfigured : series && !series.length ? t.field.ndviNone : null}
            about={{ method: "Daily median NDVI over the field polygon from bands B08 and B04, keeping only pixels classified as vegetation or bare soil. Days with < 30 % clear pixels are shown as gaps, never interpolated.", coverage: "Sowing date (max 120 days back) to today." }}
            table={series ? { columns: [{ key: "date", label: "Date" }, { key: "ndvi", label: "NDVI", numeric: true }, { key: "ndwi", label: "NDWI", numeric: true }, { key: "validPct", label: "% clear", numeric: true }], rows: series } : undefined}
          >
            {series ? <NdviSeries series={series} gapLabel={t.field.ndviGap} /> : null}
          </ChartFrame>
        </section>
      ) : null}

      {/* Field actions */}
      <section className="card stack" style={{ ["--stack" as string]: "10px" }}>
        <div className="row">
          <button className="btn" disabled={busy !== null} onClick={async () => (await act("irr", () => fetch(`/api/fields/${id}/irrigation`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), t.field.irrigatedRecorded)) && (await act("refresh", () => fetch(`/api/fields/${id}/advisory`))) && f.retry()}>
            💧 {t.field.irrigatedToday}
          </button>
          <button
            className="chip"
            aria-pressed={field.subscribed}
            disabled={busy !== null}
            onClick={async () => (await act("sub", () => fetch(`/api/fields/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscribed: !field.subscribed }) }))) && f.retry()}
          >
            {field.subscribed ? `🔔 ${t.field.subscribed}` : `🔕 ${t.field.subscribe}`}
          </button>
          {f.data?.telegramLinked ? <span className="annot">{t.field.telegramLinked}</span> : null}
        </div>
        <button
          className="btn btn--ghost"
          style={{ color: "var(--laterite-text)", borderColor: "var(--laterite-text)", justifySelf: "start" }}
          disabled={busy !== null}
          onClick={async () => {
            if (!window.confirm(t.field.deleteConfirm)) return;
            const j = await act("del", () => fetch(`/api/fields/${id}`, { method: "DELETE" }));
            if (j?.deleted) {
              try {
                localStorage.removeItem("nk_last_advisory");
              } catch {}
              router.push("/field");
            }
          }}
        >
          {t.field.delete}
        </button>
      </section>
      <div style={{ display: "grid", placeItems: "center", opacity: 0.9 }} aria-hidden>
        <CropPlate crop={field.crop} size={160} />
      </div>
      <style>{`
        .advice { display: grid; grid-template-columns: auto 1fr; gap: 16px; padding: 18px; border: 2px solid var(--ink); border-radius: 16px; background: var(--paper-light); }
        .advice--irrigate_now { border-color: var(--laterite); }
        .advice--wait_rain, .advice--no_need { border-color: var(--teal-text); }
        .advice__icon { width: 72px; height: 72px; }
        .advice__title { font-size: var(--step-3); margin: 0; }
        .advice__big { font-size: clamp(3rem, 14vw, 5rem); line-height: 1; margin: 8px 0; font-weight: 500; }
        .advice__big small { font-size: .35em; }
        .advice__sub { display: block; font-size: 1rem; color: var(--slate-text); margin-top: 4px; }
        .advice__body { font-size: var(--step-1); line-height: 1.45; }
        @media (max-width: 520px) { .advice { grid-template-columns: 1fr; } .advice__icon { width: 56px; height: 56px; } }
      `}</style>
    </div>
  );
}

function AdviceIcon({ type }: { type: Advisory["type"] }) {
  const p = { fill: "none", stroke: "var(--ink)", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%">
      {type === "irrigate_now" && <path d="M32 6c9 12 15 21 15 28a15 15 0 0 1-30 0c0-7 6-16 15-28z" {...p} fill="var(--neer-teal)" />}
      {type === "irrigate_in" && (
        <g {...p}>
          <circle cx="32" cy="34" r="22" fill="var(--paper)" />
          <path d="M32 20v15l10 6" />
        </g>
      )}
      {type === "wait_rain" && (
        <g {...p}>
          <path d="M16 36a10 10 0 0 1 2-19.8A14 14 0 0 1 44 18a9 9 0 0 1 2 18z" fill="var(--paper)" />
          <path d="M22 44l-3 8M32 44l-3 8M42 44l-3 8" stroke="var(--neer-teal)" />
        </g>
      )}
      {type === "no_need" && (
        <g {...p}>
          <circle cx="32" cy="32" r="24" fill="var(--paper)" />
          <path d="M20 33l8 8 16-18" stroke="var(--teal-text)" strokeWidth="4" />
        </g>
      )}
      {type === "unavailable" && (
        <g {...p}>
          <circle cx="32" cy="32" r="24" fill="var(--paper)" />
          <path d="M32 18v18M32 44v2" strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}

/** Root-zone bucket: water level = TAW − depletion; dashed line at the readily-available threshold. */
function Bucket({ taw, raw, dr, labels }: { taw: number; raw: number; dr: number; labels: { dep: string; raw: string } }) {
  const H = 200;
  const top = 20;
  const inner = H - top - 20;
  const level = Math.max(0, Math.min(1, (taw - dr) / taw));
  const rawY = top + (raw / taw) * inner;
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(level), 120);
    return () => window.clearTimeout(id);
  }, [level]);
  return (
    <svg viewBox="0 0 320 210" width="100%" role="img" aria-label={`${labels.dep}. ${labels.raw}`}>
      <defs>
        <clipPath id="bk">
          <path d={`M60,${top} L260,${top} L245,${H - 20} L75,${H - 20}Z`} />
        </clipPath>
      </defs>
      <g clipPath="url(#bk)">
        <rect x="40" y={top} width="240" height={inner} fill="var(--neer-teal)" fillOpacity="0.75" style={{ transformOrigin: `160px ${H - 20}px`, transform: `scaleY(${shown})`, transition: "transform 1.1s var(--ease)" }} />
      </g>
      <path d={`M60,${top} L260,${top} L245,${H - 20} L75,${H - 20}Z`} fill="none" stroke="var(--ink)" strokeWidth="2" />
      <line x1="40" x2="280" y1={rawY} y2={rawY} stroke="var(--laterite)" strokeWidth="2" strokeDasharray="7 5" />
      <text x="282" y={rawY + 4} fontSize="11" fontFamily="var(--ff-mono)" fill="var(--laterite-text)">
        RAW
      </text>
      <text x="160" y={H - 4} textAnchor="middle" fontSize="11" fontFamily="var(--ff-mono)" fill="var(--ink)">
        {labels.dep}
      </text>
      <text x="160" y="13" textAnchor="middle" fontSize="11" fontFamily="var(--ff-mono)" fill="var(--ink)">
        {labels.raw}
      </text>
    </svg>
  );
}

function ForecastStrip({ days, rainLabel, etLabel, locale }: { days: BalanceDay[]; rainLabel: string; etLabel: string; locale: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(320);
  if (!days.length) return null;
  const max = Math.max(10, ...days.map((d) => Math.max(d.precip, d.etcAdj)));
  const col = w / days.length;
  const H = 150;
  const s = (v: number) => (v / max) * (H - 40);
  const df = new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale === "hi" ? "hi-IN" : "kn-IN", { weekday: "short", timeZone: "UTC" });
  return (
    <div ref={ref}>
      <svg className="chart" width={w} height={H} role="img" aria-label={`${rainLabel}, ${etLabel}`}>
        {days.map((d, i) => (
          <g key={d.date} transform={`translate(${i * col} 0)`}>
            <rect x={col * 0.18} y={H - 22 - s(d.precip)} width={col * 0.3} height={s(d.precip)} fill="var(--neer-teal)" />
            <rect x={col * 0.52} y={H - 22 - s(d.etcAdj)} width={col * 0.3} height={s(d.etcAdj)} fill="var(--dawn-saffron)" />
            <text x={col / 2} y={H - 6} textAnchor="middle">
              {df.format(new Date(d.date + "T00:00:00Z"))}
            </text>
            <text x={col * 0.33} y={H - 26 - s(d.precip)} textAnchor="middle" fontSize="9">
              {d.precip ? Math.round(d.precip) : ""}
            </text>
          </g>
        ))}
      </svg>
      <div className="row" style={{ gap: 12, fontSize: ".8rem" }}>
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, background: "var(--neer-teal)", display: "inline-block" }} /> {rainLabel}
        </span>
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 12, height: 12, background: "var(--dawn-saffron)", display: "inline-block" }} /> {etLabel}
        </span>
      </div>
    </div>
  );
}

function NdviSeries({ series, gapLabel }: { series: { date: string; ndvi: number | null; validPct: number }[]; gapLabel: string }) {
  const [ref, w] = useWidth<HTMLDivElement>(320);
  const H = 160;
  const t0 = Date.parse(series[0].date);
  const t1 = Date.parse(series[series.length - 1].date);
  const x = (d: string) => 30 + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (w - 40);
  const y = (v: number) => 10 + (1 - (v + 0.1) / 1.1) * (H - 30);
  const pts = series.filter((s) => s.ndvi !== null);
  return (
    <div ref={ref}>
      <svg className="chart" width={w} height={H} role="img" aria-label="NDVI">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line className="gridline" x1={30} x2={w - 10} y1={y(v)} y2={y(v)} />
            <text x={26} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {series
          .filter((s) => s.ndvi === null)
          .map((s) => (
            <line key={s.date} x1={x(s.date)} x2={x(s.date)} y1={10} y2={H - 20} stroke="var(--monsoon-slate)" strokeOpacity="0.35" strokeDasharray="2 3">
              <title>
                {s.date}: {gapLabel}
              </title>
            </line>
          ))}
        {pts.map((s, i) => (
          <g key={s.date}>
            {i > 0 && Date.parse(s.date) - Date.parse(pts[i - 1].date) < 20 * 86400000 ? <line x1={x(pts[i - 1].date)} y1={y(pts[i - 1].ndvi!)} x2={x(s.date)} y2={y(s.ndvi!)} stroke="var(--leaf-olive)" strokeWidth="1.5" /> : null}
            <circle cx={x(s.date)} cy={y(s.ndvi!)} r="3" fill="var(--leaf-olive)">
              <title>
                {s.date}: {s.ndvi}
              </title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function OfflineAdvisory() {
  const { t } = useI18n();
  const [a, setA] = useState<{ name: string; date: string; title: string; body: string } | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("nk_last_advisory");
      if (v) setA(JSON.parse(v));
    } catch {}
  }, []);
  return (
    <div className="page-narrow stack">
      <h2>{t.pwa.offlineTitle}</h2>
      <p>{t.pwa.offlineBody}</p>
      {a ? (
        <section className="advice card" style={{ display: "block" }}>
          <p className="annot">
            {t.pwa.lastAdvisory} · {a.name} · {a.date}
          </p>
          <h3 className="advice__title">{a.title}</h3>
          <p className="advice__body">{a.body}</p>
          <p className="annot">{fmt(t.field.staleOffline, { date: a.date })}</p>
        </section>
      ) : (
        <p className="annot">{t.pwa.none}</p>
      )}
    </div>
  );
}
