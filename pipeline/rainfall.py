"""D3 — monsoon and rainfall.

Three real inputs, used in this order of preference (spatial_basis column):

1. ``imd_grid_district`` — IMD 0.25° daily gridded rainfall averaged over the
   grid cells whose centres fall inside each district. Used only when the
   yearly .grd files exist in data/raw/imd/grid (see docs/MANUAL_STEPS.md).
2. ``imd_subdivision`` — IMD sub-divisional monthly rainfall 1901–2015
   (data.gov.in). Each district takes the value of its meteorological
   subdivision. Normal = 1951–2000 mean (IMD's long-period-average base used
   until 2022).
3. ``imd_grid_state`` — JJAS totals 1981–2025 from IMD gridded data,
   area-weighted to states (hssling/elnino-heat-india, CC BY 4.0). Normal =
   1981–2010 mean. Used for years after 2015 when (1) is absent. Andaman &
   Nicobar (no valid grid cell) and Lakshadweep (a Kerala-coast proxy) are
   excluded, as their authors recommend.

The all-India JJAS series is the area-weighted mean of subdivisions (weights
= summed Census 2011 district areas), computed only for years with ≥ 90 % of
mapped area reporting.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .common import RAW, REF, Report, write_csv

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
NORMAL_SUBDIV = (1951, 2000)
DISTRICT_MONTHLY_FROM = 1971

STATE_UNIT = {"AP": "AP_TG", "DN": "DNH_DD", "DD": "DNH_DD"}
EXCLUDED_STATE_UNITS = {"AN": "no valid IMD grid cell", "LD": "Kerala-coast proxy, not island rainfall"}


def _subdivision_monthly(report: Report) -> pd.DataFrame | None:
    p = RAW / "imd" / "rainfall_in_india_1901-2015.csv"
    if not p.exists():
        report.source("D3_subdiv", "missing")
        return None
    r = pd.read_csv(p)
    r["SUBDIVISION"] = r["SUBDIVISION"].str.strip().str.upper()
    long = r.melt(id_vars=["SUBDIVISION", "YEAR"], value_vars=MONTHS, var_name="m", value_name="rain_mm")
    long["month"] = long["m"].map({m: i + 1 for i, m in enumerate(MONTHS)})
    long["rain_mm"] = pd.to_numeric(long["rain_mm"], errors="coerce")
    neg = long["rain_mm"] < 0
    if neg.any():
        report.note("Rainfall", f"Negative monthly values set to null: {int(neg.sum())}.")
        long.loc[neg, "rain_mm"] = np.nan
    long = long.rename(columns={"SUBDIVISION": "subdivision", "YEAR": "year"})[["subdivision", "year", "month", "rain_mm"]]
    miss = long["rain_mm"].isna().sum()
    report.note("Rainfall", f"IMD sub-divisional file: {r['SUBDIVISION'].nunique()} subdivisions, {r['YEAR'].min()}–{r['YEAR'].max()}, {miss} missing monthly values (kept null).")
    report.source("D3_subdiv", "loaded", rows=len(long))
    return long


def _seasonal(monthly: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """JJAS, OND and annual totals; a season is null unless every month is present."""
    out = []
    for season, months in (("jjas", [6, 7, 8, 9]), ("ond", [10, 11, 12]), ("annual", list(range(1, 13)))):
        sub = monthly[monthly["month"].isin(months)]
        g = sub.groupby(keys + ["year"])["rain_mm"].agg(["sum", "count"]).reset_index()
        g["rain_mm"] = g["sum"].where(g["count"] == len(months))
        g["season"] = season
        out.append(g[keys + ["year", "season", "rain_mm"]])
    return pd.concat(out, ignore_index=True)


def _with_normal(df: pd.DataFrame, keys: list[str], period: tuple[int, int], min_years: int) -> pd.DataFrame:
    base = df[(df["year"] >= period[0]) & (df["year"] <= period[1])]
    n = base.groupby(keys)["rain_mm"].agg(["mean", "count"]).reset_index()
    n["normal_rain_mm"] = n["mean"].where(n["count"] >= min_years)
    df = df.merge(n[keys + ["normal_rain_mm"]], on=keys, how="left")
    df["departure_pct"] = (100 * (df["rain_mm"] - df["normal_rain_mm"]) / df["normal_rain_mm"]).round(1)
    return df


def _grid_district(districts: pd.DataFrame, report: Report) -> pd.DataFrame | None:
    """District monthly rainfall from IMD 0.25° gridded files, if present."""
    gdir = RAW / "imd" / "grid"
    files = sorted(gdir.glob("*.grd")) if gdir.exists() else []
    if not files:
        report.source("D3_grid", "missing", note="IMD gridded files not present; using sub-divisional series.")
        report.note("Rainfall", "IMD 0.25° gridded files not found in data/raw/imd/grid — district values use sub-divisional rainfall (see MANUAL_STEPS).")
        return None
    import geopandas as gpd
    import imdlib

    years = sorted(int(f.stem) for f in files if f.stem.isdigit())
    data = imdlib.open_data("rain", years[0], years[-1], fn_format="yearwise", file_dir=str(gdir.parent))
    ds = data.get_xarray()
    da = ds["rain"].where(ds["rain"] >= 0)
    monthly = da.resample(time="MS").sum(min_count=28)
    lat, lon = np.meshgrid(monthly["lat"].values, monthly["lon"].values, indexing="ij")
    pts = gpd.GeoDataFrame({"iy": np.repeat(np.arange(lat.shape[0]), lat.shape[1]), "ix": np.tile(np.arange(lat.shape[1]), lat.shape[0])}, geometry=gpd.points_from_xy(lon.ravel(), lat.ravel()), crs=4326)
    from .crosswalk import canonical_districts

    polys = canonical_districts()[["district_id", "geometry"]]
    j = gpd.sjoin(pts, polys, predicate="within")
    rows = []
    arr = monthly.values  # (time, lat, lon)
    times = pd.DatetimeIndex(monthly["time"].values)
    for did, cells in j.groupby("district_id"):
        vals = arr[:, cells["iy"].values, cells["ix"].values]
        mean = np.nanmean(vals, axis=1)
        for t, v in zip(times, mean):
            rows.append((did, t.year, t.month, None if np.isnan(v) else round(float(v), 1)))
    out = pd.DataFrame(rows, columns=["district_id", "year", "month", "rain_mm"])
    no_cell = sorted(set(districts["district_id"]) - set(out["district_id"]))
    report.note("Rainfall", f"IMD grid: {len(files)} yearly files ({years[0]}–{years[-1]}); {out['district_id'].nunique()} districts with ≥1 grid cell; {len(no_cell)} without (fall back to subdivision).")
    report.source("D3_grid", "loaded", rows=len(out), years=f"{years[0]}–{years[-1]}")
    return out


def run(report: Report, districts: pd.DataFrame) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    sm = _subdivision_monthly(report)
    d = districts[["district_id", "state_code", "imd_subdivision", "area_km2"]]

    if sm is not None:
        known = set(sm["subdivision"])
        mapped = set(d["imd_subdivision"].dropna())
        if mapped - known:
            report.note("Rainfall", f"Mapped subdivisions not in IMD file: {sorted(mapped - known)}")
        # Monthly normal per subdivision
        sm = _with_normal(sm, ["subdivision", "month"], NORMAL_SUBDIV, 40)
        ss = _with_normal(_seasonal(sm[["subdivision", "year", "month", "rain_mm"]], ["subdivision"]), ["subdivision", "season"], NORMAL_SUBDIV, 40)

        # Monsoon series: subdivision + area-weighted all-India
        area = d.groupby("imd_subdivision")["area_km2"].sum()
        jj = ss[ss["season"] == "jjas"].copy()
        jj["w"] = jj["subdivision"].map(area)
        rows = []
        tot = area[area.index.isin(known)].sum()
        for y, g in jj.dropna(subset=["rain_mm", "w"]).groupby("year"):
            cov = g["w"].sum() / tot
            if cov >= 0.9:
                rows.append((y, float((g["rain_mm"] * g["w"]).sum() / g["w"].sum()), round(cov * 100, 1)))
        india = pd.DataFrame(rows, columns=["year", "jjas_mm", "area_coverage_pct"])
        nb = india[(india["year"] >= NORMAL_SUBDIV[0]) & (india["year"] <= NORMAL_SUBDIV[1])]["jjas_mm"].mean()
        india["normal_mm"] = nb
        india["departure_pct"] = (100 * (india["jjas_mm"] - nb) / nb).round(1)
        report.note(
            "Rainfall",
            f"All-India JJAS (area-weighted subdivisions) {NORMAL_SUBDIV[0]}–{NORMAL_SUBDIV[1]} mean = {nb:.0f} mm "
            f"(IMD's published LPA for that base period is 890 mm — a consistency check, not a calibration).",
        )
        ms = [
            pd.DataFrame({"region_type": "india", "region_id": "IN", "region_name": "All India", "year": india["year"], "jjas_mm": india["jjas_mm"].round(1), "normal_mm": round(nb, 1), "departure_pct": india["departure_pct"], "source": "imd_subdivision_area_weighted"}),
            pd.DataFrame({"region_type": "subdivision", "region_id": jj["subdivision"], "region_name": jj["subdivision"].str.title(), "year": jj["year"], "jjas_mm": jj["rain_mm"].round(1), "normal_mm": jj["normal_rain_mm"].round(1), "departure_pct": jj["departure_pct"], "source": "imd_subdivision"}),
        ]
    else:
        sm, ss, ms = None, None, []

    # State-level JJAS from IMD grid (1981–2025)
    st_path = RAW / "imd" / "climate_unit_year.csv"
    st = None
    if st_path.exists():
        c = pd.read_csv(st_path)
        c = c[~c["unit_id"].isin(EXCLUDED_STATE_UNITS)]
        st = c[["unit_id", "year", "rain_jjas_mm", "rain_jjas_normal_mm", "rain_jjas_dep_pct"]].rename(columns={"rain_jjas_mm": "jjas_mm", "rain_jjas_normal_mm": "normal_mm", "rain_jjas_dep_pct": "departure_pct"})
        ms.append(pd.DataFrame({"region_type": "state", "region_id": st["unit_id"], "region_name": st["unit_id"], "year": st["year"], "jjas_mm": st["jjas_mm"].round(1), "normal_mm": st["normal_mm"].round(1), "departure_pct": st["departure_pct"].round(1), "source": "imd_grid_state_hssling"}))
        # All-India from state units, area-weighted (Census 2011 district areas summed per unit); years with ≥ 90 % area.
        ua = d.assign(unit_id=d["state_code"].map(lambda s_: STATE_UNIT.get(s_, s_))).groupby("unit_id")["area_km2"].sum()
        tot_area = ua[ua.index.isin(st["unit_id"].unique())].sum()
        rows2 = []
        for y, g in st.dropna(subset=["jjas_mm"]).groupby("year"):
            w = g["unit_id"].map(ua)
            cov = w.sum() / tot_area
            if cov >= 0.9:
                rows2.append((int(y), float((g["jjas_mm"] * w).sum() / w.sum()), round(cov * 100, 1)))
        ig = pd.DataFrame(rows2, columns=["year", "jjas_mm", "cov"])
        nb2 = ig[(ig["year"] >= 1981) & (ig["year"] <= 2010)]["jjas_mm"].mean()
        ig["departure_pct"] = (100 * (ig["jjas_mm"] - nb2) / nb2).round(1)
        ms.append(pd.DataFrame({"region_type": "india_grid", "region_id": "IN", "region_name": "All India (IMD grid, state-weighted)", "year": ig["year"], "jjas_mm": ig["jjas_mm"].round(1), "normal_mm": round(nb2, 1), "departure_pct": ig["departure_pct"], "source": "imd_grid_state_area_weighted"}))
        report.note("Rainfall", f"All-India JJAS from state units (area-weighted) {int(ig['year'].min())}–{int(ig['year'].max())}; 1981–2010 mean = {nb2:.0f} mm. Latest: {int(ig['year'].iloc[-1])} = {ig['departure_pct'].iloc[-1]:+.1f}%.")
        report.note("Rainfall", f"State JJAS (IMD grid, area-weighted): {c['unit_id'].nunique()} units, {c['year'].min()}–{c['year'].max()}; excluded {EXCLUDED_STATE_UNITS}.")
        report.source("D3_state_jjas", "loaded", rows=len(st), years=f"{c['year'].min()}–{c['year'].max()}")
    if ms:
        out["monsoon_series"] = pd.concat(ms, ignore_index=True)
        write_csv(out["monsoon_series"], "monsoon_series.csv", report, grain="region × year (JJAS)")

    # ── District-level tables ────────────────────────────────────────────
    grid = _grid_district(d, report)
    season_parts, month_parts = [], []
    if sm is not None:
        dm = d[["district_id", "imd_subdivision"]].merge(sm, left_on="imd_subdivision", right_on="subdivision")
        dm = dm[dm["year"] >= DISTRICT_MONTHLY_FROM]
        dm["spatial_basis"] = "imd_subdivision"
        month_parts.append(dm[["year", "month", "district_id", "rain_mm", "normal_rain_mm", "departure_pct", "spatial_basis"]])
        ds_ = d[["district_id", "imd_subdivision"]].merge(ss, left_on="imd_subdivision", right_on="subdivision")
        ds_["spatial_basis"] = "imd_subdivision"
        ds_["normal_period"] = f"{NORMAL_SUBDIV[0]}-{NORMAL_SUBDIV[1]}"
        season_parts.append(ds_[["year", "district_id", "season", "rain_mm", "normal_rain_mm", "departure_pct", "spatial_basis", "normal_period"]])
    if grid is not None:
        gm = _with_normal(grid, ["district_id", "month"], (1991, 2020), 25)
        gm["spatial_basis"] = "imd_grid_district"
        gs = _with_normal(_seasonal(grid, ["district_id"]), ["district_id", "season"], (1991, 2020), 25)
        gs["spatial_basis"] = "imd_grid_district"
        gs["normal_period"] = "1991-2020"
        month_parts.insert(0, gm[["year", "month", "district_id", "rain_mm", "normal_rain_mm", "departure_pct", "spatial_basis"]])
        season_parts.insert(0, gs[["year", "district_id", "season", "rain_mm", "normal_rain_mm", "departure_pct", "spatial_basis", "normal_period"]])
    if st is not None:
        dst = d[["district_id", "state_code"]].copy()
        dst["unit_id"] = dst["state_code"].map(lambda s: STATE_UNIT.get(s, s))
        x = dst.merge(st, on="unit_id")
        x = x.rename(columns={"jjas_mm": "rain_mm", "normal_mm": "normal_rain_mm"})
        x["season"] = "jjas"
        x["spatial_basis"] = "imd_grid_state"
        x["normal_period"] = "1981-2010"
        x["departure_pct"] = x["departure_pct"].round(1)
        season_parts.append(x[["year", "district_id", "season", "rain_mm", "normal_rain_mm", "departure_pct", "spatial_basis", "normal_period"]])

    if season_parts:
        allp = pd.concat(season_parts, ignore_index=True)
        # Keep the finest basis available for each (district, year, season)
        rank = {"imd_grid_district": 0, "imd_subdivision": 1, "imd_grid_state": 2}
        allp["r"] = allp["spatial_basis"].map(rank)
        allp = allp.dropna(subset=["rain_mm"]).sort_values("r").drop_duplicates(["year", "district_id", "season"]).drop(columns="r")
        allp = allp.sort_values(["district_id", "season", "year"])
        allp["rain_mm"] = allp["rain_mm"].round(1)
        allp["normal_rain_mm"] = allp["normal_rain_mm"].round(1)
        out["rainfall_district_season"] = allp
        write_csv(allp, "rainfall_district_season.csv", report, grain="year × district × season")
        report.table("rain_basis_by_year", allp.groupby(["spatial_basis"])["year"].agg(["min", "max", "count"]).reset_index())
    if month_parts:
        mp = pd.concat(month_parts, ignore_index=True)
        mp = mp.drop_duplicates(["year", "month", "district_id"], keep="first").sort_values(["district_id", "year", "month"])
        mp["rain_mm"] = mp["rain_mm"].round(1)
        mp["normal_rain_mm"] = mp["normal_rain_mm"].round(1)
        out["rainfall_district_monthly"] = mp
        write_csv(mp, "rainfall_district_monthly.csv", report, grain=f"year × month × district ({DISTRICT_MONTHLY_FROM}+)")
    if sm is not None:
        sub = sm[["subdivision", "year", "month", "rain_mm", "normal_rain_mm", "departure_pct"]].copy()
        sub["normal_rain_mm"] = sub["normal_rain_mm"].round(1)
        out["rainfall_subdivision_monthly"] = sub
        write_csv(sub, "rainfall_subdivision_monthly.csv", report, grain="year × month × IMD subdivision (1901–2015)")
    return out
