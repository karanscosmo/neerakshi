"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { cn, formatNumber, formatPercent, STRESS_COLORS } from "@/lib/utils";

export interface TableDistrict {
  id: string;
  name: string;
  state: string;
  areaKm2: number | null;
  stressIndex: number | null;
  stressClass: string;
  departurePct: number | null;
  departure5yPct: number | null;
  groundwaterDepth: number | null;
  irrigatedShare: number | null;
}

type SortKey =
  | "name"
  | "state"
  | "stressIndex"
  | "departurePct"
  | "groundwaterDepth"
  | "irrigatedShare";

const PAGE_SIZE = 40;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "District" },
  { key: "state", label: "State / UT" },
  { key: "stressIndex", label: "Stress", align: "right" },
  { key: "departurePct", label: "Monsoon departure", align: "right" },
  { key: "groundwaterDepth", label: "Groundwater", align: "right" },
  { key: "irrigatedShare", label: "Irrigated", align: "right" },
];

export function DistrictTable({ districts }: { districts: TableDistrict[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [stressClass, setStressClass] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("stressIndex");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const states = useMemo(
    () => Array.from(new Set(districts.map((district) => district.state))).sort(),
    [districts],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = districts.filter((district) => {
      if (state !== "all" && district.state !== state) return false;
      if (stressClass !== "all" && district.stressClass !== stressClass) return false;
      if (
        term &&
        !district.name.toLowerCase().includes(term) &&
        !district.state.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
    return rows.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === "string" || typeof right === "string") {
        return String(left ?? "").localeCompare(String(right ?? "")) * (sortAsc ? 1 : -1);
      }
      const l = left ?? -Infinity;
      const r = right ?? -Infinity;
      return (Number(l) - Number(r)) * (sortAsc ? 1 : -1);
    });
  }, [districts, query, state, stressClass, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((value) => !value);
    } else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "state");
    }
    setPage(0);
  }

  function download() {
    const header = [
      "district_id",
      "district_name",
      "state",
      "area_km2",
      "stress_index",
      "stress_class",
      "monsoon_departure_pct",
      "departure_5y_pct",
      "groundwater_depth_m",
      "irrigated_share_pct",
      "rainfall_provenance",
      "groundwater_provenance",
      "irrigation_provenance",
    ];
    const lines = filtered.map((district) =>
      [
        district.id,
        district.name,
        district.state,
        district.areaKm2 ?? "",
        district.stressIndex?.toFixed(2) ?? "",
        district.stressClass,
        district.departurePct?.toFixed(2) ?? "",
        district.departure5yPct?.toFixed(2) ?? "",
        district.groundwaterDepth?.toFixed(2) ?? "",
        district.irrigatedShare?.toFixed(2) ?? "",
        "reanalysis",
        "demo_fixture",
        "demo_fixture",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "neerakshi-districts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[13rem] flex-1">
          <span className="sr-only">Search districts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search 735 districts"
            className="field min-h-11 pl-9"
          />
        </label>
        <label className="min-w-[10rem]">
          <span className="sr-only">Filter by state</span>
          <select
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(0);
            }}
            className="field min-h-11"
          >
            <option value="all">All states and UTs</option>
            {states.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[9rem]">
          <span className="sr-only">Filter by stress class</span>
          <select
            value={stressClass}
            onChange={(event) => {
              setStressClass(event.target.value);
              setPage(0);
            }}
            className="field min-h-11"
          >
            <option value="all">All classes</option>
            {["Low", "Moderate", "High", "Severe"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={download} className="btn-ghost min-h-11 text-xs">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line/70">
        <table className="data-table">
          <caption className="sr-only">
            District water stress table, sortable and filterable. Values include reanalysis
            rainfall and demo fixtures.
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.align === "right" ? "text-right" : undefined}
                    aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1 uppercase tracking-[0.1em]",
                        active ? "text-glacier" : "text-muted hover:text-cloud",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {column.label}
                      {active &&
                        (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                );
              })}
              <th scope="col">Class</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((district) => (
              <tr key={district.id}>
                <td className="text-cloud/90">{district.name}</td>
                <td className="text-muted">{district.state}</td>
                <td className="mono text-right text-cloud">
                  {district.stressIndex?.toFixed(1) ?? "—"}
                </td>
                <td className="mono text-right">
                  <span
                    className={cn(
                      district.departurePct !== null && district.departurePct < 0
                        ? "text-coral"
                        : "text-mint",
                    )}
                  >
                    {formatPercent(district.departurePct, 1)}
                  </span>
                </td>
                <td className="mono text-right text-muted">
                  {district.groundwaterDepth !== null
                    ? `${district.groundwaterDepth.toFixed(1)} m`
                    : "—"}
                </td>
                <td className="mono text-right text-muted">
                  {district.irrigatedShare !== null
                    ? `${district.irrigatedShare.toFixed(0)}%`
                    : "—"}
                </td>
                <td>
                  <span
                    className="inline-flex rounded-md px-1.5 py-0.5 font-mono text-[0.52rem] uppercase tracking-[0.08em]"
                    style={{
                      color: STRESS_COLORS[district.stressClass],
                      backgroundColor: `${STRESS_COLORS[district.stressClass] ?? "#8CA8B5"}18`,
                    }}
                  >
                    {district.stressClass}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No districts match these filters.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.65rem] text-muted">
          {formatNumber(filtered.length)} districts · showing{" "}
          {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
          {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} · groundwater and
          irrigation values are demo fixtures
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={safePage === 0}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="mono min-w-[4.5rem] text-center text-[0.65rem] text-muted">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
            disabled={safePage >= totalPages - 1}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-muted disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
