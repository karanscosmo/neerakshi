"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { store, useJson } from "./useJson";

export const DEFAULT_DISTRICT = "d573"; // Mandya, Karnataka — see docs/DECISIONS.md
export type DistrictLite = { id: string; name: string; state: string; stateCode: string; lat: number; lon: number };

type Ctx = {
  districts: DistrictLite[];
  districtsLoading: boolean;
  districtId: string;
  district: DistrictLite | null;
  isDefault: boolean;
  setDistrict: (id: string) => void;
  locate: () => Promise<"ok" | "denied" | "outside" | "error">;
};

const DistrictCtx = createContext<Ctx | null>(null);
const KEY = "nk_district";

export function DistrictProvider({ children }: { children: ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading } = useJson<{ districts: DistrictLite[] }>("/api/atlas/districts");
  const urlD = sp.get("d");
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => setStored(store.get(KEY)), []);
  const districtId = urlD || stored || DEFAULT_DISTRICT;
  const districts = useMemo(() => data?.districts ?? [], [data]);
  const district = useMemo(() => districts.find((d) => d.id === districtId) ?? null, [districts, districtId]);

  const setDistrict = useCallback(
    (id: string) => {
      store.set(KEY, id);
      setStored(id);
      const q = new URLSearchParams(sp.toString());
      q.set("d", id);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  const locate = useCallback(async () => {
    if (!("geolocation" in navigator)) return "error" as const;
    const pos = await new Promise<GeolocationPosition | null>((res) =>
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 }),
    );
    if (!pos) return "denied" as const;
    const r = await fetch(`/api/atlas/district-at?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`).catch(() => null);
    if (!r) return "error" as const;
    if (r.status === 404) return "outside" as const;
    if (!r.ok) return "error" as const;
    const j = (await r.json()) as { district: { id: string } };
    setDistrict(j.district.id);
    return "ok" as const;
  }, [setDistrict]);

  const value = useMemo<Ctx>(
    () => ({ districts, districtsLoading: loading, districtId, district, isDefault: !urlD && !stored, setDistrict, locate }),
    [districts, loading, districtId, district, urlD, stored, setDistrict, locate],
  );
  return <DistrictCtx.Provider value={value}>{children}</DistrictCtx.Provider>;
}

export function useDistrict(): Ctx {
  const c = useContext(DistrictCtx);
  if (!c) throw new Error("useDistrict must be used inside DistrictProvider");
  return c;
}

/** Keep shared filters (district, crop, years, state) when navigating between sections. */
export function useSharedQuery(): string {
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["d", "crop", "y0", "y1", "st"]) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const s = keep.toString();
  return s ? `?${s}` : "";
}
