"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n, fmt } from "@/lib/i18n/client";
import { useJson } from "@/lib/client/useJson";
import { FieldMap } from "./FieldMap";
import { CropPlate } from "@/components/art/CropPlate";
import { SoilSwatch } from "./SoilSwatch";

const CROPS = ["rice", "wheat", "maize", "sugarcane"] as const;
const SOILS = ["sandy", "loam", "clay_loam", "clay"] as const;
const METHODS = ["flood", "furrow", "drip"] as const;
type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";
type SavedField = { id: string; name: string | null; crop: string; areaHa: number; districtId: string | null; createdAt: string };

function todayIso() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function FieldFlow() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const saved = useJson<{ fields: SavedField[] }>("/api/fields");
  const [step, setStep] = useState(1);
  const [center, setCenter] = useState<[number, number] | null>(() => {
    const lat = Number(sp.get("lat"));
    const lon = Number(sp.get("lon"));
    return lat && lon ? [lat, lon] : null;
  });
  const [geom, setGeom] = useState<GeoJSON.Polygon | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ name: string; lat: number; lon: number; admin: string }[]>([]);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", crop: "rice" as (typeof CROPS)[number], sowingDate: "", soil: "loam" as (typeof SOILS)[number], method: "flood" as (typeof METHODS)[number], lastIrrigationDate: "" });
  const [status, setStatus] = useState<Record<"save" | "satellite" | "weather", { s: StepStatus; note?: string }>>({ save: { s: "pending" }, satellite: { s: "pending" }, weather: { s: "pending" } });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Village search (debounced)
  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const c = new AbortController();
    const id = window.setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}&lang=${locale}`, { signal: c.signal })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? r.status);
          setSearchErr(null);
          setResults(j.results);
        })
        .catch((e) => e.name !== "AbortError" && setSearchErr(String(e.message ?? e)));
    }, 350);
    return () => {
      c.abort();
      window.clearTimeout(id);
    };
  }, [q, locale]);

  const locate = () => {
    setLocMsg(t.common.locating);
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setCenter([p.coords.latitude, p.coords.longitude]);
        setLocMsg(null);
      },
      () => setLocMsg(t.common.locationFailed),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const submit = async () => {
    if (busy || !geom) return;
    setBusy(true);
    setErr(null);
    setStep(3);
    setStatus({ save: { s: "running" }, satellite: { s: "pending" }, weather: { s: "pending" } });
    try {
      const r = await fetch("/api/fields", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name || null, lastIrrigationDate: form.lastIrrigationDate || null, geometry: geom, language: locale }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const id = j.field.id as string;
      setStatus((s) => ({ ...s, save: { s: "done" }, satellite: { s: "running" } }));
      const sr = await fetch(`/api/fields/${id}/satellite`);
      const sj = await sr.json().catch(() => ({}));
      setStatus((s) => ({
        ...s,
        satellite: sr.ok ? (sj.status === "not_configured" ? { s: "skipped", note: t.field.satelliteNotConfigured } : { s: "done", note: `${sj.series?.filter((x: { ndvi: number | null }) => x.ndvi !== null).length ?? 0} clear / ${sj.series?.length ?? 0}` }) : { s: "failed", note: sj.error },
        weather: { s: "running" },
      }));
      const ar = await fetch(`/api/fields/${id}/advisory`);
      const aj = await ar.json().catch(() => ({}));
      setStatus((s) => ({ ...s, weather: ar.ok && !aj.weatherError ? { s: "done" } : { s: "failed", note: aj.weatherError ?? aj.error } }));
      try {
        localStorage.setItem("nk_last_field", id);
      } catch {}
      window.setTimeout(() => router.push(`/field/${id}`), 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStatus((s) => ({ ...s, save: s.save.s === "running" ? { s: "failed" } : s.save }));
      setBusy(false);
    }
  };

  const canNext2 = Boolean(form.sowingDate);
  const stepTitle = [t.field.stepFind, t.field.stepAbout, t.field.stepSky, t.field.stepAdvice][step - 1];
  const icon = (s: StepStatus) => (s === "done" ? "✓" : s === "failed" ? "✕" : s === "skipped" ? "–" : s === "running" ? "◌" : "·");
  const label = (s: StepStatus) => (s === "done" ? t.field.statusDone : s === "failed" ? t.field.statusFailed : s === "skipped" ? t.field.statusSkipped : "");

  return (
    <div className="page-narrow">
      {saved.data?.fields.length ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: "var(--step-1)" }}>{t.field.savedFields}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {saved.data.fields.map((f) => (
              <li key={f.id}>
                <Link href={`/field/${f.id}`} className="row saved-row">
                  <span>{f.name || t.crops[f.crop as keyof typeof t.crops]}</span>
                  <span className="annot">
                    {t.crops[f.crop as keyof typeof t.crops]} · {f.areaHa.toFixed(2)} ha
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ol className="steps" aria-label={t.field.title}>
        {[1, 2, 3, 4].map((n) => (
          <li key={n} aria-current={n === step ? "step" : undefined} data-done={n < step}>
            <span>{n}</span>
          </li>
        ))}
      </ol>
      <p className="annot">{fmt(t.field.step, { n: step })}</p>
      <h2>{stepTitle}</h2>

      {step === 1 ? (
        <section className="stack">
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              <span>{t.field.searchPlace}</span>
              <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.field.searchHint} autoComplete="off" />
            </label>
            <button className="btn btn--ghost" onClick={locate}>
              ◎ {t.field.locate}
            </button>
          </div>
          {locMsg ? <p className="annot" role="status">{locMsg}</p> : null}
          {searchErr ? <p className="notice" role="alert">{t.common.error} {searchErr}</p> : null}
          {results.length ? (
            <ul className="results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    className="picker__item"
                    onClick={() => {
                      setCenter([r.lat, r.lon]);
                      setResults([]);
                      setQ(r.name);
                    }}
                  >
                    <span>{r.name}</span>
                    <span className="annot">{r.admin}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <FieldMap center={center} onChange={setGeom} initial={geom} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" disabled={!geom} onClick={() => setStep(2)}>
              {t.field.next} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="stack" style={{ ["--stack" as string]: "18px" }}>
          <label className="field">
            <span>{t.field.fieldName}</span>
            <input className="input" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <fieldset className="plain">
            <legend>{t.field.crop}</legend>
            <div className="choice-grid">
              {CROPS.map((c) => (
                <button key={c} type="button" className="choice card" aria-pressed={form.crop === c} onClick={() => setForm({ ...form, crop: c })}>
                  <CropPlate crop={c} size={90} />
                  <span>{t.crops[c]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>{t.field.sowingDate}</span>
            <input className="input" type="date" required max={todayIso()} value={form.sowingDate} onChange={(e) => setForm({ ...form, sowingDate: e.target.value })} />
          </label>
          <fieldset className="plain">
            <legend>{t.field.soil}</legend>
            <div className="choice-grid">
              {SOILS.map((s) => (
                <button key={s} type="button" className="choice card" aria-pressed={form.soil === s} onClick={() => setForm({ ...form, soil: s })}>
                  <SoilSwatch soil={s} />
                  <span>{t.field.soils[s].label}</span>
                  <small>{t.field.soils[s].desc}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="plain">
            <legend>{t.field.method}</legend>
            <div className="row" style={{ gap: 6 }}>
              {METHODS.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={form.method === m} onClick={() => setForm({ ...form, method: m })}>
                  {t.field.methods[m]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>{t.field.lastIrrigation}</span>
            <input className="input" type="date" max={todayIso()} value={form.lastIrrigationDate} onChange={(e) => setForm({ ...form, lastIrrigationDate: e.target.value })} />
            <small className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>{t.field.lastIrrigationUnknown}: —</small>
          </label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn btn--ghost" onClick={() => setStep(1)}>
              ← {t.field.prev}
            </button>
            <button className="btn btn--teal" disabled={!canNext2 || busy} onClick={submit}>
              {t.field.getAdvice} →
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card sky-status" aria-live="polite">
          {(
            [
              ["save", t.field.statusSaving],
              ["satellite", t.field.statusSatellite],
              ["weather", `${t.field.statusWeather} · ${t.field.statusBalance}`],
            ] as const
          ).map(([k, lbl]) => (
            <div key={k} className="sky-row" data-s={status[k].s}>
              <span className="sky-icon" aria-hidden>
                {icon(status[k].s)}
              </span>
              <div>
                <p style={{ margin: 0 }}>{lbl}</p>
                <p className="annot" style={{ margin: 0, textTransform: "none", letterSpacing: 0 }}>
                  {label(status[k].s)} {status[k].note ?? ""}
                </p>
              </div>
            </div>
          ))}
          {err ? (
            <div className="notice" role="alert">
              {t.common.error} {err}{" "}
              <button className="btn btn--ghost btn--sm" onClick={() => setStep(2)}>
                ← {t.field.prev}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      <style>{`
        .steps { display: flex; gap: 8px; list-style: none; padding: 0; margin: 0 0 6px; }
        .steps li { flex: 1; height: 6px; border-radius: 3px; background: var(--grid); }
        .steps li[data-done="true"], .steps li[aria-current="step"] { background: var(--teal-text); }
        .steps li span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        fieldset.plain { border: 0; padding: 0; margin: 0; }
        fieldset.plain legend { font-size: var(--step--1); margin-bottom: 6px; }
        .choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        @media (min-width: 640px) { .choice-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .choice { display: grid; justify-items: center; gap: 4px; padding: 8px; cursor: pointer; text-align: center; min-height: 44px; }
        .choice svg { max-width: 100%; height: auto; }
        .choice[aria-pressed="true"] { border: 2px solid var(--ink); background: var(--paper-deep); }
        .choice small { color: var(--slate-text); font-size: .74rem; }
        .results { list-style: none; padding: 0; margin: 0; border: 1px solid var(--hairline); border-radius: 8px; max-height: 240px; overflow: auto; background: var(--paper-light); }
        .picker__item { width: 100%; min-height: 44px; display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--hairline); background: none; cursor: pointer; text-align: left; }
        .saved-row { justify-content: space-between; min-height: 44px; border-bottom: 1px solid var(--hairline); text-decoration: none; color: inherit; }
        .sky-status { display: grid; gap: 14px; }
        .sky-row { display: flex; gap: 12px; align-items: flex-start; }
        .sky-icon { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--ink); display: grid; place-items: center; flex: none; font-family: var(--ff-mono); }
        .sky-row[data-s="running"] .sky-icon { animation: spin 1.1s linear infinite; border-style: dashed; }
        .sky-row[data-s="done"] .sky-icon { background: var(--teal-text); color: var(--paper); border-color: var(--teal-text); }
        .sky-row[data-s="failed"] .sky-icon { background: var(--laterite-text); color: var(--paper); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
