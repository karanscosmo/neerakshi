"""Water Stress Index (Neerakshi composite — NOT an official index).

stress_index_0_100 = 100 × mean of the available percentile-ranked components
(each in [0, 1], higher = more stress), computed only when ≥ 2 components exist:

- rain_score: percentile rank of the NEGATIVE mean JJAS departure over the last
  5 years with data (larger deficit → higher score)
- gw_score: percentile rank of the latest pre-monsoon median depth to water
  (deeper → higher score), latest year within the last 5 years of the series
- irrigation_score: percentile rank of the irrigated share of gross cropped
  area, latest year (more dependence on irrigation → higher score)

Equal weights. Percentiles are national (all districts with that component).
"""
from __future__ import annotations

import pandas as pd

from .common import Report, write_csv

WINDOW = 5


def run(report: Report, districts: pd.DataFrame, rain: pd.DataFrame | None, gw: pd.DataFrame | None, irr: pd.DataFrame | None) -> pd.DataFrame:
    out = districts[["district_id", "state_code"]].copy()
    meta = {}
    if rain is not None and len(rain):
        jj = rain[rain["season"] == "jjas"].dropna(subset=["departure_pct"])
        last = int(jj["year"].max())
        w = jj[jj["year"] > last - WINDOW]
        r = w.groupby("district_id").agg(rain_departure_5y_pct=("departure_pct", "mean"), rain_years=("year", "nunique"), rain_basis=("spatial_basis", lambda s: ",".join(sorted(set(s)))))
        r = r[r["rain_years"] >= 3]
        out = out.merge(r, on="district_id", how="left")
        out["rain_score"] = (-out["rain_departure_5y_pct"]).rank(pct=True)
        out["rain_period"] = f"{last - WINDOW + 1}-{last}"
        meta["rain"] = f"JJAS departure, mean of {last - WINDOW + 1}–{last}"
    else:
        out[["rain_departure_5y_pct", "rain_score", "rain_period", "rain_basis"]] = None
    if gw is not None and len(gw):
        pre = gw[(gw["season"] == "pre_monsoon")].dropna(subset=["median_depth_mbgl"])
        last = int(pre["year"].max())
        pre = pre[pre["year"] > last - WINDOW].sort_values("year").groupby("district_id").tail(1)
        out = out.merge(pre[["district_id", "median_depth_mbgl", "year"]].rename(columns={"median_depth_mbgl": "gw_depth_mbgl", "year": "gw_year"}), on="district_id", how="left")
        out["gw_score"] = out["gw_depth_mbgl"].rank(pct=True)
        meta["gw"] = f"latest pre-monsoon median depth within {last - WINDOW + 1}–{last}"
    else:
        out[["gw_depth_mbgl", "gw_year", "gw_score"]] = None
    if irr is not None and len(irr):
        a = irr[irr["crop"] == "all"].dropna(subset=["irrigated_share_pct"]).sort_values("year").groupby("district_id").tail(1)
        out = out.merge(a[["district_id", "irrigated_share_pct", "year"]].rename(columns={"year": "irrigation_year"}), on="district_id", how="left")
        out["irrigation_score"] = out["irrigated_share_pct"].rank(pct=True)
        meta["irr"] = "latest irrigated share of gross cropped area"
    else:
        out["irrigated_share_pct"] = None
        out["irrigation_year"] = None
        out["irrigation_score"] = None
    comps = out[["rain_score", "gw_score", "irrigation_score"]].astype(float)
    out["components_used"] = comps.notna().sum(axis=1)
    out["stress_index_0_100"] = (100 * comps.mean(axis=1, skipna=True)).where(out["components_used"] >= 2).round(1)
    out["rank_national"] = out["stress_index_0_100"].rank(ascending=False, method="min").astype("Int64")
    out["rank_state"] = out.groupby("state_code")["stress_index_0_100"].rank(ascending=False, method="min").astype("Int64")
    for c in ("rain_score", "gw_score", "irrigation_score"):
        out[c] = out[c].astype(float).round(3)
    out["rain_departure_5y_pct"] = out["rain_departure_5y_pct"].astype(float).round(1)
    cols = ["district_id", "rain_period", "rain_basis", "rain_departure_5y_pct", "rain_score", "gw_year", "gw_depth_mbgl", "gw_score", "irrigation_year", "irrigated_share_pct", "irrigation_score", "components_used", "stress_index_0_100", "rank_national", "rank_state"]
    out = out[cols].sort_values("rank_national")
    write_csv(out, "water_stress_index.csv", report, grain="district (latest)", components=meta)
    n = int(out["stress_index_0_100"].notna().sum())
    report.note("Water Stress Index", f"Components: {meta}. Districts with an index (≥2 components): {n} of {len(out)}. Components used: {out['components_used'].value_counts().sort_index().to_dict()}.")
    return out
