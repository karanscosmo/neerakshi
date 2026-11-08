"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";
import type { Feature, Point, Polygon } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Crosshair, Eraser, LocateFixed, MapPin, Pentagon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedField {
  geometry: Feature<Polygon | Point>;
  centroid: [number, number];
  areaHa: number;
  kind: "polygon" | "point";
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export function FieldMap({
  onChange,
  clearToken = 0,
  heightClassName = "h-[58vh] min-h-[420px]",
  initialCenter = [78.96, 22.59],
}: {
  onChange: (field: SelectedField | null) => void;
  clearToken?: number;
  heightClassName?: string;
  initialCenter?: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<{
    clear: () => void;
    setMode: (mode: string) => void;
    getSnapshot: () => Feature[];
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"idle" | "polygon" | "point">("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [maplibregl, terra, adapter] = await Promise.all([
        import("maplibre-gl"),
        import("terra-draw"),
        import("terra-draw-maplibre-gl-adapter"),
      ]);
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: "raster",
              tiles: [
                "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{x}/{y}.jpg",
              ],
              tileSize: 256,
              attribution:
                "Sentinel-2 cloudless © EOX | Search © Photon / OpenStreetMap contributors",
            },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#071521" } },
            {
              id: "sat",
              type: "raster",
              source: "satellite",
              paint: {
                "raster-opacity": 0.82,
                "raster-saturation": -0.1,
                "raster-brightness-max": 0.82,
              },
            },
          ],
        },
        center: initialCenter,
        zoom: 5,
        attributionControl: false,
        maxZoom: 19,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      map.on("load", () => {
        if (cancelled) return;
        const draw = new terra.TerraDraw({
          adapter: new adapter.TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            new terra.TerraDrawPolygonMode({
              styles: {
                fillColor: "#48D9E8",
                fillOpacity: 0.22,
                outlineColor: "#48D9E8",
                outlineWidth: 2.5,
                closingPointColor: "#F2B85B",
                closingPointWidth: 7,
                closingPointOutlineColor: "#071521",
                closingPointOutlineWidth: 1.5,
              },
            }),
            new terra.TerraDrawPointMode({
              styles: {
                pointColor: "#F2B85B",
                pointWidth: 9,
                pointOutlineColor: "#071521",
                pointOutlineWidth: 2,
              },
            }),
            new terra.TerraDrawSelectMode(),
          ],
        });
        draw.start();
        drawRef.current = draw;
        setReady(true);

        draw.on("finish", (id) => {
          const feature = draw.getSnapshot().find((item) => item.id === id);
          if (!feature || !feature.geometry) return;
          if (feature.geometry.type === "Polygon") {
            const geometry = feature as Feature<Polygon>;
            const ring = geometry.geometry.coordinates[0];
            const centroid = bboxCenter(ring);
            const areaHa = polygonAreaHa(geometry.geometry.coordinates);
            onChange({ geometry, centroid, areaHa, kind: "polygon" });
            setMode("idle");
            draw.setMode("select");
            return;
          }
          if (feature.geometry.type === "Point") {
            const geometry = feature as Feature<Point>;
            const [lon, lat] = geometry.geometry.coordinates;
            onChange({ geometry, centroid: [lon, lat], areaHa: 1, kind: "point" });
            setMode("idle");
            draw.setMode("select");
          }
        });
      });
    })();

    return () => {
      cancelled = true;
      try {
        drawRef.current?.clear();
      } catch {
        // ignore
      }
      drawRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!drawRef.current || clearToken === 0) return;
    drawRef.current.clear();
    drawRef.current.setMode("select");
    setMode("idle");
  }, [clearToken]);

  function startDraw(kind: "polygon" | "point") {
    const draw = drawRef.current;
    if (!draw) return;
    draw.clear();
    draw.setMode(kind);
    setMode(kind);
    onChange(null);
  }

  function clear() {
    drawRef.current?.clear();
    drawRef.current?.setMode("select");
    setMode("idle");
    onChange(null);
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 3) return;
    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=6&lang=en`,
      );
      if (!response.ok) throw new Error("Search unavailable");
      const data = (await response.json()) as { features?: PhotonFeature[] };
      const features = (data.features ?? []).filter(
        (feature) => !feature.properties.country || feature.properties.country === "India",
      );
      setResults(features.length > 0 ? features : (data.features ?? []));
      if ((data.features ?? []).length === 0) {
        setSearchError("No matching place found. Try a nearby town or drop a pin directly.");
      }
    } catch {
      setSearchError("Place search is unavailable right now. Try again or use the map.");
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(feature: PhotonFeature) {
    const [lon, lat] = feature.geometry.coordinates;
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 14, duration: 900 });
    setQuery(
      feature.properties.name ??
        feature.properties.city ??
        "Selected location",
    );
    setResults([]);
  }

  function locate() {
    if (!navigator.geolocation) {
      setSearchError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setSearchError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15,
          duration: 1000,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSearchError(
          "Location permission was denied. You can still search or draw your field.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <form onSubmit={search} className="relative min-w-[14rem] flex-1">
          <label className="sr-only" htmlFor="field-search">
            Search village, town or district
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="field-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search village, town or district"
            className="field min-h-11 pl-9 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {results.length > 0 && (
            <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-midnight/98 shadow-2xl">
              {results.map((feature, index) => (
                <li key={`${feature.geometry.coordinates.join("-")}-${index}`}>
                  <button
                    type="button"
                    onClick={() => chooseResult(feature)}
                    className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-glacier/10"
                  >
                    <span className="text-cloud/85">
                      {feature.properties.name ??
                        feature.properties.city ??
                        "Unnamed place"}
                    </span>
                    <span className="text-[0.55rem] uppercase tracking-[0.08em] text-muted">
                      {[feature.properties.state, feature.properties.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
        <button type="button" onClick={locate} disabled={locating} className="btn-ghost min-h-11 text-xs">
          <LocateFixed className={cn("h-3.5 w-3.5", locating && "animate-spin")} />
          {locating ? "Locating" : "My location"}
        </button>
      </div>

      {searchError && (
        <p className="mb-2 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-[0.68rem] text-amber">
          {searchError}
        </p>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-line">
        <div
          ref={containerRef}
          className={cn("w-full", heightClassName)}
          role="application"
          aria-label="Field location map. Draw a boundary or drop a pin."
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-midnight/70 text-sm text-muted">
            Loading field map
          </div>
        )}

        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => startDraw("polygon")}
            aria-pressed={mode === "polygon"}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-[0.7rem] backdrop-blur",
              mode === "polygon"
                ? "border-glacier/60 bg-glacier/20 text-glacier"
                : "border-line bg-midnight/85 text-cloud/80 hover:text-cloud",
            )}
          >
            <Pentagon className="h-3.5 w-3.5" /> Draw field
          </button>
          <button
            type="button"
            onClick={() => startDraw("point")}
            aria-pressed={mode === "point"}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-[0.7rem] backdrop-blur",
              mode === "point"
                ? "border-amber/60 bg-amber/15 text-amber"
                : "border-line bg-midnight/85 text-cloud/80 hover:text-cloud",
            )}
          >
            <MapPin className="h-3.5 w-3.5" /> Drop pin
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-midnight/85 px-3 text-[0.7rem] text-cloud/80 backdrop-blur hover:text-cloud"
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
        </div>

        {mode !== "idle" && (
          <div className="absolute bottom-3 left-3 z-10 max-w-xs rounded-lg border border-glacier/30 bg-midnight/92 px-3 py-2 text-[0.65rem] leading-relaxed text-cloud/80">
            {mode === "polygon"
              ? "Tap each corner of the field. Close the shape by tapping the first point again or double-clicking. Esc cancels."
              : "Tap the field location. A pin is enough if you do not know the boundary."}
          </div>
        )}
      </div>
      <p className="mt-2 flex items-start gap-1.5 font-mono text-[0.55rem] uppercase leading-relaxed tracking-[0.08em] text-muted/70">
        <Crosshair className="mt-0.5 h-3 w-3" />
        Boundary drawing by Terra Draw · basemap EOX Sentinel-2 cloudless · search by Photon /
        OpenStreetMap
      </p>
    </div>
  );
}

function bboxCenter(ring: number[][]): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function polygonAreaHa(rings: number[][][]): number {
  if (rings.length === 0) return 0;
  const outer = ringAreaM2(rings[0]);
  const holes = rings.slice(1).reduce((sum, ring) => sum + ringAreaM2(ring), 0);
  return Math.max(0, (outer - holes) / 10_000);
}

function ringAreaM2(ring: number[][]): number {
  if (ring.length < 3) return 0;
  const lat0 =
    ring.reduce((sum, point) => sum + point[1], 0) / Math.max(1, ring.length);
  const metersPerDegLat = 110_574;
  const metersPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    sum +=
      x1 * metersPerDegLon * (y2 * metersPerDegLat) -
      x2 * metersPerDegLon * (y1 * metersPerDegLat);
  }
  return Math.abs(sum / 2);
}
