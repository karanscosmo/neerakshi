"""D6 — monthly district NDVI over cropland from Sentinel-2 L2A (Microsoft Planetary Computer).

Batch job, run on a machine with internet access (not inside Vercel):

    python -m pipeline.ndvi --states KA --start 2023-01 --end 2025-12

Method (per district, per month):
- Sentinel-2 L2A scenes intersecting the district with eo:cloud_cover < 70 %.
- Bands B04 (red), B08 (NIR) and SCL loaded at 100 m with odc-stac.
- Pixels kept only when SCL ∈ {4 vegetation, 5 bare soil} (drops cloud,
  shadow, water, snow) and ESA WorldCover 2021 class 40 (cropland).
- NDVI = (B08 − B04) / (B08 + B04) on reflectance (DN/10000; the -0.1 offset
  from processing baseline 04.00 is applied for scenes after 2022-01-25).
- ndvi_median = median NDVI over all valid cropland pixel-observations in the month;
  valid_pixel_pct = valid observations / all cropland pixel-observations.
- Months with < 5 % valid pixels are written with a null ndvi_median.

Results are appended to data/prepared/ndvi_district_monthly.csv. Nothing is
interpolated: cloudy months stay null.
"""
from __future__ import annotations

import argparse
import datetime as dt

import numpy as np
import pandas as pd

from .common import PREPARED, Report, write_csv

COLS = ["month", "district_id", "ndvi_median", "valid_pixel_pct"]
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
OFFSET_FROM = dt.date(2022, 1, 25)


def ensure_file(report: Report) -> pd.DataFrame:
    p = PREPARED / "ndvi_district_monthly.csv"
    if p.exists():
        df = pd.read_csv(p)
        report.wrote("ndvi_district_monthly.csv", df, grain="month × district (cropland mask)")
        if len(df):
            report.source("D6_ndvi", "loaded", rows=len(df), months=f"{df['month'].min()}–{df['month'].max()}")
            report.note("NDVI", f"{len(df)} district-months from {df['district_id'].nunique()} districts ({df['month'].min()} to {df['month'].max()}); {int(df['ndvi_median'].isna().sum())} months null (too cloudy).")
        else:
            report.source("D6_ndvi", "missing")
            report.note("NDVI", "ndvi_district_monthly.csv has no rows yet. Run `python -m pipeline.ndvi` on a machine that can reach planetarycomputer.microsoft.com.")
        return df
    df = pd.DataFrame(columns=COLS)
    write_csv(df, "ndvi_district_monthly.csv", report, status="not yet computed")
    report.source("D6_ndvi", "missing")
    report.note("NDVI", "ndvi_district_monthly.csv written with headers only — the batch job has not been run (needs network access to Planetary Computer).")
    return df


def district_month_ndvi(geom, start: str, end: str) -> list[tuple[str, float | None, float]]:
    import planetary_computer
    import pystac_client
    from odc.stac import load

    cat = pystac_client.Client.open(STAC, modifier=planetary_computer.sign_inplace)
    bbox = list(geom.bounds)
    items = list(cat.search(collections=["sentinel-2-l2a"], bbox=bbox, datetime=f"{start}/{end}", query={"eo:cloud_cover": {"lt": 70}}).items())
    wc = list(cat.search(collections=["esa-worldcover"], bbox=bbox).items())
    if not items or not wc:
        return []
    ds = load(items, bands=["B04", "B08", "SCL"], bbox=bbox, resolution=100, crs="EPSG:6933", groupby="solar_day", chunks={})
    lc = load(wc[-1:], bands=["map"], bbox=bbox, resolution=100, crs="EPSG:6933", like=ds).map.isel(time=0)
    import rioxarray  # noqa: F401  (registers .rio)
    from shapely.geometry import mapping

    inside = lc.rio.write_crs("EPSG:6933").rio.clip([mapping(geom)], crs="EPSG:4326", drop=False).notnull()
    crop = (lc == 40) & inside
    red = ds.B04.astype("float32")
    nir = ds.B08.astype("float32")
    times = pd.DatetimeIndex(ds.time.values)
    off = np.array([0.1 if t.date() >= OFFSET_FROM else 0.0 for t in times], dtype="float32")[:, None, None]
    red = red / 10000 - off
    nir = nir / 10000 - off
    ndvi = (nir - red) / (nir + red)
    valid = ds.SCL.isin([4, 5]) & crop
    out = []
    for month, idx in pd.Series(range(len(times)), index=times).groupby(times.to_period("M")):
        sel = idx.values
        v = valid.isel(time=sel).values
        n_all = int(crop.values.sum()) * len(sel)
        vals = ndvi.isel(time=sel).values[v]
        pct = 100 * v.sum() / n_all if n_all else 0.0
        med = float(np.nanmedian(vals)) if pct >= 5 and vals.size else None
        out.append((f"{month}-01", None if med is None else round(med, 4), round(pct, 1)))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--states", default="KA", help="comma-separated state codes")
    ap.add_argument("--start", default="2024-01")
    ap.add_argument("--end", default=dt.date.today().strftime("%Y-%m"))
    args = ap.parse_args()
    from .crosswalk import canonical_districts

    cd = canonical_districts()
    cd = cd[cd["state_code"].isin(args.states.split(","))]
    start = f"{args.start}-01"
    end = (pd.Period(args.end, "M").end_time.date()).isoformat()
    rows = []
    for r in cd.itertuples():
        try:
            for month, med, pct in district_month_ndvi(r.geometry, start, end):
                rows.append((month, r.district_id, med, pct))
            print(f"ok   {r.district_id} {r.district_name}")
        except Exception as e:  # report and continue; never fill in values
            print(f"FAIL {r.district_id} {r.district_name}: {e}")
    p = PREPARED / "ndvi_district_monthly.csv"
    old = pd.read_csv(p) if p.exists() else pd.DataFrame(columns=COLS)
    new = pd.DataFrame(rows, columns=COLS)
    allr = pd.concat([old, new]).drop_duplicates(["month", "district_id"], keep="last").sort_values(["district_id", "month"])
    allr.to_csv(p, index=False)
    print(f"wrote {len(allr)} rows → {p}")


if __name__ == "__main__":
    main()
