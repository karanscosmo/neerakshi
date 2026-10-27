"""Registry of every raw source file the pipeline reads.

Each entry records where the file comes from, the pinned commit (for GitHub
mirrors), the original publisher and the licence. ``fetch`` downloads the files
that can be fetched automatically; manual-only sources are documented in
docs/MANUAL_STEPS.md and simply skipped (the pipeline then reports them as
missing rather than inventing values).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"


@dataclass(frozen=True)
class Source:
    id: str
    path: str  # relative to data/raw
    url: str | None  # None => manual download only
    publisher: str
    licence: str
    note: str = ""


GH = "https://raw.githubusercontent.com"

DATAMEET_SHA = "b3fbbde595310b397a55d718e0958ce249a4fa1f"
APY_SHA = "f42942ca9c1ecbc2b7da92147d80dc9aafcddf17"
RAIN_SHA = "e8d66dd0013429c5e76502a06d068166a99f1067"
HSSLING_SHA = "e89069cb98dd965bd6008114b4633cfa4f2c58cb"
CGWB_SHA = "caebf7e8dd2a099af52cd91a2828fd860914b2e3"
CELESTIAL_SHA = "7e720a3de062059d4c5400a379146a601d9010e0"

SOURCES: list[Source] = [
    # D1 — district-wise, season-wise crop production (APY), 1997–2022
    Source(
        "D1_apy",
        "apy/crop_production.csv",
        f"{GH}/Ankush-Manhas840/crop-yield-prediction/{APY_SHA}/data/crop_production.csv",
        "Directorate of Economics & Statistics, MoA&FW (via India Data Portal / data.gov.in); GitHub mirror Ankush-Manhas840/crop-yield-prediction",
        "Open Data Commons Attribution (India Data Portal) / GODL-India",
        "Mirror author dropped the 'Total' season rows to avoid double counting.",
    ),
    # D3 (interim) — IMD sub-divisional monthly rainfall 1901–2015 and district normals
    Source(
        "D3_subdiv",
        "imd/rainfall_in_india_1901-2015.csv",
        f"{GH}/yRaviKanthh/india-rainfall-dashboard/{RAIN_SHA}/rainfall%20in%20india%201901-2015.csv",
        "India Meteorological Department via data.gov.in; GitHub mirror yRaviKanthh/india-rainfall-dashboard",
        "GODL-India",
    ),
    Source(
        "D3_district_normal",
        "imd/district_wise_rainfall_normal.csv",
        f"{GH}/yRaviKanthh/india-rainfall-dashboard/{RAIN_SHA}/district_wise_rainfall_normal.csv",
        "India Meteorological Department via data.gov.in; GitHub mirror",
        "GODL-India",
    ),
    Source(
        "D3_state_jjas",
        "imd/climate_unit_year.csv",
        f"{GH}/hssling/elnino-heat-india/{HSSLING_SHA}/data/derived/climate_unit_year.csv",
        "Area-weighted aggregates of IMD 0.25° gridded rainfall to 34 state units (Siddalingaiah, hssling/elnino-heat-india)",
        "CC BY 4.0 (aggregation); IMD gridded-data terms",
    ),
    Source(
        "D3_district_subdiv_map",
        "imd/district_to_imd_subdivision.csv",
        f"{GH}/hssling/elnino-heat-india/{HSSLING_SHA}/pipeline/reference/district_to_imd_subdivision.csv",
        "District → IMD meteorological subdivision mapping (hssling/elnino-heat-india)",
        "CC BY 4.0",
    ),
    # D3 (preferred) — IMD 0.25° gridded daily rainfall, binary .grd per year
    Source(
        "D3_grid",
        "imd/grid/",
        None,
        "India Meteorological Department, Pune (imdlib / imdpune.gov.in)",
        "IMD gridded-data terms (do not redistribute raw grids)",
        "Manual or `imdlib.get_data('rain', y0, y1, fn_format='yearwise', file_dir='data/raw/imd/grid')`.",
    ),
    # D4 — CGWB well observations 1996–2017 (May/Aug/Nov/Jan)
    Source(
        "D4_cgwb",
        "cgwb/CGWB_data_wide.csv",
        f"{GH}/craigdsouza/cgwb/{CGWB_SHA}/data/CGWB_data_wide.csv",
        "Central Ground Water Board (obtained from CGWB by T. Hora, U Waterloo); GitHub mirror craigdsouza/cgwb",
        "Government of India data; attribute CGWB",
    ),
    # D2 — ICRISAT DLD irrigated area (manual, needs registration)
    Source(
        "D2_icrisat",
        "icrisat/",
        None,
        "ICRISAT-TCI District Level Database",
        "CC BY 4.0",
        "Manual download after free registration, see docs/MANUAL_STEPS.md",
    ),
    # D10 — boundaries (datameet community maps)
    *[
        Source(
            f"D10_dist_{ext}",
            f"boundaries/2011_Dist.{ext}",
            f"{GH}/datameet/maps/{DATAMEET_SHA}/Districts/Census_2011/2011_Dist.{ext}",
            "DataMeet community maps (Census 2011 districts)",
            "CC BY 2.5 India",
        )
        for ext in ("shp", "shx", "dbf", "prj")
    ],
    Source(
        "D10_india_soi",
        "boundaries/india-soi.geojson",
        f"{GH}/datameet/maps/{DATAMEET_SHA}/Country/india-soi.geojson",
        "DataMeet community maps — Survey of India national outline",
        "CC BY 2.5 India",
    ),
    *[
        Source(
            f"D10_state_{ext}",
            f"boundaries/India-States.{ext}",
            f"{GH}/datameet/maps/{DATAMEET_SHA}/Survey-of-India-Index-Maps/Boundaries/India-States.{ext}",
            "DataMeet community maps — Survey of India state boundaries",
            "CC BY 2.5 India",
        )
        for ext in ("shp", "shx", "dbf", "prj")
    ],
    # Star catalogue for the Journey sky (Yale Bright Star–derived, d3-celestial)
    Source(
        "STARS",
        "sky/stars.6.json",
        f"{GH}/ofrohn/d3-celestial/{CELESTIAL_SHA}/data/stars.6.json",
        "d3-celestial (O. Frohn), from the Hipparcos/Yale Bright Star catalogues",
        "BSD-3-Clause",
    ),
    Source(
        "CONSTELLATIONS",
        "sky/constellations.lines.json",
        f"{GH}/ofrohn/d3-celestial/{CELESTIAL_SHA}/data/constellations.lines.json",
        "d3-celestial (O. Frohn), IAU constellation stick figures",
        "BSD-3-Clause",
    ),
]


def fetch(force: bool = False) -> list[dict]:
    """Download every source with a URL. Returns a manifest of results."""
    import datetime as dt
    import hashlib
    import urllib.request

    out = []
    for s in SOURCES:
        target = RAW / s.path
        rec = {"id": s.id, "path": f"data/raw/{s.path}", "url": s.url or "", "publisher": s.publisher, "licence": s.licence}
        if s.url is None:
            rec["status"] = "manual" if not target.exists() or not any(target.glob("*")) else "present"
            out.append(rec)
            continue
        if target.exists() and not force:
            rec["status"] = "present"
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                with urllib.request.urlopen(s.url, timeout=120) as r:
                    target.write_bytes(r.read())
                rec["status"] = "downloaded"
                rec["retrieved_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
            except Exception as e:  # noqa: BLE001 — report, never fake
                rec["status"] = f"failed: {e}"
                out.append(rec)
                continue
        rec["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
        rec["bytes"] = target.stat().st_size
        out.append(rec)
    return out


if __name__ == "__main__":
    import csv
    import sys

    manifest = fetch(force="--force" in sys.argv)
    mpath = RAW / "manifest.csv"
    old = {}
    if mpath.exists():
        old = {r["id"]: r for r in csv.DictReader(mpath.open())}
    keys = ["id", "path", "url", "publisher", "licence", "status", "retrieved_utc", "sha256", "bytes"]
    with mpath.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in manifest:
            if "retrieved_utc" not in r and r["id"] in old:
                r["retrieved_utc"] = old[r["id"]].get("retrieved_utc", "")
            w.writerow({k: r.get(k, "") for k in keys})
            print(f"{r['status']:<12} {r['id']}")
