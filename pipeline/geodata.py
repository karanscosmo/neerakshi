"""Build district/state reference geometry and a name crosswalk."""
from __future__ import annotations

import csv
import json
import math
import unicodedata
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union
from shapely import make_valid

from .config import BOUNDARIES, PREPARED, PUBLIC_GEO
from .io_utils import ensure_dir, write_json


def _ascii_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii").strip()


def _round_coords(obj, ndigits: int = 4):
    if isinstance(obj, (list, tuple)):
        return [_round_coords(item, ndigits) for item in obj]
    if isinstance(obj, float):
        return round(obj, ndigits)
    return obj


def _area_km2(geom, lat0: float) -> float:
    """Approximate area using a local sinusoidal projection."""
    cos_lat = max(math.cos(math.radians(lat0)), 0.05)
    projected = transform(lambda x, y, z=None: (x * 111.32 * cos_lat, y * 111.32), geom)
    return float(projected.area)


def build_geography() -> dict:
    ensure_dir(PREPARED)
    ensure_dir(PUBLIC_GEO)

    with open(BOUNDARIES / "geoBoundaries-IND-ADM1_simplified.geojson", encoding="utf-8") as handle:
        states_raw = json.load(handle)
    with open(BOUNDARIES / "geoBoundaries-IND-ADM2_simplified.geojson", encoding="utf-8") as handle:
        districts_raw = json.load(handle)

    states = []
    state_geoms = []
    for feature in states_raw["features"]:
        props = feature["properties"]
        geom = make_valid(shape(feature["geometry"]))
        states.append({
            "id": props["shapeID"],
            "name": _ascii_name(props["shapeName"]),
            "iso": props.get("shapeISO") or "",
            "geom": geom,
        })
        state_geoms.append((_ascii_name(props["shapeName"]), geom))

    districts = []
    unmatched = []
    for feature in districts_raw["features"]:
        props = feature["properties"]
        geom = make_valid(shape(feature["geometry"]))
        point = geom.representative_point()
        state_name = None
        for candidate_name, candidate_geom in state_geoms:
            try:
                if candidate_geom.contains(point):
                    state_name = candidate_name
                    break
            except Exception:  # noqa: BLE001
                continue
        if state_name is None:
            nearest = min(state_geoms, key=lambda item: item[1].distance(point))
            state_name = nearest[0]
            unmatched.append(props["shapeName"])
        districts.append({
            "district_id": props["shapeID"],
            "district_name": _ascii_name(props["shapeName"]),
            "state": state_name,
            "centroid_lon": round(point.x, 5),
            "centroid_lat": round(point.y, 5),
            "area_km2": round(_area_km2(geom, point.y), 1),
            "geom": geom,
        })

    districts.sort(key=lambda item: (item["state"], item["district_name"]))

    with open(PREPARED / "district_crosswalk.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "district_id", "district_name", "state", "centroid_lon", "centroid_lat",
            "area_km2", "source", "source_id", "aliases",
        ])
        for item in districts:
            writer.writerow([
                item["district_id"], item["district_name"], item["state"],
                item["centroid_lon"], item["centroid_lat"], item["area_km2"],
                "geoBoundaries ADM2 (gbOpen, 2021)", item["district_id"],
                item["district_name"],
            ])

    write_json(PREPARED / "district_reference.json", {
        "source": "geoBoundaries gbOpen IND ADM2 (2021), ODbL 1.0",
        "district_count": len(districts),
        "unmatched_state_assignments": unmatched,
        "districts": [
            {key: value for key, value in item.items() if key != "geom"}
            for item in districts
        ],
    })

    web_districts = []
    for item in districts:
        simplified = item["geom"].simplify(0.012, preserve_topology=True)
        web_districts.append({
            "type": "Feature",
            "properties": {
                "id": item["district_id"],
                "name": item["district_name"],
                "state": item["state"],
            },
            "geometry": _round_coords(mapping(simplified)),
        })
    write_json(PUBLIC_GEO / "districts.geojson", {
        "type": "FeatureCollection",
        "name": "neerakshi_districts",
        "attribution": "Boundaries: geoBoundaries gbOpen (ODbL 1.0)",
        "features": web_districts,
    })

    web_states = []
    for entry in states:
        simplified = entry["geom"].simplify(0.02, preserve_topology=True)
        web_states.append({
            "type": "Feature",
            "properties": {"id": entry["id"], "name": entry["name"]},
            "geometry": _round_coords(mapping(simplified)),
        })
    write_json(PUBLIC_GEO / "states.geojson", {
        "type": "FeatureCollection",
        "name": "neerakshi_states",
        "attribution": "Boundaries: geoBoundaries gbOpen (ODbL 1.0)",
        "features": web_states,
    })

    return {
        "districts": districts,
        "states": [{"id": s["id"], "name": s["name"], "iso": s["iso"]} for s in states],
        "unmatched": unmatched,
    }
