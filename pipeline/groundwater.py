"""D4 — groundwater depth from CGWB observation wells (1996–2017).

- Pre-monsoon = the May reading, post-monsoon = the November reading (CGWB's
  standard monitoring months).
- median_depth_mbgl = median depth to water (metres below ground level) over
  all wells read in that district and season.
- change_vs_baseline_m = median over wells of (depth − that well's own mean
  depth in the same season over the baseline 1996–2005), using only wells
  with ≥ 3 baseline readings. Positive = water table deeper than baseline
  (decline). Using each well's own baseline avoids artefacts from the monitoring
  network changing composition over time.
- Depths above GW_DEPTH_MAX_M are treated as entry errors and removed; negative
  depths (flowing/artesian wells) are kept.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .common import GW_DEPTH_MAX_M, RAW, Report, write_csv
from .crosswalk import Matcher

BASELINE = (1996, 2005)
MIN_BASELINE_OBS = 3


def run(report: Report) -> pd.DataFrame | None:
    p = RAW / "cgwb" / "CGWB_data_wide.csv"
    if not p.exists():
        report.source("D4_cgwb", "missing")
        return None
    c = pd.read_csv(p)
    c = c.drop(columns=[c.columns[0]])
    cols = [x for x in c.columns if x.startswith(("May ", "Nov "))]
    long = c.melt(id_vars=["STATE", "DISTRICT", "LAT", "LON", "SITE_TYPE", "WLCODE"], value_vars=cols, var_name="obs", value_name="depth")
    long["depth"] = pd.to_numeric(long["depth"], errors="coerce")
    long = long.dropna(subset=["depth"])
    long["season"] = np.where(long["obs"].str.startswith("May"), "pre_monsoon", "post_monsoon")
    long["year"] = long["obs"].str[-4:].astype(int)
    too_deep = long["depth"] > GW_DEPTH_MAX_M
    report.note("Groundwater", f"CGWB wells: {c['WLCODE'].nunique():,}; May/Nov readings: {len(long):,}; readings > {GW_DEPTH_MAX_M:.0f} m removed as entry errors: {int(too_deep.sum())}; negative (artesian) readings kept: {int((long['depth'] < 0).sum())}.")
    long = long[~too_deep]

    m = Matcher.for_source("cgwb")
    keymap = {k: m.resolve(*k) for k in long[["STATE", "DISTRICT"]].drop_duplicates().itertuples(index=False, name=None)}
    long["district_id"] = [keymap[(s, d)] for s, d in zip(long["STATE"], long["DISTRICT"])]
    report.table("crosswalk_cgwb", pd.DataFrame(m.crosswalk_rows()))
    um = long["district_id"].isna()
    if um.any():
        report.note("Groundwater", f"Readings dropped for unmatched districts: {int(um.sum())} — {sorted(m.unmatched)}")
    long = long[~um]

    base = long[(long["year"] >= BASELINE[0]) & (long["year"] <= BASELINE[1])]
    wb = base.groupby(["WLCODE", "season"])["depth"].agg(["mean", "count"]).reset_index()
    wb = wb[wb["count"] >= MIN_BASELINE_OBS].rename(columns={"mean": "well_baseline"})
    long = long.merge(wb[["WLCODE", "season", "well_baseline"]], on=["WLCODE", "season"], how="left")
    long["delta"] = long["depth"] - long["well_baseline"]

    g = (
        long.groupby(["year", "season", "district_id"])
        .agg(median_depth_mbgl=("depth", "median"), well_count=("WLCODE", "nunique"), change_vs_baseline_m=("delta", "median"), baseline_wells=("delta", "count"))
        .reset_index()
    )
    g["median_depth_mbgl"] = g["median_depth_mbgl"].round(2)
    g["change_vs_baseline_m"] = g["change_vs_baseline_m"].round(2)
    g = g.sort_values(["district_id", "season", "year"])
    write_csv(g, "groundwater_district.csv", report, grain="year × season × district", baseline=f"{BASELINE[0]}–{BASELINE[1]}")
    report.note("Groundwater", f"District-season rows: {len(g):,}; districts with any reading: {g['district_id'].nunique()}; years {g['year'].min()}–{g['year'].max()}.")
    cov = g[g["season"] == "pre_monsoon"].groupby("year")["district_id"].nunique().rename("districts_pre_monsoon").reset_index()
    report.table("groundwater_coverage_by_year", cov)
    report.source("D4_cgwb", "loaded", rows=len(g), years=f"{g['year'].min()}–{g['year'].max()}")
    states = sorted(c["STATE"].unique())
    report.note("Groundwater", f"State codes present in the CGWB file: {', '.join(states)} — other states have no groundwater data in this source.")
    return g
