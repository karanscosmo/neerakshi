"""Canonical districts + compressed TopoJSON for the app and Tableau.

Outputs
- data/reference/districts.csv           canonical district table (id, names, centroid, area, subdivision)
- public/data/districts.topo.json        simplified district polygons (TopoJSON, quantised)
- public/data/states.topo.json           simplified state polygons
- public/data/india.topo.json            national outline (Survey of India via DataMeet)
- data/prepared/districts.geojson        full-resolution-ish GeoJSON for Tableau
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import geopandas as gpd
import pandas as pd

from .common import PREPARED, PUBLIC_DATA, RAW, REF, ROOT, Report
from .crosswalk import Matcher, canonical_districts

MAPSHAPER = ROOT / "node_modules" / ".bin" / "mapshaper"


def subdivision_lookup(report: Report) -> pd.Series:
    """district_id → IMD subdivision name (as spelled in the 1901–2015 IMD file)."""
    h = pd.read_csv(RAW / "imd" / "district_to_imd_subdivision.csv")
    m = Matcher.for_source("hssling")
    h["district_id"] = [m.resolve(r.state_name, r.district_name) for r in h.itertuples()]
    h["subdivision"] = h["imd_subdivision"].str.upper()
    g = h.dropna(subset=["district_id"]).groupby("district_id")["subdivision"].agg(lambda s: sorted(set(s)))
    conflicts = g[g.map(len) > 1]
    if len(conflicts):
        report.note("Crosswalk", f"{len(conflicts)} districts map to more than one IMD subdivision; first kept: {conflicts.to_dict()}")
    look = g.map(lambda s: s[0])
    # Districts with no row: use the state's subdivision only when the whole
    # state lies in a single subdivision (Delhi, Sikkim).
    cd = canonical_districts()
    st = cd.set_index("district_id")["census_state"]
    filled = []
    for did in cd["district_id"]:
        if did in look.index:
            continue
        peers = look[look.index.isin(st[st == st[did]].index)]
        if peers.nunique() == 1:
            look[did] = peers.iloc[0]
            filled.append(did)
    if filled:
        report.note("Crosswalk", f"{len(filled)} districts took their state's single IMD subdivision (state_single_subdivision): {', '.join(sorted(filled))}")
    missing = sorted(set(cd["district_id"]) - set(look.index))
    if missing:
        report.note("Crosswalk", f"{len(missing)} districts have no IMD subdivision: {', '.join(missing)}")
    report.table("crosswalk_hssling", pd.DataFrame(m.crosswalk_rows()))
    return look


def run(report: Report) -> pd.DataFrame:
    cd = canonical_districts().copy()
    sub = subdivision_lookup(report)
    cd["imd_subdivision"] = cd["district_id"].map(sub)
    out = cd[["district_id", "district_name", "state_code", "state_name", "census_state", "census_code", "lat", "lon", "area_km2", "imd_subdivision"]]
    out = out.sort_values(["state_name", "district_name"])
    REF.mkdir(parents=True, exist_ok=True)
    out.to_csv(REF / "districts.csv", index=False)
    report.note("Boundaries", f"{len(out)} canonical districts (Census 2011, DataMeet); the 'Data Not Available' polygon in J&K is excluded.")

    PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
    if not MAPSHAPER.exists():
        report.note("Boundaries", "mapshaper not installed (npm i) — TopoJSON not rebuilt.")
        return out

    with tempfile.TemporaryDirectory() as td:
        tdp = Path(td)
        g = canonical_districts()[["district_id", "district_name", "state_code", "geometry"]].rename(columns={"district_id": "id", "district_name": "name", "state_code": "st"})
        g.to_file(tdp / "districts.geojson", driver="GeoJSON")
        _mapshape(tdp / "districts.geojson", PUBLIC_DATA / "districts.topo.json", "districts", "8%", "id,name,st")
        _mapshape(tdp / "districts.geojson", PREPARED / "districts.geojson", "districts", "25%", "id,name,st", fmt="geojson")

        s = gpd.read_file(RAW / "boundaries" / "India-States.shp")
        s = s.rename(columns={"ST_NM": "name"})[["name", "geometry"]]
        s.to_file(tdp / "states.geojson", driver="GeoJSON")
        _mapshape(tdp / "states.geojson", PUBLIC_DATA / "states.topo.json", "states", "6%", "name")

        shutil.copy(RAW / "boundaries" / "india-soi.geojson", tdp / "india.geojson")
        _mapshape(tdp / "india.geojson", PUBLIC_DATA / "india.topo.json", "india", "6%", None)
    for f in ("districts.topo.json", "states.topo.json", "india.topo.json"):
        report.note("Boundaries", f"public/data/{f}: {(PUBLIC_DATA / f).stat().st_size / 1024:.0f} KB")
    return out


def _mapshape(src: Path, dst: Path, layer: str, pct: str, fields: str | None, fmt: str = "topojson") -> None:
    cmd = [str(MAPSHAPER), str(src), "-rename-layers", layer, "-simplify", "weighted", pct, "keep-shapes"]
    if fields:
        cmd += ["-filter-fields", fields]
    cmd += ["-o", str(dst), f"format={fmt}", "force"]
    if fmt == "topojson":
        cmd += ["quantization=1e5"]
    else:
        cmd += ["precision=0.0001"]
    subprocess.run(cmd, check=True, capture_output=True)
