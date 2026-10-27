"use client";
import { useEffect, useMemo, useState } from "react";
import { useJson } from "@/lib/client/useJson";
import { formatLatLon, nearestDistrict, nextImagingPass, subPoint, type Tle } from "@/lib/client/orbit";
import type { DistrictLite } from "@/lib/client/district";
import type { LiveState } from "./FieldNote";

export type Summary = {
  district: { id: string; name: string; state: string; lat: number; lon: number };
  stress: { stressIndex0100: number | null; rankNational: number | null; rankState: number | null; total: number; stateTotal: number; rainPeriod: string | null; gwYear: number | null; componentsUsed: number } | null;
  monsoon: { latest: { year: number; departurePct: number | null } | null; last30: { year: number; departurePct: number | null }[]; normalPeriod: string };
  groundwater: { year: number; medianDepthMbgl: number | null; changeVsBaselineM: number | null; wellCount: number } | null;
  ndvi: { month: string; ndviMedian: number | null; validPixelPct: number | null } | null;
};

function toLive<T, R>(s: { data: T | null; error: string | null; loading: boolean }, pick: (d: T) => R | null, none?: string): LiveState<R> {
  if (s.loading) return { status: "loading" };
  if (s.error || !s.data) return { status: "error", message: s.error ?? undefined };
  const v = pick(s.data);
  if (v === null || v === undefined) return none ? { status: "none", note: none } : { status: "error" };
  return { status: "ok", value: v };
}

/** All live numbers for the journey, for the chosen district. `stage` gates lazy loading of later acts. */
export function useJourneyLive(district: DistrictLite | null, districtId: string, districts: DistrictLite[], stage: number, notes: { ndvi: string; none: string }) {
  const summary = useJson<Summary>(districtId ? `/api/atlas/district/${districtId}` : null);
  const lat = district?.lat ?? summary.data?.district.lat;
  const lon = district?.lon ?? summary.data?.district.lon;
  const et0 = useJson<{ et0: number; date: string }>(stage >= 1 && lat !== undefined ? `/api/live/et0?lat=${lat}&lon=${lon}` : null);
  const tle = useJson<Tle>("/api/live/sentinel");

  // Sentinel-2A sub-point, refreshed every 10 s
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const position: LiveState<string> = useMemo(() => {
    if (tle.loading) return { status: "loading" };
    if (!tle.data) return { status: "error" };
    const p = subPoint(tle.data, new Date(now));
    if (!p) return { status: "error" };
    const near = nearestDistrict(districts, p.lat, p.lon, 60);
    return { status: "ok", value: near ? `${near.name}, ${near.state}` : formatLatLon(p.lat, p.lon) };
  }, [tle.data, tle.loading, now, districts]);

  const nextPass: LiveState<Date | null> = useMemo(() => {
    if (tle.loading || lat === undefined) return { status: "loading" };
    if (!tle.data) return { status: "error" };
    return { status: "ok", value: nextImagingPass(tle.data, lat, lon!, new Date()) };
  }, [tle.data, tle.loading, lat, lon]);

  return {
    summary,
    position,
    nextPass,
    retryTle: tle.retry,
    et0: toLive(et0, (d) => d.et0),
    retryEt0: et0.retry,
    monsoon: toLive(summary, (d) => (d.monsoon.latest ? { latest: d.monsoon.latest, last30: d.monsoon.last30 } : null), notes.none),
    stress: toLive(summary, (d) => (d.stress && d.stress.stressIndex0100 !== null ? d.stress : null), notes.none),
    ndvi: toLive(summary, (d) => (d.ndvi ? d.ndvi : null), notes.ndvi),
    gw: toLive(summary, (d) => d.groundwater, notes.none),
  };
}
