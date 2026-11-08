"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  DataDrivenPropertyValueSpecification,
  Map as MapLibreMap,
  MapGeoJSONFeature,
} from "maplibre-gl";
import { Crosshair, Layers, Loader2, Search, X } from "lucide-react";
import { cn, formatNumber, formatPercent, STRESS_COLORS } from "@/lib/utils";
import { ProvenanceBadge } from "@/components/shared/ui";

export interface MapDistrict {
  id: string;
  name: string;
  state: string;
  centroid: [number, number];
  stressIndex: number | null;
  stressClass: string;
  rainfallDeparture: number | null;
  groundwaterDepth: number | null;
  irrigatedShare: number | null;
  rainfallYears: Record<string, number | null>;
  groundwaterYear: number | null;
  irrigationYear: number | null;
  rainfallScore: number | null;
  groundwaterScore: number | null;
  irrigationScore: number | null;
  componentsAvailable: number;
}

type LayerKey = "stress" | "rainfall" | "groundwater" | "irrigation" | "ndvi";

const LAYERS: { key: LayerKey; label: string; description: string }[] = [
  { key: "stress", label: "Water stress index", description: "Composite percentile index (project-defined)" },
  { key: "rainfall", label: "Monsoon departure", description: "Monsoon rainfall vs 2015–2024 reanalysis normal" },
  { key: "groundwater", label: "Groundwater depth", description: "Pre-monsoon depth below ground (demo fixture)" },
  { key: "irrigation", label: "Irrigated share", description: "Share of net sown area irrigated (demo fixture)" },
  { key: "ndvi", label: "MODIS vegetation", description: "NASA GIBS 8-day NDVI composite (real satellite product)" },
];

const NDVI_DATE = "2026-11-01";
const NDVI_TILES =
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${NDVI_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;

function displayValue(district: MapDistrict, layer: LayerKey, year: number, compareYear: number | null) {
  switch (layer) {
    case "stress":
      return district.stressIndex;
    case "rainfall":
      if (compareYear !== null) {
        const a = district.rainfallYears[String(year)];
        const b = district.rainfallYears[String(compareYear)];
        return a !== null && a !== undefined && b !== null && b !== undefined ? a - b : null;
      }
      return district.rainfallYears[String(year)] ?? district.rainfallDeparture;
    case "groundwater":
      return district.groundwaterDepth;
    case "irrigation":
      return district.irrigatedShare;
    case "ndvi":
      return null;
  }
}

function colorExpression(
  layer: LayerKey,
  comparing: boolean,
): DataDrivenPropertyValueSpecification<string> {
  if (layer === "stress") {
    return [
      "step",
      ["coalesce", ["get", "display_value"], -1],
      "#3a4a52",
      30,
      STRESS_COLORS.Low,
      55,
      STRESS_COLORS.Moderate,
      75,
      STRESS_COLORS.High,
      90,
      STRESS_COLORS.Severe,
    ];
  }
  if (layer === "rainfall") {
    if (comparing) {
      return [
        "step",
        ["coalesce", ["get", "display_value"], 0],
        "#FF6B65",
        -20,
        "#F2B85B",
        -5,
        "#4b6470",
        5,
        "#8CE5B1",
        20,
        "#48D9E8",
      ];
    }
    return [
      "step",
      ["coalesce", ["get", "display_value"], -999],
      "#3a4a52",
      -50,
      "#FF6B65",
      -25,
      "#FF9F6B",
      0,
      "#F2B85B",
      25,
      "#8CE5B1",
      50,
      "#48D9E8",
    ];
  }
  if (layer === "groundwater") {
    return [
      "step",
      ["coalesce", ["get", "display_value"], -1],
      "#3a4a52",
      5,
      "#8CE5B1",
      10,
      "#48D9E8",
      20,
      "#F2B85B",
      30,
      "#FF6B65",
    ];
  }
  if (layer === "irrigation") {
    return [
      "step",
      ["coalesce", ["get", "display_value"], -1],
      "#3a4a52",
      25,
      "#FF6B65",
      50,
      "#F2B85B",
      75,
      "#8CE5B1",
      90,
      "#48D9E8",
    ];
  }
  return "#8CA8B5";
}

function legendFor(layer: LayerKey, comparing: boolean) {
  if (layer === "stress") {
    return [
      { color: STRESS_COLORS.Low, label: "Low < 30" },
      { color: STRESS_COLORS.Moderate, label: "Moderate 30–55" },
      { color: STRESS_COLORS.High, label: "High 55–75" },
      { color: STRESS_COLORS.Severe, label: "Severe ≥ 75" },
      { color: "#3a4a52", label: "No data" },
    ];
  }
  if (layer === "rainfall") {
    return comparing
      ? [
          { color: "#FF6B65", label: "Drier by > 20 pp" },
          { color: "#F2B85B", label: "Drier by 5–20 pp" },
          { color: "#4b6470", label: "Within ±5 pp" },
          { color: "#8CE5B1", label: "Wetter by 5–20 pp" },
          { color: "#48D9E8", label: "Wetter by > 20 pp" },
        ]
      : [
          { color: "#FF6B65", label: "Deficit < −50%" },
          { color: "#FF9F6B", label: "−50 to −25%" },
          { color: "#F2B85B", label: "−25 to 0%" },
          { color: "#8CE5B1", label: "0 to +25%" },
          { color: "#48D9E8", label: "+25 to +50%" },
          { color: "#3a4a52", label: "No data" },
        ];
  }
  if (layer === "groundwater") {
    return [
      { color: "#8CE5B1", label: "≤ 5 m" },
      { color: "#48D9E8", label: "5–10 m" },
      { color: "#F2B85B", label: "10–20 m" },
      { color: "#FF6B65", label: "> 20 m" },
      { color: "#3a4a52", label: "No data" },
    ];
  }
  if (layer === "irrigation") {
    return [
      { color: "#FF6B65", label: "< 25%" },
      { color: "#F2B85B", label: "25–50%" },
      { color: "#8CE5B1", label: "50–75%" },
      { color: "#48D9E8", label: "≥ 75%" },
      { color: "#3a4a52", label: "No data" },
    ];
  }
  return [
    { color: "#5a3a1f", label: "Low NDVI" },
    { color: "#c2a24a", label: "Moderate" },
    { color: "#4f8a3c", label: "Healthy vegetation" },
  ];
}

export function DistrictMap({
  districts,
  years,
  latestYear,
  defaultLayer = "stress",
  heightClassName = "h-[66vh] min-h-[460px]",
  showPanel = true,
  initialSelectedId = null,
}: {
  districts: MapDistrict[];
  years: number[];
  latestYear: number;
  defaultLayer?: LayerKey;
  heightClassName?: string;
  showPanel?: boolean;
  initialSelectedId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const baseFeatures = useRef<GeoJSON.FeatureCollection | null>(null);
  const loadedRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState<LayerKey>(defaultLayer);
  const [year, setYear] = useState(latestYear);
  const [compareYear, setCompareYear] = useState<number | null>(
    years.length > 1 ? latestYear - 1 : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; feature: MapGeoJSONFeature } | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const districtMap = useMemo(
    () => new Map(districts.map((district) => [district.id, district])),
    [districts],
  );
  const selected = selectedId ? districtMap.get(selectedId) ?? null : null;
  const comparing = layer === "rainfall" && compareYear !== null;

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return districts
      .filter(
        (district) =>
          district.name.toLowerCase().includes(term) || district.state.toLowerCase().includes(term),
      )
      .slice(0, 6);
  }, [districts, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [
                "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
              ],
              tileSize: 256,
              maxzoom: 14,
              attribution:
                "Sentinel-2 cloudless © EOX | Boundaries geoBoundaries (ODbL) | NDVI NASA GIBS",
            },
            ndvi: {
              type: "raster",
              tiles: [NDVI_TILES],
              tileSize: 256,
              maxzoom: 9,
              attribution: "MODIS NDVI 8-day composite · NASA GIBS",
            },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#071521" } },
            {
              id: "satellite",
              type: "raster",
              source: "satellite",
              paint: {
                "raster-opacity": 0.38,
                "raster-saturation": -0.25,
                "raster-brightness-max": 0.72,
                "raster-contrast": 0.1,
              },
            },
            {
              id: "ndvi",
              type: "raster",
              source: "ndvi",
              layout: { visibility: "none" },
              paint: { "raster-opacity": 0.72 },
            },
          ],
        },
        center: [79.2, 22.4],
        zoom: 4.1,
        attributionControl: false,
        maxZoom: 11,
        minZoom: 3,
        renderWorldCopies: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", async () => {
        if (cancelled) return;
        try {
          const response = await fetch("/geo/districts.geojson");
          if (!response.ok) throw new Error("District boundaries could not be loaded.");
          const geojson = (await response.json()) as GeoJSON.FeatureCollection;
          baseFeatures.current = geojson;
          map.addSource("districts", {
            type: "geojson",
            data: geojson,
            promoteId: "id",
          });
          map.addLayer({
            id: "district-fill",
            type: "fill",
            source: "districts",
            paint: {
              "fill-color": colorExpression(layer, comparing),
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                0.9,
                ["boolean", ["feature-state", "hover"], false],
                0.82,
                0.62,
              ],
            },
          });
          map.addLayer({
            id: "district-line",
            type: "line",
            source: "districts",
            paint: {
              "line-color": "rgba(234,244,245,0.28)",
              "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.35, 7, 1.1],
            },
          });
          loadedRef.current = true;
          setReady(true);
          updateData(map);
          if (initialSelectedId) {
            const match = districts.find((district) => district.id === initialSelectedId);
            if (match) {
              setSelectedId(match.id);
              map.jumpTo({ center: match.centroid, zoom: 5.8 });
            }
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "The map could not be initialized.");
        }
      });

      map.on("mousemove", "district-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        map.getCanvas().style.cursor = "pointer";
        const id = String(feature.properties?.id ?? "");
        if (id && hoveredIdRef.current !== id) {
          if (hoveredIdRef.current) {
            map.setFeatureState(
              { source: "districts", id: hoveredIdRef.current },
              { hover: false },
            );
          }
          hoveredIdRef.current = id;
          map.setFeatureState({ source: "districts", id }, { hover: true });
        }
        setHover({
          x: event.point.x,
          y: event.point.y,
          feature,
        });
      });
      map.on("mouseleave", "district-fill", () => {
        if (!mapRef.current) return;
        map.getCanvas().style.cursor = "";
        if (hoveredIdRef.current) {
          map.setFeatureState(
            { source: "districts", id: hoveredIdRef.current },
            { hover: false },
          );
          hoveredIdRef.current = null;
        }
        setHover(null);
      });
      map.on("click", "district-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const id = String(feature.properties?.id ?? "");
        if (!id) return;
        setSelectedId(id);
        setQuery("");
        const match = districts.find((district) => district.id === id);
        if (match) {
          map.flyTo({ center: match.centroid, zoom: Math.max(map.getZoom(), 5.6), duration: 900 });
        }
      });
    })();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateData(map: MapLibreMap) {
    if (!baseFeatures.current) return;
    const features = baseFeatures.current.features.map((feature) => {
      const id = String(feature.properties?.id ?? "");
      const district = districtMap.get(id);
      if (!district) return feature;
      return {
        ...feature,
        id,
        properties: {
          ...feature.properties,
          stress_index: district.stressIndex,
          stress_class: district.stressClass,
          groundwater: district.groundwaterDepth,
          irrigation: district.irrigatedShare,
          display_value: displayValue(district, layer, year, compareYear),
        },
      };
    });
    const source = map.getSource("districts") as
      | { setData: (data: GeoJSON.FeatureCollection) => void }
      | undefined;
    source?.setData({ type: "FeatureCollection", features });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    updateData(map);
    if (map.getLayer("district-fill")) {
      map.setPaintProperty("district-fill", "fill-color", colorExpression(layer, comparing));
    }
    if (map.getLayer("ndvi")) {
      map.setLayoutProperty("ndvi", "visibility", layer === "ndvi" ? "visible" : "none");
    }
    if (map.getLayer("district-fill")) {
      map.setPaintProperty(
        "district-fill",
        "fill-opacity",
        layer === "ndvi"
          ? 0.06
          : [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.9,
              ["boolean", ["feature-state", "hover"], false],
              0.82,
              0.62,
            ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, year, compareYear, districts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    map.setFeatureState({ source: "districts", id: selectedId }, { selected: true });
    return () => {
      if (map.getSource("districts")) {
        map.setFeatureState({ source: "districts", id: selectedId }, { selected: false });
      }
    };
  }, [selectedId]);

  function flyToDistrict(district: MapDistrict) {
    setSelectedId(district.id);
    setQuery("");
    mapRef.current?.flyTo({ center: district.centroid, zoom: 6.2, duration: 900 });
  }

  const legend = legendFor(layer, comparing);
  const hovered = hover
    ? {
        name: String(hover.feature.properties?.name ?? ""),
        state: String(hover.feature.properties?.state ?? ""),
        value: hover.feature.properties?.display_value as number | null,
      }
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map layer">
            {LAYERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setLayer(item.key)}
                aria-pressed={layer === item.key}
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-[0.72rem] transition-colors",
                  layer === item.key
                    ? "border-glacier/50 bg-glacier/12 text-glacier"
                    : "border-line bg-deep-ocean/30 text-muted hover:text-cloud",
                )}
                title={item.description}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {layer === "rainfall" && (
              <label className="flex items-center gap-2 text-[0.65rem] text-muted">
                <span className="font-mono uppercase tracking-[0.12em]">Year</span>
                <select
                  className="min-h-11 rounded-lg border border-line bg-midnight px-2 text-xs text-cloud"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {layer === "rainfall" && (
              <label className="flex items-center gap-2 text-[0.65rem] text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#48D9E8]"
                  checked={compareYear !== null}
                  onChange={(event) =>
                    setCompareYear(event.target.checked ? years[years.length - 2] ?? null : null)
                  }
                />
                Compare
              </label>
            )}
            {comparing && (
              <select
                aria-label="Compare with year"
                className="min-h-11 rounded-lg border border-line bg-midnight px-2 text-xs text-cloud"
                value={compareYear ?? ""}
                onChange={(event) => setCompareYear(Number(event.target.value))}
              >
                {years
                  .filter((item) => item !== year)
                  .map((item) => (
                    <option key={item} value={item}>
                      vs {item}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-line">
          <div ref={containerRef} className={cn("w-full", heightClassName)} role="application" aria-label="Interactive district water intelligence map" />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-midnight/70">
              <span className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading district map
              </span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-midnight/90 px-6 text-center text-sm text-coral">
              {error}
            </div>
          )}

          <div className="absolute left-3 top-3 z-10 w-60">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a district or state"
                aria-label="Find a district or state"
                className="min-h-11 w-full rounded-lg border border-line bg-midnight/90 pl-8 pr-8 text-xs text-cloud placeholder:text-muted/70"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {suggestions.length > 0 && (
                <ul className="mt-1 overflow-hidden rounded-lg border border-line bg-midnight/97 shadow-2xl">
                  {suggestions.map((district) => (
                    <li key={district.id}>
                      <button
                        type="button"
                        onClick={() => flyToDistrict(district)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-cloud/85 hover:bg-glacier/10"
                      >
                        <span>{district.name}</span>
                        <span className="text-[0.58rem] uppercase tracking-[0.1em] text-muted">
                          {district.state}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="absolute bottom-3 right-3 z-10 max-w-[15rem] rounded-lg border border-line bg-midnight/92 p-2.5">
            <p className="flex items-center gap-1.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
              <Layers className="h-3 w-3" /> {LAYERS.find((item) => item.key === layer)?.label}
            </p>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {legend.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5 text-[0.56rem] text-cloud/70">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
                  {item.label}
                </li>
              ))}
            </ul>
            {layer === "ndvi" && (
              <p className="mt-1.5 text-[0.55rem] leading-relaxed text-muted">
                Raster visualisation only. District NDVI statistics are not generated by
                this pipeline.
              </p>
            )}
          </div>

          {hovered && hover && (
            <div
              className="pointer-events-none absolute z-20 max-w-[13rem] rounded-lg border border-glacier/25 bg-midnight/96 px-2.5 py-2 text-[0.65rem] shadow-xl"
              style={{
                left: Math.min(hover.x + 14, 640),
                top: Math.max(8, hover.y - 10),
              }}
            >
              <p className="font-medium text-cloud">{hovered.name || "District"}</p>
              <p className="text-[0.58rem] uppercase tracking-[0.1em] text-muted">{hovered.state}</p>
              {hovered.value !== null && hovered.value !== undefined && (
                <p className="mono mt-1 text-glacier">
                  {Number(hovered.value).toFixed(1)}
                  {layer === "rainfall" ? "%" : layer === "groundwater" ? " m" : layer === "irrigation" ? "%" : ""}
                </p>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.1em] text-muted/70">
          Boundaries: geoBoundaries gbOpen 2021 (ODbL). Basemap: EOX Sentinel-2 cloudless.
          Rainfall: NASA POWER / MERRA-2. Groundwater & irrigation: demo fixtures.
        </p>
      </div>

      {showPanel && (
        <aside className="panel-flat min-w-0 p-4 sm:p-5" aria-live="polite">
          {selected ? (
            <DistrictPanel
              district={selected}
              layer={layer}
              year={year}
              compareYear={compareYear}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-start justify-center gap-3">
              <p className="eyebrow">District intelligence</p>
              <p className="font-display text-xl font-medium text-cloud">
                Select a district on the map
              </p>
              <p className="text-sm leading-relaxed text-muted">
                Inspect the components behind the composite index, the observation period
                and the data provenance. Use the layer and year controls to change the view.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="chip">
                  <Crosshair className="h-3 w-3" /> {formatNumber(districts.length)} districts
                </span>
                <span className="chip">Index v0.1</span>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function DistrictPanel({
  district,
  layer,
  year,
  compareYear,
  onClose,
}: {
  district: MapDistrict;
  layer: LayerKey;
  year: number;
  compareYear: number | null;
  onClose: () => void;
}) {
  const yearValue = district.rainfallYears[String(year)];
  const compareValue = compareYear !== null ? district.rainfallYears[String(compareYear)] : null;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted">
            {district.state}
          </p>
          <h3 className="mt-1 font-display text-2xl font-semibold text-cloud">{district.name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-muted hover:text-cloud"
          aria-label="Close district panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.1em]"
          style={{
            backgroundColor: `${STRESS_COLORS[district.stressClass] ?? "#8CA8B5"}22`,
            color: STRESS_COLORS[district.stressClass] ?? "#8CA8B5",
          }}
        >
          {district.stressClass} stress
        </span>
        <ProvenanceBadge type="observed" source="boundaries" />
        <ProvenanceBadge type="reanalysis" source="rainfall" />
        <ProvenanceBadge type="demo_fixture" source="groundwater / irrigation" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="Stress index" value={district.stressIndex?.toFixed(1) ?? "—"} note="0–100 percentile composite" />
        <Metric label="Rainfall departure" value={formatPercent(district.rainfallDeparture, 1)} note="monsoon vs 2015–2024 normal" />
        <Metric label="Groundwater depth" value={district.groundwaterDepth !== null ? `${district.groundwaterDepth.toFixed(1)} m` : "—"} note="pre-monsoon, demo fixture" />
        <Metric label="Irrigated share" value={district.irrigatedShare !== null ? `${district.irrigatedShare.toFixed(0)}%` : "—"} note="net sown area, demo fixture" />
      </dl>

      {layer === "rainfall" && compareYear !== null && (
        <div className="mt-4 rounded-xl border border-line bg-midnight/40 p-3">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
            Year comparison
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="mono text-sm text-cloud">{yearValue !== null && yearValue !== undefined ? formatPercent(yearValue, 1) : "—"}</p>
              <p className="text-[0.55rem] text-muted">{year}</p>
            </div>
            <div>
              <p className="mono text-sm text-cloud">{compareValue !== null && compareValue !== undefined ? formatPercent(compareValue, 1) : "—"}</p>
              <p className="text-[0.55rem] text-muted">{compareYear}</p>
            </div>
            <div>
              <p
                className="mono text-sm"
                style={{
                  color:
                    yearValue !== null && compareValue !== null && yearValue !== undefined && compareValue !== undefined
                      ? yearValue - compareValue >= 0
                        ? "#8CE5B1"
                        : "#FF6B65"
                      : "#8CA8B5",
                }}
              >
                {yearValue !== null && compareValue !== null && yearValue !== undefined && compareValue !== undefined
                  ? `${yearValue - compareValue >= 0 ? "+" : ""}${(yearValue - compareValue).toFixed(1)} pp`
                  : "—"}
              </p>
              <p className="text-[0.55rem] text-muted">difference</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted">
          Composite components
        </p>
        <div className="mt-2 space-y-2">
          {[
            ["Rainfall", district.rainfallScore, "reanalysis"],
            ["Groundwater", district.groundwaterScore, "demo"],
            ["Irrigation", district.irrigationScore, "demo"],
          ].map(([label, value, provenance]) => (
            <div key={String(label)}>
              <div className="flex items-center justify-between text-[0.65rem]">
                <span className="text-cloud/75">
                  {label} <span className="text-[0.5rem] uppercase tracking-[0.1em] text-muted">· {provenance}</span>
                </span>
                <span className="mono text-muted">{typeof value === "number" ? value.toFixed(1) : "—"}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${typeof value === "number" ? Math.max(1, value) : 0}%`,
                    backgroundColor:
                      typeof value === "number"
                        ? value >= 75
                          ? STRESS_COLORS.Severe
                          : value >= 55
                            ? STRESS_COLORS.High
                            : value >= 30
                              ? STRESS_COLORS.Moderate
                              : STRESS_COLORS.Low
                        : "#3a4a52",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.6rem] leading-relaxed text-muted">
          Higher scores mean greater stress or vulnerability. This is a project-defined
          composite, not an official index.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/advisor?district=${encodeURIComponent(district.id)}`} className="btn-primary min-h-11 px-4 py-2 text-xs">
          Advise a field here
        </Link>
        <Link href={`/atlas?district=${encodeURIComponent(district.id)}`} className="btn-ghost min-h-11 px-4 py-2 text-xs">
          Open in atlas
        </Link>
      </div>
      <p className="mt-3 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted/70">
        Observation period · rainfall reanalysis 2015–2025 · groundwater & irrigation{" "}
        {district.groundwaterYear ?? "—"} (demo)
      </p>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line/70 bg-midnight/30 px-3 py-2.5">
      <dt className="font-mono text-[0.52rem] uppercase leading-tight tracking-[0.1em] text-muted">
        {label}
      </dt>
      <dd className="mono mt-1 text-base text-cloud">{value}</dd>
      {note && <dd className="mt-0.5 text-[0.55rem] leading-tight text-muted">{note}</dd>}
    </div>
  );
}
