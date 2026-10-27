"""D1 — district × season × crop area, production and yield (APY, DES MoA&FW).

Rules applied (each logged in the validation report):
- whitespace stripped; four target crops kept via data/reference/crop_mapping.csv
- unknown production stays null (never zero); yield only when area > 0 and production present
- yields above documented thresholds are excluded (row dropped, listed)
- districts mapped to Census 2011 ids via the crosswalk; districts carved out after
  2011 are summed into their principal parent so series keep 2011 boundaries
- seasons are preserved; the annual table sums seasons (the mirror already
  removed the "Total" season rows, so this does not double count)
"""
from __future__ import annotations

import pandas as pd

from .common import RAW, REF, YIELD_MAX_T_PER_HA, Report, write_csv
from .crosswalk import Matcher

SEASON_MAP = {
    "Kharif": "kharif",
    "Rabi": "rabi",
    "Autumn": "autumn",
    "Summer": "summer",
    "Winter": "winter",
    "Whole Year": "whole_year",
}


def run(report: Report) -> pd.DataFrame | None:
    p = RAW / "apy" / "crop_production.csv"
    if not p.exists():
        report.source("D1_apy", "missing")
        return None
    a = pd.read_csv(p)
    n0 = len(a)
    for c in ("State_Name", "District_Name", "Season", "Crop"):
        a[c] = a[c].astype(str).str.strip()
    cm = pd.read_csv(REF / "crop_mapping.csv")
    cm = cm[cm["source"] == "apy"]
    a = a.merge(cm[["source_crop", "crop"]], left_on="Crop", right_on="source_crop", how="inner")
    report.note("Crops", f"APY raw rows: {n0:,}; rows for target crops (rice, wheat, maize, sugarcane): {len(a):,}.")

    dupe = a.duplicated(["State_Name", "District_Name", "Crop_Year", "Season", "Crop"], keep="first")
    if dupe.any():
        report.note("Crops", f"Exact duplicate keys dropped: {int(dupe.sum())}.")
    a = a[~dupe]

    a["season"] = a["Season"].map(SEASON_MAP)
    unk = a["season"].isna()
    if unk.any():
        report.note("Crops", f"Rows with unknown season dropped: {int(unk.sum())} ({sorted(a.loc[unk, 'Season'].unique())}).")
    a = a[~unk]

    neg = (a["Area"] < 0) | (a["Production"] < 0)
    if neg.any():
        report.note("Crops", f"Rows with negative area or production dropped: {int(neg.sum())}.")
    a = a[~neg]

    a["yield_raw"] = a["Production"] / a["Area"].where(a["Area"] > 0)
    a["ymax"] = a["crop"].map(YIELD_MAX_T_PER_HA)
    bad = a["yield_raw"] > a["ymax"]
    excluded = a.loc[bad, ["State_Name", "District_Name", "Crop_Year", "Season", "crop", "Area", "Production", "yield_raw"]]
    report.table("crops_excluded_yield", excluded.round(2))
    report.note(
        "Crops",
        f"Rows excluded for implausible yield (> {YIELD_MAX_T_PER_HA} t/ha): {len(excluded):,} "
        f"({excluded.groupby('crop').size().to_dict()}).",
    )
    a = a[~bad]
    report.note("Crops", f"Rows with missing production kept with null production/yield: {int(a['Production'].isna().sum()):,}.")

    m = Matcher.for_source("apy")
    a["district_id"] = [m.resolve(s, d) for s, d in zip(a["State_Name"], a["District_Name"])]
    report.table("crosswalk_apy", pd.DataFrame(m.crosswalk_rows()))
    um = a["district_id"].isna()
    if um.any():
        report.note("Crops", f"Rows dropped for unmatched districts: {int(um.sum())} — {sorted(m.unmatched)}")
    a = a[~um]
    carved = sum(1 for v in m.matched.values() if v[1] == "carved_principal_parent")
    report.note("Crops", f"Source districts summed into a Census 2011 parent (carved after 2011): {carved}.")

    # Aggregate to canonical district (sum; production stays null if all parts null).
    g = (
        a.groupby(["Crop_Year", "district_id", "season", "crop"])
        .agg(area_ha=("Area", "sum"), production_t=("Production", lambda s: s.sum(min_count=1)), parts=("Area", "size"))
        .reset_index()
        .rename(columns={"Crop_Year": "year"})
    )
    g["yield_t_per_ha"] = (g["production_t"] / g["area_ha"].where(g["area_ha"] > 0)).round(3)
    g = g.drop(columns="parts").sort_values(["year", "district_id", "season", "crop"])
    write_csv(g, "crop_production.csv", report, grain="year × district × season × crop")

    ann = (
        g.groupby(["year", "district_id", "crop"])
        .agg(area_ha=("area_ha", "sum"), production_t=("production_t", lambda s: s.sum(min_count=1)), seasons=("season", "nunique"))
        .reset_index()
    )
    # A season with area but no production makes the annual yield incomparable: leave it null.
    has_null = g[g["production_t"].isna()].groupby(["year", "district_id", "crop"]).size()
    ann = ann.set_index(["year", "district_id", "crop"])
    ann.loc[ann.index.isin(has_null.index), "production_t"] = float("nan")
    ann = ann.reset_index()
    ann["yield_t_per_ha"] = (ann["production_t"] / ann["area_ha"].where(ann["area_ha"] > 0)).round(3)
    write_csv(ann, "crop_district_annual.csv", report, grain="year × district × crop (seasons summed)")

    years = sorted(g["year"].unique())
    report.note("Crops", f"Years covered: {years[0]}–{years[-1]}; districts: {g['district_id'].nunique()}.")
    cov = g.groupby("year")["district_id"].nunique().rename("districts")
    report.table("crops_coverage_by_year", cov.reset_index())
    report.source("D1_apy", "loaded", rows=len(g), years=f"{years[0]}–{years[-1]}")
    return g
