"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { feature } from "topojson-client";
import type { GeometryCollection } from "topojson-specification";
import { loadTopo } from "@/components/journey/acts";
import { useI18n, fmt } from "@/lib/i18n/client";
import { haToAcres, polygonAreaHa, squareAround, HA_PER_ACRE } from "@/lib/shared/geo";

type Mode = "draw" | "pin";
const S2_TILES = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg";

/**
 * Field picker: Sentinel-2 cloudless imagery (EOX) as the satellite basemap over a
 * paper fallback with district lines (so the map still works if imagery fails),
 * Terra Draw polygon drawing, or a dropped pin with an approximate area.
 */
export function FieldMap({ center, onChange, initial }: { center: [number, number] | null; onChange: (g: GeoJSON.Polygon | null) => void; initial?: GeoJSON.Polygon | null }) {
  const { t } = useI18n();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const drawRef = useRef<{ setMode: (m: string) => void; clear: () => void; getSnapshot: () => { geometry: GeoJSON.Geometry }[] } | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mode, setMode] = useState<Mode>("draw");
  const [geom, setGeom] = useState<GeoJSON.Polygon | null>(initial ?? null);
  const [pinAcres, setPinAcres] = useState(1);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [ready, setReady] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const publish = useCallback(
    (g: GeoJSON.Polygon | null) => {
      setGeom(g);
      onChange(g);
      const src = mapRef.current?.getSource("field") as { setData?: (d: GeoJSON.GeoJSON) => void } | undefined;
      src?.setData?.(g ? { type: "Feature", properties: {}, geometry: g } : { type: "FeatureCollection", features: [] });
    },
    [onChange],
  );

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    (async () => {
      const [{ Map: MapCtor, NavigationControl, Marker: MarkerCtor, setWorkerUrl }, dTopo, td, tdAdapter] = await Promise.all([
        import("maplibre-gl"),
        loadTopo("districts"),
        import("terra-draw"),
        import("terra-draw-maplibre-gl-adapter"),
      ]);
      if (cancelled || !el.current) return;
      setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      const districts = feature(dTopo, dTopo.objects.districts as GeometryCollection) as unknown as GeoJSON.FeatureCollection;
      map = new MapCtor({
        container: el.current,
        center: center ? [center[1], center[0]] : [76.7, 12.6],
        zoom: center ? 15 : 5,
        maxZoom: 18,
        attributionControl: { compact: true, customAttribution: "Sentinel-2 cloudless 2023 © EOX IT Services GmbH (contains modified Copernicus Sentinel data)" },
        dragRotate: false,
        style: {
          version: 8,
          sources: {
            s2: { type: "raster", tiles: [S2_TILES], tileSize: 256, maxzoom: 15 },
            districts: { type: "geojson", data: districts },
            field: { type: "geojson", data: initial ? { type: "Feature", properties: {}, geometry: initial } : { type: "FeatureCollection", features: [] } },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#E6DBC2" } },
            { id: "s2", type: "raster", source: "s2" },
            { id: "d-casing", type: "line", source: "districts", paint: { "line-color": "#F3EBD8", "line-width": 3, "line-opacity": 0.6 } },
            { id: "d-lines", type: "line", source: "districts", paint: { "line-color": "#23262A", "line-width": 1, "line-opacity": 0.7 } },
            { id: "field-fill", type: "fill", source: "field", paint: { "fill-color": "#E3A65A", "fill-opacity": 0.25 } },
            { id: "field-line", type: "line", source: "field", paint: { "line-color": "#E3A65A", "line-width": 2.5 } },
          ],
        },
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (cancelled || !map) return;
        const draw = new td.TerraDraw({
          adapter: new tdAdapter.TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            new td.TerraDrawPolygonMode({
              styles: { fillColor: "#E3A65A", fillOpacity: 0.25, outlineColor: "#E3A65A", outlineWidth: 2.5, closingPointColor: "#A9533E", closingPointWidth: 7, closingPointOutlineColor: "#F3EBD8", closingPointOutlineWidth: 2 },
            }),
          ],
        });
        draw.start();
        draw.setMode("polygon");
        draw.on("finish", () => {
          const snap = draw.getSnapshot();
          const last = snap[snap.length - 1];
          if (last && last.geometry.type === "Polygon") {
            draw.clear();
            publish(last.geometry as GeoJSON.Polygon);
            draw.setMode("static");
          }
        });
        drawRef.current = draw as unknown as typeof drawRef.current;
        setReady(true);
      });
      map.on("click", (e) => {
        if (modeRef.current !== "pin") return;
        const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setPin(p);
        markerRef.current?.remove();
        markerRef.current = new MarkerCtor({ color: "#A9533E" }).setLngLat(p).addTo(map!);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to a searched / located point
  useEffect(() => {
    if (center && mapRef.current) mapRef.current.flyTo({ center: [center[1], center[0]], zoom: 15, speed: 1.6 });
  }, [center]);

  // Pin + area → square polygon
  useEffect(() => {
    if (mode === "pin" && pin) publish(squareAround(pin[0], pin[1], pinAcres * HA_PER_ACRE));
  }, [mode, pin, pinAcres, publish]);

  const switchMode = (m: Mode) => {
    setMode(m);
    publish(null);
    setPin(null);
    markerRef.current?.remove();
    const d = drawRef.current;
    if (d) {
      d.clear();
      d.setMode(m === "draw" ? "polygon" : "static");
    }
  };

  const clear = () => {
    publish(null);
    setPin(null);
    markerRef.current?.remove();
    drawRef.current?.clear();
    drawRef.current?.setMode(mode === "draw" ? "polygon" : "static");
  };

  const area = geom ? polygonAreaHa(geom) : null;
  return (
    <div>
      <div className="row" role="group" style={{ gap: 6, marginBottom: 8 }}>
        <button className="chip" aria-pressed={mode === "draw"} onClick={() => switchMode("draw")}>
          ✎ {t.field.draw}
        </button>
        <button className="chip" aria-pressed={mode === "pin"} onClick={() => switchMode("pin")}>
          ⌖ {t.field.pin}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={clear} disabled={!geom && !pin}>
          {t.field.clear}
        </button>
      </div>
      <p className="annot" style={{ textTransform: "none", letterSpacing: 0 }}>
        {mode === "draw" ? t.field.drawHint : t.field.pinHint}
      </p>
      {mode === "pin" ? (
        <label className="row" style={{ gap: 8, margin: "6px 0" }}>
          <span>{t.field.approxArea}</span>
          <select className="select" value={pinAcres} onChange={(e) => setPinAcres(Number(e.target.value))}>
            {[0.25, 0.5, 1, 2, 3, 5, 10].map((a) => (
              <option key={a} value={a}>
                {a} {t.common.unitsAcres}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="field-map">
        <div ref={el} style={{ position: "absolute", inset: 0 }} />
        {!ready ? <div className="skeleton" style={{ position: "absolute", inset: 0 }} /> : null}
      </div>
      <p className="num" aria-live="polite" style={{ minHeight: "1.5em" }}>
        {area !== null ? fmt(t.field.area, { acres: haToAcres(area).toFixed(2), ha: area.toFixed(2) }) : ""}
      </p>
      <style>{`.field-map { position: relative; height: min(56dvh, 460px); border: 1px solid var(--ink); border-radius: 10px; overflow: hidden; touch-action: none; }`}</style>
    </div>
  );
}
