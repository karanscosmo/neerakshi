"use client";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection } from "topojson-specification";
import { geoGraticule } from "d3-geo";
import { loadTopo } from "@/components/journey/acts";
import { colorFor, type Ramp } from "@/lib/shared/scales";

export type LayerValues = { id: string; v: number | null; basis?: string | null }[];

/**
 * MapLibre map with a self-contained "survey sheet" style: paper background,
 * graticule, India outline, state and district lines, and a district
 * choropleth driven by feature-state (no external tiles, glyphs or sprites).
 */
export function AtlasMap({
  values,
  ramp,
  selected,
  onSelect,
  onReady,
  syncWith,
  interactive = true,
  label,
}: {
  values: LayerValues;
  ramp: Ramp;
  selected: string | null;
  onSelect?: (id: string, name: string) => void;
  onReady?: (m: MLMap) => void;
  syncWith?: MLMap | null;
  interactive?: boolean;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const prevIds = useRef<Set<string>>(new Set());
  const hoverId = useRef<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; name: string; v: string } | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    (async () => {
      const [{ Map: MapCtor, NavigationControl, setWorkerUrl }, dTopo, sTopo, iTopo] = await Promise.all([import("maplibre-gl"), loadTopo("districts"), loadTopo("states"), loadTopo("india")]);
      setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      if (cancelled || !el.current) return;
      const districts = feature(dTopo, dTopo.objects.districts as GeometryCollection) as unknown as GeoJSON.FeatureCollection;
      const states = mesh(sTopo, sTopo.objects.states as GeometryCollection) as unknown as GeoJSON.MultiLineString;
      const india = feature(iTopo, iTopo.objects.india as GeometryCollection) as unknown as GeoJSON.FeatureCollection;
      const grat = geoGraticule().step([5, 5]).extent([[60, 0], [105, 40]])();
      const style: StyleSpecification = {
        version: 8,
        sources: {
          districts: { type: "geojson", data: districts, promoteId: "id" },
          states: { type: "geojson", data: { type: "Feature", properties: {}, geometry: states } },
          india: { type: "geojson", data: india },
          grat: { type: "geojson", data: { type: "Feature", properties: {}, geometry: grat } },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#EFE6D2" } },
          { id: "grat", type: "line", source: "grat", paint: { "line-color": "#D9CFBB", "line-width": 0.8 } },
          { id: "india-fill", type: "fill", source: "india", paint: { "fill-color": "#E6DBC2" } },
          {
            id: "choropleth",
            type: "fill",
            source: "districts",
            paint: {
              "fill-color": ["coalesce", ["feature-state", "color"], "#E6DBC2"],
              "fill-opacity": ["case", ["boolean", ["feature-state", "hasValue"], false], 0.92, 0.55],
            },
          },
          { id: "nodata", type: "fill", source: "districts", paint: { "fill-pattern": "hatch", "fill-opacity": ["case", ["boolean", ["feature-state", "hasValue"], false], 0, 0.55] } },
          { id: "district-lines", type: "line", source: "districts", paint: { "line-color": "#23262A", "line-opacity": 0.28, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.2, 7, 0.8] } },
          { id: "state-lines", type: "line", source: "states", paint: { "line-color": "#23262A", "line-opacity": 0.7, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 7, 1.4] } },
          { id: "india-line", type: "line", source: "india", paint: { "line-color": "#23262A", "line-width": 1.4 } },
          { id: "hover", type: "line", source: "districts", paint: { "line-color": "#23262A", "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0] } },
          { id: "selected", type: "line", source: "districts", paint: { "line-color": "#A9533E", "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, 0] } },
        ],
      };
      map = new MapCtor({
        container: el.current,
        style,
        bounds: [[68, 6.5], [97.5, 36]],
        fitBoundsOptions: { padding: 12 },
        maxBounds: [[55, -2], [110, 44]],
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        interactive,
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      if (interactive) map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // hatch pattern for missing data (never a ramp colour)
      const sz = 8;
      const data = new Uint8Array(sz * sz * 4);
      for (let y = 0; y < sz; y++)
        for (let x = 0; x < sz; x++) {
          const on = (x + y) % 8 === 0;
          const i = (y * sz + x) * 4;
          data.set(on ? [94, 110, 126, 200] : [0, 0, 0, 0], i);
        }
      map.addImage("hatch", { width: sz, height: sz, data });
      map.on("load", () => {
        if (cancelled) return;
        setLoaded(true);
        onReady?.(map!);
      });
      if (onSelect && interactive) {
        map.on("click", "choropleth", (e) => {
          const f = e.features?.[0];
          if (f) onSelect(String(f.properties.id), String(f.properties.name));
        });
      }
      map.on("mousemove", "choropleth", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.properties.id);
        if (hoverId.current && hoverId.current !== id) map!.setFeatureState({ source: "districts", id: hoverId.current }, { hover: false });
        hoverId.current = id;
        map!.setFeatureState({ source: "districts", id }, { hover: true });
        map!.getCanvas().style.cursor = "pointer";
        const v = valuesRef.current.find((x) => x.id === id)?.v;
        setHover({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, name: String(f.properties.name), v: v === null || v === undefined ? "—" : ramp.label(v) });
      });
      map.on("mouseleave", "choropleth", () => {
        if (hoverId.current) map!.setFeatureState({ source: "districts", id: hoverId.current }, { hover: false });
        hoverId.current = null;
        map!.getCanvas().style.cursor = "";
        setHover(null);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paint values via feature-state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const ids = new Set<string>();
    for (const r of values) {
      const c = colorFor(ramp, r.v);
      ids.add(r.id);
      map.setFeatureState({ source: "districts", id: r.id }, { color: c ?? null, hasValue: c !== null });
    }
    for (const id of prevIds.current) if (!ids.has(id)) map.setFeatureState({ source: "districts", id }, { color: null, hasValue: false });
    prevIds.current = ids;
  }, [values, ramp, loaded]);

  // Selected outline
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (prevSel.current) map.setFeatureState({ source: "districts", id: prevSel.current }, { selected: false });
    if (selected) map.setFeatureState({ source: "districts", id: selected }, { selected: true });
    prevSel.current = selected;
  }, [selected, loaded]);

  // Camera sync for compare mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !syncWith || !loaded) return;
    const sync = () => map.jumpTo({ center: syncWith.getCenter(), zoom: syncWith.getZoom() });
    sync();
    syncWith.on("move", sync);
    return () => {
      syncWith.off("move", sync);
    };
  }, [syncWith, loaded]);

  return (
    <div className="atlas-map" role="img" aria-label={label}>
      <div ref={el} className="atlas-map__canvas" />
      {!loaded ? <div className="skeleton atlas-map__skeleton" aria-hidden /> : null}
      {hover ? (
        <div className="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {hover.name}: {hover.v}
        </div>
      ) : null}
    </div>
  );
}
