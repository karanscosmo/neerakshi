"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CloudRain,
  Droplets,
  Eraser,
  Gauge,
  Leaf,
  Loader2,
  MapPin,
  MessageCircle,
  Printer,
  Satellite,
  Share2,
  Sprout,
  Trash2,
  Trees,
  Volume2,
  Wheat,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { FieldMap, type SelectedField } from "@/components/advisor/FieldMap";
import type { AdvisoryResult } from "@/lib/agro/waterBalance";
import type { WeatherResult } from "@/lib/services/weather";
import type { SatelliteResult } from "@/lib/services/satellite";
import { cn, formatDate, formatNumber, formatPercent } from "@/lib/utils";

type CropKey = "rice" | "wheat" | "maize" | "sugarcane";
type SoilKey = "sandy" | "loam" | "clay_loam" | "clay";
type MethodKey = "flood" | "furrow" | "drip";

interface AdvisorResponse {
  advisory: AdvisoryResult;
  weather: WeatherResult;
  satellite: SatelliteResult;
  input: {
    lat: number;
    lon: number;
    areaHa: number;
    crop: CropKey;
    soil: SoilKey;
    irrigationMethod: MethodKey;
    sowingDate: string;
    assessmentDate: string;
    fieldId: string | null;
  };
}

interface SavedField {
  id: string;
  name: string;
  centroidLat: number;
  centroidLon: number;
  areaHa: number;
  crop: string;
  soil: string;
  irrigationMethod: string;
  sowingDate: string;
  createdAt: string;
}

interface HistoryRow {
  id: string;
  createdAt: string;
  assessmentDate: string;
  decision: string;
  result: AdvisoryResult | null;
}

const CROPS: { key: CropKey; name: string; note: string; icon: typeof Sprout }[] = [
  { key: "rice", name: "Rice / Paddy", note: "Kharif · high water demand", icon: Sprout },
  { key: "wheat", name: "Wheat", note: "Rabi · responsive to crown-root irrigation", icon: Wheat },
  { key: "maize", name: "Maize", note: "Kharif / Rabi · moderate demand", icon: Leaf },
  { key: "sugarcane", name: "Sugarcane", note: "Annual · very high demand", icon: Trees },
];

const SOILS: { key: SoilKey; name: string }[] = [
  { key: "sandy", name: "Sandy" },
  { key: "loam", name: "Loam" },
  { key: "clay_loam", name: "Clay loam" },
  { key: "clay", name: "Clay" },
];

const METHODS: { key: MethodKey; name: string }[] = [
  { key: "flood", name: "Flood" },
  { key: "furrow", name: "Furrow" },
  { key: "drip", name: "Drip" },
];

const REASONS: Record<string, string> = {
  depletion_at_or_above_raw:
    "Root-zone depletion has reached the readily available water threshold. Waiting further would push the crop into stress.",
  raw_reached_but_rain_expected:
    "Depletion has reached the threshold, but useful rain is expected within two days, so irrigation can wait.",
  rain_expected_before_threshold:
    "Rain expected before the crop reaches its stress threshold should refill part of the root zone, so irrigating now would risk waste.",
  raw_expected_within_seven_days:
    "The water balance projects depletion reaching the threshold within the next seven days, which sets the irrigation window.",
  depletion_below_raw:
    "Depletion remains below the readily available water threshold. The crop can still extract water comfortably.",
  missing_critical_input:
    "A critical input is missing, so a defensible decision cannot be calculated.",
};

const DECISION_STYLES: Record<string, string> = {
  IRRIGATE_NOW: "border-coral/45 bg-coral/10",
  IRRIGATE_IN_DAYS: "border-amber/45 bg-amber/10",
  WAIT_FOR_RAIN: "border-glacier/45 bg-glacier/10",
  NO_IRRIGATION: "border-mint/45 bg-mint/10",
  UNAVAILABLE: "border-line bg-deep/40",
};

export function AdvisorClient() {
  const t = useTranslations("Advisor");
  const [step, setStep] = useState(0);
  const [field, setField] = useState<SelectedField | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [crop, setCrop] = useState<CropKey>("rice");
  const [soil, setSoil] = useState<SoilKey>("loam");
  const [method, setMethod] = useState<MethodKey>("flood");
  const [sowingDate, setSowingDate] = useState("");
  const [areaHa, setAreaHa] = useState(1);
  const [previousDepletion, setPreviousDepletion] = useState("");
  const [mapCenter, setMapCenter] = useState<[number, number]>([78.96, 22.59]);
  const [mapKey, setMapKey] = useState(0);
  const [clearToken, setClearToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AdvisorResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFields, setSavedFields] = useState<SavedField[]>([]);
  const [savedFieldId, setSavedFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [recordDepth, setRecordDepth] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordMessage, setRecordMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    try {
      const response = await fetch("/api/fields", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { fields?: SavedField[] };
      setSavedFields(data.fields ?? []);
    } catch {
      setSavedFields([]);
    }
  }, []);

  const loadHistory = useCallback(async (fieldId: string) => {
    try {
      const response = await fetch(`/api/fields/${fieldId}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { advisories?: HistoryRow[] };
      setHistory(data.advisories ?? []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadFields();
    })();
  }, [loadFields]);

  const cropName = CROPS.find((item) => item.key === crop)?.name ?? crop;
  const today = new Date().toISOString().slice(0, 10);

  function handleFieldChange(next: SelectedField | null) {
    setField(next);
    if (next) {
      const hectares =
        next.kind === "polygon" && next.areaHa > 0
          ? Math.round(next.areaHa * 100) / 100
          : Math.max(0.1, areaHa);
      setAreaHa(hectares);
      setFormError(null);
    }
  }

  function next() {
    setFormError(null);
    if (step === 0) {
      if (!field) {
        setFormError(t("boundaryRequired"));
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!sowingDate) {
        setFormError(t("sowingRequired"));
        return;
      }
      if (!areaHa || areaHa <= 0) {
        setFormError("Enter a field area greater than zero.");
        return;
      }
      void runAnalysis();
    }
  }

  async function runAnalysis() {
    if (!field) return;
    setStep(2);
    setLoading(true);
    setAnalysisError(null);
    setAnalysis(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: field.centroid[1],
          lon: field.centroid[0],
          geometry: field.geometry,
          crop,
          soil,
          irrigationMethod: method,
          sowingDate,
          areaHa,
          previousDepletionMm: previousDepletion ? Number(previousDepletion) : null,
          fieldId: savedFieldId,
        }),
      });
      const data = (await response.json()) as
        | AdvisorResponse
        | { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(
          "message" in data && data.message
            ? data.message
            : "error" in data && data.error
              ? data.error
              : t("analysisFailed"),
        );
      }
      const advisoryResponse = data as AdvisorResponse;
      const gross = advisoryResponse.advisory.grossIrrigationMm;
      if (gross) {
        setRecordDepth(String(gross));
      }
      setAnalysis(advisoryResponse);
    } catch (error) {
      setAnalysisError(
        error instanceof Error ? error.message : t("analysisFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveField() {
    if (!field || !analysis || saving || savedFieldId) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fieldName.trim() || `${cropName} field · ${formatDate(sowingDate)}`,
          geometry: field.geometry,
          centroidLat: field.centroid[1],
          centroidLon: field.centroid[0],
          areaHa,
          crop,
          soil,
          irrigationMethod: method,
          sowingDate,
          advisory: analysis.advisory,
        }),
      });
      const data = (await response.json()) as { field?: SavedField; error?: string };
      if (!response.ok || !data.field) {
        throw new Error(data.error ?? "The field could not be saved.");
      }
      setSavedFieldId(data.field.id);
      setSaveMessage("Field saved. This advisory is now in its history.");
      await loadFields();
      await loadHistory(data.field.id);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "The field could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function openSaved(id: string) {
    setFormError(null);
    try {
      const response = await fetch(`/api/fields/${id}`, { cache: "no-store" });
      const data = (await response.json()) as {
        field?: SavedField;
        advisories?: HistoryRow[];
        error?: string;
      };
      if (!response.ok || !data.field) {
        throw new Error(data.error ?? "The field could not be loaded.");
      }
      const row = data.field;
      setFieldName(row.name);
      setCrop(row.crop as CropKey);
      setSoil(row.soil as SoilKey);
      setMethod(row.irrigationMethod as MethodKey);
      setSowingDate(row.sowingDate);
      setAreaHa(row.areaHa);
      setSavedFieldId(row.id);
      setHistory(data.advisories ?? []);
      setAnalysis(null);
      setAnalysisError(null);
      setField(null);
      setMapCenter([row.centroidLon, row.centroidLat]);
      setMapKey((value) => value + 1);
      setClearToken((value) => value + 1);
      setStep(1);
      setNotice(
        `Loaded “${row.name}”. Drop the pin again at the saved location (${row.centroidLat.toFixed(4)}, ${row.centroidLon.toFixed(4)}) before re-running the advisory.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The field could not be loaded.");
    }
  }

  async function deleteSaved(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await fetch(`/api/fields?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (savedFieldId === id) {
        setSavedFieldId(null);
        setHistory([]);
        setSaveMessage(null);
      }
      await loadFields();
    } catch {
      setNotice("The field could not be deleted.");
    }
  }

  async function recordIrrigation() {
    if (!savedFieldId) {
      setRecordMessage(t("selectFieldFirst"));
      return;
    }
    const depth = Number(recordDepth);
    if (!Number.isFinite(depth) || depth <= 0) {
      setRecordMessage("Enter the depth applied in millimetres.");
      return;
    }
    setRecording(true);
    setRecordMessage(null);
    try {
      const response = await fetch("/api/irrigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: savedFieldId,
          appliedOn: today,
          depthMm: depth,
          note: "Logged from field advisor",
        }),
      });
      if (!response.ok) throw new Error("The irrigation event could not be saved.");
      setRecordMessage(t("recorded"));
      await loadHistory(savedFieldId);
    } catch (error) {
      setRecordMessage(
        error instanceof Error ? error.message : "The irrigation event could not be saved.",
      );
    } finally {
      setRecording(false);
    }
  }

  const summary = useMemo(() => {
    if (!field) return null;
    return {
      area: areaHa.toFixed(areaHa < 10 ? 2 : 1),
      coordinates: `${field.centroid[1].toFixed(4)}, ${field.centroid[0].toFixed(4)}`,
    };
  }, [field, areaHa]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Advisor progress" className="mb-8 overflow-x-auto">
        <ol className="flex min-w-[44rem] items-center gap-2">
          {[t("steps.locate"), t("steps.field"), t("steps.environment"), t("steps.advisory")].map(
            (label, index) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (index < step) setStep(index);
                  }}
                  disabled={index >= step}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-lg border px-3 text-left text-[0.68rem] transition",
                    index === step
                      ? "border-glacier/50 bg-glacier/10 text-glacier"
                      : index < step
                        ? "border-line bg-deep/40 text-cloud/75"
                        : "border-line/50 text-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                      index === step
                        ? "border-glacier/60"
                        : index < step
                          ? "border-mint/50 text-mint"
                          : "border-line",
                    )}
                  >
                    {index < step ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
                {index < 3 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-line" />}
              </li>
            ),
          )}
        </ol>
      </nav>

      {notice && (
        <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-glacier/30 bg-glacier/5 px-4 py-3 text-xs text-cloud/80">
          <span className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 text-glacier" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted hover:text-cloud"
            aria-label="Dismiss"
          >
            Close
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          {step === 0 && (
            <section className="panel p-4 sm:p-6">
              <p className="eyebrow">Step 1 of 4</p>
              <h2 className="display mt-2 text-2xl font-semibold text-cloud sm:text-3xl">
                {t("locateTitle")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{t("locateText")}</p>
              <div className="mt-5">
                <FieldMap
                  key={mapKey}
                  onChange={handleFieldChange}
                  clearToken={clearToken}
                  initialCenter={mapCenter}
                />
              </div>
              {field && summary && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniStat label={t("areaLabel")} value={`${summary.area} ha`} icon={MapPin} />
                  <MiniStat label={t("coordinates")} value={summary.coordinates} icon={Gauge} />
                  <MiniStat
                    label="Drawing"
                    value={field.kind === "polygon" ? "Boundary" : "Point"}
                    icon={MapPin}
                  />
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="panel p-4 sm:p-6">
              <p className="eyebrow">Step 2 of 4</p>
              <h2 className="display mt-2 text-2xl font-semibold text-cloud sm:text-3xl">
                {t("fieldTitle")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{t("fieldText")}</p>

              <div className="mt-6">
                <p className="mb-2 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted">
                  {t("crop")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {CROPS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setCrop(item.key)}
                        aria-pressed={crop === item.key}
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          crop === item.key
                            ? "border-glacier/55 bg-glacier/10"
                            : "border-line bg-deep/35 hover:border-glacier/30",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            crop === item.key ? "text-glacier" : "text-muted",
                          )}
                        />
                        <span className="mt-2 block text-sm font-medium text-cloud">{item.name}</span>
                        <span className="mt-0.5 block text-[0.62rem] leading-relaxed text-muted">
                          {item.note}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label={t("fieldName")}>
                  <input
                    value={fieldName}
                    onChange={(event) => setFieldName(event.target.value)}
                    className="field"
                    placeholder={t("fieldNamePlaceholder")}
                    maxLength={80}
                  />
                </Field>
                <Field label={`${t("sowingDate")} *`}>
                  <input
                    type="date"
                    value={sowingDate}
                    max={today}
                    onChange={(event) => setSowingDate(event.target.value)}
                    className="field"
                  />
                </Field>
                <Field label={`${t("areaLabel")} (ha)`}>
                  <input
                    type="number"
                    value={areaHa}
                    min={0.01}
                    max={5000}
                    step={0.01}
                    onChange={(event) => setAreaHa(Number(event.target.value))}
                    className="field"
                  />
                </Field>
                <Field label={t("soil")}>
                  <select
                    value={soil}
                    onChange={(event) => setSoil(event.target.value as SoilKey)}
                    className="field"
                  >
                    {SOILS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("irrigationMethod")}>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as MethodKey)}
                    className="field"
                  >
                    {METHODS.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Previous root-zone depletion (mm)" hint="Optional. Improves confidence.">
                  <input
                    type="number"
                    value={previousDepletion}
                    min={0}
                    max={2000}
                    step={1}
                    onChange={(event) => setPreviousDepletion(event.target.value)}
                    className="field"
                    placeholder="Unknown"
                  />
                </Field>
              </div>

              <div className="mt-4 rounded-xl border border-amber/25 bg-amber/5 px-3 py-2.5 text-[0.68rem] leading-relaxed text-amber/90">
                {t("demo")}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="panel p-4 sm:p-6">
              <p className="eyebrow">Step 3 of 4</p>
              <h2 className="display mt-2 text-2xl font-semibold text-cloud sm:text-3xl">
                {t("environmentTitle")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                {t("environmentText")}
              </p>

              {loading && <AnalysisSkeleton />}

              {!loading && analysisError && (
                <div className="mt-6 rounded-xl border border-coral/35 bg-coral/8 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-coral">
                    <AlertTriangle className="h-4 w-4" /> {t("analysisFailed")}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-cloud/75">{analysisError}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void runAnalysis()} className="btn-primary text-xs">
                      Try again
                    </button>
                    <button type="button" onClick={() => setStep(1)} className="btn-ghost text-xs">
                      Back to field details
                    </button>
                  </div>
                </div>
              )}

              {!loading && analysis && (
                <>
                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    <WeatherCard weather={analysis.weather} />
                    <SatelliteCard satellite={analysis.satellite} />
                  </div>

                  <div className="mt-5 rounded-xl border border-line bg-midnight/40 p-4 text-[0.68rem] leading-relaxed text-muted">
                    {t("satelliteNote")}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-5">
                    <button type="button" onClick={() => setStep(1)} className="btn-ghost text-xs">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void runAnalysis()} className="btn-ghost text-xs">
                        <Eraser className="h-3.5 w-3.5" /> Refresh environment
                      </button>
                      <button type="button" onClick={() => setStep(3)} className="btn-primary text-xs">
                        {t("getAdvisory")} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {step === 3 && analysis && (
            <AdvisoryView
              analysis={analysis}
              fieldName={fieldName}
              savedFieldId={savedFieldId}
              saving={saving}
              saveMessage={saveMessage}
              recordDepth={recordDepth}
              recording={recording}
              recordMessage={recordMessage}
              history={history}
              onSave={() => void saveField()}
              onRecordDepth={setRecordDepth}
              onRecord={() => void recordIrrigation()}
              onBack={() => setStep(2)}
              onRerun={() => void runAnalysis()}
            />
          )}
        </main>

        <aside className="space-y-4">
          <div className="panel p-4">
            <p className="eyebrow">Field summary</p>
            {field || savedFieldId ? (
              <dl className="mt-4 space-y-2.5 text-xs">
                <SummaryRow label="Field" value={fieldName || "Unnamed field"} />
                <SummaryRow label="Crop" value={cropName} />
                <SummaryRow label="Area" value={`${formatNumber(areaHa, 2)} ha`} />
                <SummaryRow label="Sowing" value={sowingDate ? formatDate(sowingDate) : "—"} />
                <SummaryRow label="Soil" value={SOILS.find((item) => item.key === soil)?.name ?? soil} />
                <SummaryRow label="Method" value={METHODS.find((item) => item.key === method)?.name ?? method} />
                {field && (
                  <SummaryRow
                    label="Center"
                    value={`${field.centroid[1].toFixed(4)}, ${field.centroid[0].toFixed(4)}`}
                  />
                )}
                {savedFieldId && <SummaryRow label="Record" value="Saved to history" />}
              </dl>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Locate your field to start. Nothing is saved until you choose to save it.
              </p>
            )}
            <Link href="/methods" className="mt-4 inline-flex text-[0.68rem] text-glacier hover:underline">
              How the model works
            </Link>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">{t("myFields")}</p>
              <span className="font-mono text-[0.6rem] text-muted">{savedFields.length}</span>
            </div>
            {savedFields.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-muted">{t("noFields")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line/50">
                {savedFields.map((saved) => (
                  <li key={saved.id} className="flex items-start justify-between gap-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => void openSaved(saved.id)}
                      className="min-w-0 text-left"
                    >
                      <span className="block truncate text-xs text-cloud/85">{saved.name}</span>
                      <span className="mt-0.5 block text-[0.6rem] uppercase tracking-[0.06em] text-muted">
                        {saved.crop} · {formatNumber(saved.areaHa, 2)} ha ·{" "}
                        {formatDate(saved.sowingDate)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSaved(saved.id)}
                      className="mt-0.5 text-muted hover:text-coral"
                      aria-label={t("deleteField")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel p-4">
            <p className="eyebrow">What this advisor is</p>
            <ul className="mt-3 space-y-2 text-[0.68rem] leading-relaxed text-muted">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint" /> Live Open-Meteo forecast
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint" /> Sentinel-2 NDVI context
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint" /> FAO-56 water balance
              </li>
              <li className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber" /> Not a substitute for
                local agronomic advice
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {step < 2 && (
        <div className="mx-auto mt-6 flex max-w-[1500px] flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-5">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
            className="btn-ghost text-xs disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {formError && (
              <span className="text-[0.68rem] text-coral" role="alert">
                {formError}
              </span>
            )}
            <button type="button" onClick={next} className="btn-primary text-xs">
              {step === 0 ? "Continue to field details" : "Analyse field"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdvisoryView({
  analysis,
  fieldName,
  savedFieldId,
  saving,
  saveMessage,
  recordDepth,
  recording,
  recordMessage,
  history,
  onSave,
  onRecordDepth,
  onRecord,
  onBack,
  onRerun,
}: {
  analysis: AdvisorResponse;
  fieldName: string;
  savedFieldId: string | null;
  saving: boolean;
  saveMessage: string | null;
  recordDepth: string;
  recording: boolean;
  recordMessage: string | null;
  history: HistoryRow[];
  onSave: () => void;
  onRecordDepth: (value: string) => void;
  onRecord: () => void;
  onBack: () => void;
  onRerun: () => void;
}) {
  const t = useTranslations("Advisor");
  const { advisory, weather, satellite } = analysis;
  const unavailable = advisory.status !== "ok";

  function shareTelegram() {
    const summary = `${t("shareText")} — ${fieldName || "field"}: ${advisory.decisionLabel}. ${
      advisory.grossIrrigationMm
        ? `Gross application ${formatNumber(advisory.grossIrrigationMm, 1)} mm.`
        : ""
    }`;
    const url = typeof window === "undefined" ? "" : window.location.href;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(summary)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function listen() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const text = `${advisory.decisionLabel}. ${advisory.reasonCodes.map((code) => REASONS[code]).filter(Boolean).join(" ")} ${
      advisory.grossIrrigationMm
        ? `Apply about ${Math.round(advisory.grossIrrigationMm)} millimetres gross.`
        : ""
    }`;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="space-y-5">
      <div className={cn("rounded-2xl border p-5 sm:p-7", DECISION_STYLES[advisory.decision])}>
        <p className="eyebrow">Step 4 of 4 · {t("advisoryTitle")}</p>
        <h2
          className={cn(
            "display mt-3 text-[clamp(2rem,5vw,3.8rem)] font-semibold leading-[1.05]",
            decisionColor(advisory.decision),
          )}
        >
          {advisory.decisionLabel}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cloud/80">
          {advisory.reasonCodes.map((code) => REASONS[code]).filter(Boolean).join(" ")}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <HeroMetric
            label={t("netIrrigation")}
            value={`${formatNumber(advisory.netIrrigationMm ?? 0, 1)} mm`}
          />
          <HeroMetric
            label={t("grossIrrigation")}
            value={`${formatNumber(advisory.grossIrrigationMm ?? 0, 1)} mm`}
          />
          <HeroMetric
            label={t("volume")}
            value={formatVolume(advisory.volumeLitres ?? 0)}
          />
        </div>

        {!unavailable && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onSave} disabled={saving || Boolean(savedFieldId)} className="btn-primary text-xs disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {savedFieldId ? "Field saved" : saving ? t("savingField") : t("saveField")}
            </button>
            <button type="button" onClick={listen} className="btn-ghost text-xs">
              <Volume2 className="h-3.5 w-3.5" /> {t("listen")}
            </button>
            <button type="button" onClick={shareTelegram} className="btn-ghost text-xs">
              <Share2 className="h-3.5 w-3.5" /> {t("shareTelegram")}
            </button>
            <button type="button" onClick={() => window.print()} className="btn-ghost text-xs">
              <Printer className="h-3.5 w-3.5" /> {t("print")}
            </button>
          </div>
        )}
        {saveMessage && (
          <p className="mt-3 text-[0.68rem] text-cloud/75" role="status">
            {saveMessage}
          </p>
        )}
      </div>

      {unavailable && (
        <div className="panel p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-coral">
            <AlertTriangle className="h-4 w-4" /> {t("unavailableExplain")}
          </p>
          <p className="mt-2 text-xs text-muted">{advisory.reason}</p>
        </div>
      )}

      {!unavailable && (
        <>
          <div className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{t("waterBalance")}</p>
                <h3 className="display mt-1 text-xl font-semibold text-cloud">{t("whyTitle")}</h3>
              </div>
              <span className="chip">FAO-56 · {advisory.modelVersion}</span>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">{t("whyText")}</p>

            <div className="mt-5">
              <DepletionMeter
                depletion={advisory.todayDepletionMm ?? advisory.depletionMm ?? 0}
                raw={advisory.rawMm ?? 0}
                taw={advisory.tawMm ?? 0}
              />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label={t("etc")} value={`${formatNumber(advisory.etcMm, 2)} mm`} note={`ET₀ ${formatNumber(advisory.et0Mm, 2)} mm`} />
              <Metric label={t("kc")} value={formatNumber(advisory.kcAdjusted ?? advisory.kc, 2)} note={`Base Kc ${formatNumber(advisory.kc, 2)}`} />
              <Metric label={t("effectiveRain")} value={`${formatNumber(advisory.effectiveRainMm, 2)} mm`} note={`7-day rain ${formatNumber(advisory.forecastRain7dMm, 1)} mm`} />
              <Metric label={t("depletion")} value={`${formatNumber(advisory.todayDepletionMm ?? advisory.depletionMm, 1)} mm`} note={`of ${formatNumber(advisory.tawMm, 0)} mm TAW`} />
              <Metric label={t("raw")} value={`${formatNumber(advisory.rawMm, 1)} mm`} note="Stress threshold" />
              <Metric label={t("taw")} value={`${formatNumber(advisory.tawMm, 1)} mm`} note={`Root depth ${formatNumber(advisory.rootDepthM, 2)} m`} />
              <Metric label={t("efficiency")} value={formatPercent((advisory.irrigationEfficiency ?? 0) * 100, 0)} note={METHODS.find((item) => item.key === analysis.input.irrigationMethod)?.name} />
              <Metric label={t("confidence")} value={formatPercent((advisory.confidence ?? 0) * 100, 0)} note={satellite.status === "ok" ? "Satellite context used" : "Satellite context unavailable"} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.65rem] text-muted">
              <span>{t("crop")}: <strong className="text-cloud/80">{advisory.cropName ?? analysis.input.crop}</strong></span>
              <span>{t("stage")}: <strong className="text-cloud/80">{advisory.growthStage ?? "—"}</strong></span>
              <span>{t("daysAfterSowing")}: <strong className="text-cloud/80">{advisory.daysAfterSowing ?? "—"}</strong></span>
              <span>{t("assessmentDate")}: <strong className="text-cloud/80">{formatDate(advisory.assessmentDate)}</strong></span>
              <span>{t("nextAssessment")}: <strong className="text-cloud/80">{formatDate(advisory.nextAssessmentDate)}</strong></span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3">
                <h3 className="display text-sm font-semibold text-cloud">{t("forecast7")}</h3>
                <span className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-muted">
                  Open-Meteo
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[0.68rem]">
                  <thead className="text-muted">
                    <tr className="border-b border-line/50">
                      <th className="px-4 py-2 font-normal">{t("date")}</th>
                      <th className="px-2 py-2 text-right font-normal">{t("et0Mm")}</th>
                      <th className="px-2 py-2 text-right font-normal">{t("rainMm")}</th>
                      <th className="px-2 py-2 text-right font-normal">{t("effectiveRain")}</th>
                      <th className="px-2 py-2 text-right font-normal">{t("etcMm")}</th>
                      <th className="px-4 py-2 text-right font-normal">{t("depletionMm")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(advisory.daily ?? []).slice(0, 7).map((day) => (
                      <tr key={day.date} className="border-b border-line/35 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 text-cloud/80">{formatDate(day.date)}</td>
                        <td className="px-2 py-2 text-right text-cloud/70">{formatNumber(day.et0Mm, 1)}</td>
                        <td className="px-2 py-2 text-right text-glacier/80">{formatNumber(day.rainMm, 1)}</td>
                        <td className="px-2 py-2 text-right text-muted">{formatNumber(day.effectiveRainMm, 1)}</td>
                        <td className="px-2 py-2 text-right text-amber/80">{formatNumber(day.etcMm, 1)}</td>
                        <td className="px-4 py-2 text-right font-medium text-cloud/85">{formatNumber(day.depletionMm, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">{t("satellite")}</p>
                  <Satellite className="h-3.5 w-3.5 text-muted" />
                </div>
                {satellite.status === "ok" && satellite.ndvi ? (
                  <dl className="mt-3 space-y-2 text-xs">
                    <SummaryRow label={t("ndvi")} value={formatNumber(satellite.ndvi.mean, 3)} />
                    <SummaryRow label={t("validPixels")} value={formatPercent((satellite.ndvi.validFraction ?? 0) * 100, 0)} />
                    <SummaryRow label={t("sceneDate")} value={formatDate(satellite.scene?.datetime)} />
                    <SummaryRow label={t("cloudCover")} value={formatPercent(satellite.scene?.cloudCover, 0)} />
                  </dl>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {satellite.notice ?? satellite.reason ?? t("noScene")}
                  </p>
                )}
              </div>
              <div className="panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">Live weather now</p>
                  <CloudRain className="h-3.5 w-3.5 text-muted" />
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <SummaryRow label={t("temperature")} value={`${formatNumber(weather.current?.temperatureC, 1)} °C`} />
                  <SummaryRow label="Humidity" value={`${formatNumber(weather.current?.humidityPct, 0)} %`} />
                  <SummaryRow label="Wind" value={`${formatNumber(weather.current?.windKmh, 1)} km/h`} />
                  <SummaryRow label={t("rain")} value={formatPercent(advisory.forecastRain7dMm, 0)} />
                </dl>
              </div>
            </div>
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">{t("recordIrrigation")}</p>
                <p className="mt-1 text-xs text-muted">
                  {savedFieldId ? t("recorded") : t("selectFieldFirst")}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <label className="text-[0.6rem] text-muted">
                  {t("irrigationDepth")}
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={recordDepth}
                    onChange={(event) => onRecordDepth(event.target.value)}
                    className="field mt-1 min-h-10 w-28"
                  />
                </label>
                <button
                  type="button"
                  onClick={onRecord}
                  disabled={!savedFieldId || recording}
                  className="btn-ghost min-h-10 text-xs disabled:opacity-40"
                >
                  {recording ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Droplets className="h-3.5 w-3.5" />}
                  {t("record")}
                </button>
              </div>
            </div>
            {recordMessage && (
              <p className="mt-2 text-[0.68rem] text-mint" role="status">
                {recordMessage}
              </p>
            )}
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">{t("history")}</p>
              <span className="font-mono text-[0.6rem] text-muted">{history.length}</span>
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-xs text-muted">{t("noHistory")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line/50">
                {history.slice(0, 6).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-xs text-cloud/80">
                        {row.result?.decisionLabel ?? row.decision.replaceAll("_", " ").toLowerCase()}
                      </p>
                      <p className="mt-0.5 text-[0.6rem] uppercase tracking-[0.06em] text-muted">
                        {formatDate(row.assessmentDate)} · saved {formatDate(row.createdAt)}
                      </p>
                    </div>
                    {row.result?.grossIrrigationMm ? (
                      <span className="font-mono text-[0.65rem] text-amber/80">
                        {formatNumber(row.result.grossIrrigationMm, 1)} mm gross
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
            <button type="button" onClick={onBack} className="btn-ghost text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("environmentTitle")}
            </button>
            <button type="button" onClick={onRerun} className="btn-ghost text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> Re-run advisory
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function WeatherCard({ weather }: { weather: WeatherResult }) {
  const t = useTranslations("Advisor");
  const days = (weather.daily ?? []).slice(0, 7);
  const maxRain = Math.max(1, ...days.map((day) => day.rainMm));
  const totalRain = days.reduce((sum, day) => sum + day.rainMm, 0);
  const totalEt0 = days.reduce((sum, day) => sum + day.et0Mm, 0);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{t("weather")}</p>
        <CloudRain className="h-3.5 w-3.5 text-glacier" />
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="display text-3xl font-semibold text-cloud">
            {formatNumber(weather.current?.temperatureC, 1)}°
          </p>
          <p className="mt-1 text-[0.65rem] text-muted">
            {formatNumber(weather.current?.humidityPct, 0)}% humidity ·{" "}
            {formatNumber(weather.current?.windKmh, 1)} km/h
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">
            Next 7 days
          </p>
          <p className="mt-1 text-xs text-glacier">{formatNumber(totalRain, 1)} mm rain</p>
          <p className="text-xs text-amber">{formatNumber(totalEt0, 1)} mm ET₀</p>
        </div>
      </div>
      <div className="mt-4 flex h-16 items-end gap-1">
        {days.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-glacier/45"
              style={{ height: `${Math.max(3, (day.rainMm / maxRain) * 48)}px` }}
              title={`${day.date}: ${formatNumber(day.rainMm, 1)} mm`}
            />
            <span className="font-mono text-[0.45rem] text-muted">
              {new Date(day.date).toLocaleDateString("en-IN", { weekday: "narrow" })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[0.58rem] text-muted">
        <span>Open-Meteo · {weather.timezone ?? "local time"}</span>
        <span>Elev. {formatNumber(weather.elevationM, 0)} m</span>
      </div>
    </div>
  );
}

function SatelliteCard({ satellite }: { satellite: SatelliteResult }) {
  const t = useTranslations("Advisor");
  const ndvi = satellite.ndvi?.mean;
  const tone = ndvi === null || ndvi === undefined ? "text-muted" : ndvi > 0.5 ? "text-mint" : ndvi > 0.3 ? "text-amber" : "text-coral";

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{t("satellite")}</p>
        <Satellite className="h-3.5 w-3.5 text-glacier" />
      </div>
      {satellite.status === "ok" && satellite.ndvi ? (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className={cn("display text-3xl font-semibold", tone)}>
                {formatNumber(ndvi, 3)}
              </p>
              <p className="mt-1 text-[0.65rem] text-muted">
                {t("ndvi")} · {formatPercent((satellite.ndvi.validFraction ?? 0) * 100, 0)} {t("validPixels")}
              </p>
            </div>
            <span className="chip">Sentinel-2 L2A</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-deep">
            <div
              className={cn("h-full rounded-full", ndvi && ndvi > 0.5 ? "bg-mint" : ndvi && ndvi > 0.3 ? "bg-amber" : "bg-coral")}
              style={{ width: `${Math.min(100, Math.max(2, ((ndvi ?? 0) / 1) * 100))}%` }}
            />
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <SummaryRow label={t("sceneDate")} value={formatDate(satellite.scene?.datetime)} />
            <SummaryRow label={t("cloudCover")} value={formatPercent(satellite.scene?.cloudCover, 0)} />
            <SummaryRow label="Platform" value={satellite.scene?.platform ?? "—"} />
          </dl>
          {satellite.notice && (
            <p className="mt-3 border-t border-line/50 pt-2 text-[0.6rem] leading-relaxed text-amber/80">
              {satellite.notice}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-xs text-amber">
            <AlertTriangle className="h-3.5 w-3.5" /> {t("noScene")}
          </p>
          <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">
            {satellite.notice ?? satellite.reason}
          </p>
          <p className="mt-3 text-[0.6rem] leading-relaxed text-muted">
            The advisory does not substitute a guessed NDVI. The FAO-56 balance still runs from the
            forecast, and confidence is reduced.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      {[0, 1].map((item) => (
        <div key={item} className="panel animate-pulse p-4">
          <div className="h-3 w-24 rounded bg-line/70" />
          <div className="mt-4 h-10 w-32 rounded bg-line/50" />
          <div className="mt-4 h-16 rounded bg-line/40" />
          <div className="mt-3 space-y-2">
            <div className="h-2.5 rounded bg-line/40" />
            <div className="h-2.5 w-3/4 rounded bg-line/40" />
          </div>
        </div>
      ))}
      <p className="flex items-center gap-2 text-xs text-muted xl:col-span-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-glacier" />
        Fetching live weather and the latest usable Sentinel-2 scene. This can take up to a minute.
      </p>
    </div>
  );
}

function DepletionMeter({
  depletion,
  raw,
  taw,
}: {
  depletion: number;
  raw: number;
  taw: number;
}) {
  const max = Math.max(taw, depletion, 1);
  const depletionPct = Math.min(100, (depletion / max) * 100);
  const rawPct = Math.min(100, (raw / max) * 100);
  const tone = depletion >= raw ? "bg-coral" : depletion >= raw * 0.75 ? "bg-amber" : "bg-mint";

  return (
    <div>
      <div className="relative h-4 overflow-hidden rounded-full bg-deep">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${depletionPct}%` }} />
        <div
          className="absolute top-0 h-full w-0.5 bg-amber"
          style={{ left: `${rawPct}%` }}
          title={`RAW ${formatNumber(raw, 1)} mm`}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[0.55rem] uppercase tracking-[0.06em] text-muted">
        <span>0 mm</span>
        <span className="text-amber">RAW {formatNumber(raw, 0)} mm</span>
        <span>TAW {formatNumber(taw, 0)} mm</span>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof MapPin;
}) {
  return (
    <div className="rounded-lg border border-line bg-deep/35 px-3 py-2">
      <p className="flex items-center gap-1.5 font-mono text-[0.52rem] uppercase tracking-[0.08em] text-muted">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-xs text-cloud/85">{value}</p>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/70 bg-midnight/45 px-3 py-2.5">
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-cloud">{value}</p>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line/70 bg-deep/25 px-3 py-2.5">
      <p className="font-mono text-[0.52rem] uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-cloud/90">{value}</p>
      {note && <p className="mt-0.5 text-[0.55rem] text-muted/80">{note}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-cloud/85">{value ?? "—"}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 font-mono text-[0.55rem] uppercase tracking-[0.08em] text-muted">
        {label}
        {hint && <span className="normal-case tracking-normal text-muted/60">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function decisionColor(decision: string) {
  switch (decision) {
    case "IRRIGATE_NOW":
      return "text-coral";
    case "IRRIGATE_IN_DAYS":
      return "text-amber";
    case "WAIT_FOR_RAIN":
      return "text-glacier";
    case "NO_IRRIGATION":
      return "text-mint";
    default:
      return "text-muted";
  }
}

function formatVolume(litres: number) {
  if (!litres || litres <= 0) return "0 L";
  if (litres >= 1_000_000) {
    return `${(litres / 1_000_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} million L`;
  }
  if (litres >= 1000) {
    return `${(litres / 1000).toLocaleString("en-IN", { maximumFractionDigits: 0 })} m³`;
  }
  return `${Math.round(litres).toLocaleString("en-IN")} L`;
}
