"""D2 — irrigated area by crop (ICRISAT-TCI District Level Database).

The DLD needs a free registration, so the file is downloaded by hand into
data/raw/icrisat/ (see docs/MANUAL_STEPS.md). This importer recognises the
DLD column naming ("<CROP> IRRIGATED AREA (1000 ha)", "<CROP> AREA (1000 ha)",
"GROSS IRRIGATED AREA (1000 ha)", "GROSS CROPPED AREA (1000 ha)") and refuses
to guess when the expected columns are absent — it reports what it found.
"""
from __future__ import annotations

import re

import pandas as pd

from .common import RAW, Report, write_csv
from .crosswalk import Matcher

CROPS = {"RICE": "rice", "WHEAT": "wheat", "MAIZE": "maize", "SUGARCANE": "sugarcane"}
EMPTY_COLS = ["year", "district_id", "crop", "irrigated_area_ha", "gross_cropped_area_ha", "irrigated_share_pct"]


def _find(cols: list[str], pattern: str) -> str | None:
    rx = re.compile(pattern, re.I)
    hits = [c for c in cols if rx.search(c)]
    return hits[0] if hits else None


def run(report: Report) -> pd.DataFrame:
    d = RAW / "icrisat"
    files = sorted([*d.glob("*.csv"), *d.glob("*.xlsx"), *d.glob("*.xls")]) if d.exists() else []
    if not files:
        report.source("D2_icrisat", "missing", note="manual download required")
        report.note("Irrigation", "ICRISAT DLD file not present in data/raw/icrisat/ — irrigation_district.csv is written with headers only and the irrigated-share component of the stress index is absent. See docs/MANUAL_STEPS.md.")
        df = pd.DataFrame(columns=EMPTY_COLS)
        write_csv(df, "irrigation_district.csv", report, status="awaiting manual download")
        return df
    frames = [pd.read_csv(f) if f.suffix == ".csv" else pd.read_excel(f) for f in files]
    raw = pd.concat(frames, ignore_index=True)
    cols = list(raw.columns)
    year_c = _find(cols, r"^year$")
    st_c = _find(cols, r"state\s*name")
    dist_c = _find(cols, r"dist(rict)?\s*name")
    if not (year_c and st_c and dist_c):
        report.note("Irrigation", f"ICRISAT file present but year/state/district columns not recognised. Columns found: {cols[:25]}")
        report.source("D2_icrisat", "unrecognised")
        df = pd.DataFrame(columns=EMPTY_COLS)
        write_csv(df, "irrigation_district.csv", report, status="unrecognised columns")
        return df
    m = Matcher.for_source("icrisat")
    raw["district_id"] = [m.resolve(s, x) for s, x in zip(raw[st_c], raw[dist_c])]
    report.table("crosswalk_icrisat", pd.DataFrame(m.crosswalk_rows()))
    if m.unmatched:
        report.note("Irrigation", f"Unmatched ICRISAT districts ({len(m.unmatched)}): {sorted(m.unmatched)[:60]}")
    raw = raw.dropna(subset=["district_id"])
    parts = []
    for key, crop in CROPS.items():
        irr = _find(cols, rf"^{key}\s+irrigated\s+area")
        area = _find(cols, rf"^{key}\s+area")
        if not irr or not area:
            report.note("Irrigation", f"No irrigated/area columns for {key}; skipped.")
            continue
        scale = 1000 if "1000" in irr else 1
        x = raw[[year_c, "district_id", irr, area]].copy()
        x.columns = ["year", "district_id", "irr", "area"]
        x[["irr", "area"]] = x[["irr", "area"]].apply(pd.to_numeric, errors="coerce").mask(lambda v: v < 0) * scale
        g = x.groupby(["year", "district_id"]).agg(irrigated_area_ha=("irr", lambda s: s.sum(min_count=1)), gross_cropped_area_ha=("area", lambda s: s.sum(min_count=1))).reset_index()
        g["crop"] = crop
        parts.append(g)
    gi, gc = _find(cols, r"^gross\s+irrigated\s+area"), _find(cols, r"^gross\s+cropped\s+area")
    if gi and gc:
        scale = 1000 if "1000" in gi else 1
        x = raw[[year_c, "district_id", gi, gc]].copy()
        x.columns = ["year", "district_id", "irr", "area"]
        x[["irr", "area"]] = x[["irr", "area"]].apply(pd.to_numeric, errors="coerce").mask(lambda v: v < 0) * scale
        g = x.groupby(["year", "district_id"]).agg(irrigated_area_ha=("irr", lambda s: s.sum(min_count=1)), gross_cropped_area_ha=("area", lambda s: s.sum(min_count=1))).reset_index()
        g["crop"] = "all"
        parts.append(g)
    df = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=EMPTY_COLS[:-1])
    df["irrigated_share_pct"] = (100 * df["irrigated_area_ha"] / df["gross_cropped_area_ha"].where(df["gross_cropped_area_ha"] > 0)).clip(upper=100).round(1)
    over = (100 * df["irrigated_area_ha"] / df["gross_cropped_area_ha"]) > 100.5
    if over.any():
        report.note("Irrigation", f"{int(over.sum())} rows had irrigated area > cropped area; share capped at 100 % and listed.")
    df = df[EMPTY_COLS]
    write_csv(df, "irrigation_district.csv", report, grain="year × district × crop")
    report.source("D2_icrisat", "loaded", rows=len(df))
    return df
