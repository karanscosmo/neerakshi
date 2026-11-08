"""District climate data from NASA POWER (MERRA-2 reanalysis).

POWER provides genuine gridded climate reanalysis. It is *not* the IMD gauge
network; provenance is recorded explicitly in every prepared row.
"""
from __future__ import annotations

import calendar
import csv
import math
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from .config import (
    PREPARED,
    RAW,
    LATEST_YEAR,
    NORMAL_END_YEAR,
    NORMAL_START_YEAR,
    RAINFALL_END,
    RAINFALL_START,
)
from .io_utils import ensure_dir, get_json, write_json

POWER_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
POWER_CACHE = RAW / "power"
SOURCE = "NASA POWER / MERRA-2 monthly reanalysis"
PROVENANCE = "reanalysis"


def _fetch_point(district: dict) -> tuple[str, dict | None, str | None]:
    cache = POWER_CACHE / f"{district['district_id']}.json"
    params = {
        "parameters": "PRECTOTCORR,T2M,GWETROOT",
        "community": "AG",
        "longitude": district["centroid_lon"],
        "latitude": district["centroid_lat"],
        "start": RAINFALL_START[:4],
        "end": RAINFALL_END[:4],
        "format": "JSON",
    }
    try:
        payload = get_json(POWER_URL, params=params, cache=cache, timeout=90)
        return district["district_id"], payload, None
    except Exception as exc:  # noqa: BLE001
        return district["district_id"], None, str(exc)


def _month_days(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def fetch_climate(districts: list[dict], max_workers: int | None = None) -> dict:
    ensure_dir(POWER_CACHE)
    workers = max_workers or min(10, max(2, (os.cpu_count() or 4)))
    results: dict[str, dict] = {}
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_fetch_point, d): d for d in districts}
        done = 0
        for future in as_completed(futures):
            district_id, payload, error = future.result()
            done += 1
            if payload:
                results[district_id] = payload
            else:
                errors.append(f"{futures[future]['district_name']}: {error}")
            if done % 50 == 0 or done == len(districts):
                print(f"  climate: {done}/{len(districts)} districts")
    return {"payloads": results, "errors": errors}


def _extract_series(payload: dict) -> list[dict]:
    params = payload.get("properties", {}).get("parameter", {})
    rain = params.get("PRECTOTCORR", {})
    temp = params.get("T2M", {})
    soil = params.get("GWETROOT", {})
    fill = payload.get("header", {}).get("fill_value", -999.0)
    rows: list[dict] = []
    for key in sorted(rain):
        # Monthly keys are YYYYMM; YYYY13 is POWER's annual row and is skipped.
        if len(key) != 6:
            continue
        year, month = int(key[:4]), int(key[4:])
        if month > 12:
            continue
        value = rain[key]
        if value is None or value == fill:
            continue
        rain_mm = value * _month_days(year, month)
        temp_value = temp.get(key)
        soil_value = soil.get(key)
        rows.append({
            "year": year,
            "month": month,
            "rainfall_mm": round(rain_mm, 2),
            "temp_mean_c": None if temp_value in (None, fill) else round(temp_value, 2),
            "soil_moisture": None if soil_value in (None, fill) else round(soil_value, 4),
        })
    return rows


def build_climate(districts: list[dict]) -> dict:
    fetched = fetch_climate(districts)
    payloads = fetched["payloads"]
    missing = [d for d in districts if d["district_id"] not in payloads]

    monthly_rows: list[dict] = []
    season_rows: list[dict] = []
    summaries: dict[str, dict] = {}
    state_series: dict[tuple[str, int], float] = {}
    national_series: dict[int, float] = {}

    for district in districts:
        payload = payloads.get(district["district_id"])
        if not payload:
            continue
        series = _extract_series(payload)
        if not series:
            continue
        for row in series:
            monthly_rows.append({
                "district_id": district["district_id"],
                "district_name": district["district_name"],
                "state": district["state"],
                **row,
                "source": SOURCE,
                "provenance": PROVENANCE,
            })
        by_year: dict[int, list[dict]] = {}
        for row in series:
            by_year.setdefault(row["year"], []).append(row)

        annual = {year: sum(r["rainfall_mm"] for r in rows) for year, rows in by_year.items()}
        monsoon = {
            year: sum(r["rainfall_mm"] for r in rows if 6 <= r["month"] <= 9)
            for year, rows in by_year.items()
        }
        normal_years = [y for y in annual if NORMAL_START_YEAR <= y <= NORMAL_END_YEAR]
        if not normal_years:
            continue
        normal_annual = sum(annual[y] for y in normal_years) / len(normal_years)
        normal_monsoon = sum(monsoon[y] for y in normal_years) / len(normal_years)
        recent_years = sorted(y for y in annual if y >= NORMAL_START_YEAR)
        for year in recent_years:
            if year not in monsoon or normal_monsoon == 0:
                continue
            departure = (monsoon[year] - normal_monsoon) / normal_monsoon * 100
            season_rows.append({
                "district_id": district["district_id"],
                "district_name": district["district_name"],
                "state": district["state"],
                "year": year,
                "monsoon_mm": round(monsoon[year], 2),
                "annual_mm": round(annual[year], 2),
                "monsoon_normal_mm": round(normal_monsoon, 2),
                "annual_normal_mm": round(normal_annual, 2),
                "departure_pct": round(departure, 2),
                "source": SOURCE,
                "provenance": PROVENANCE,
            })
            key = (district["state"], year)
            state_series[key] = state_series.get(key, 0.0) + monsoon[year]
            national_series[year] = national_series.get(year, 0.0) + monsoon[year]

        latest = LATEST_YEAR if LATEST_YEAR in annual else max(annual)
        previous_years = [y for y in annual if y < latest]
        recent_window = [y for y in annual if latest - 4 <= y <= latest]
        baseline_window = [y for y in annual if latest - 9 <= y <= latest - 5]
        five_year = None
        if recent_window and baseline_window:
            recent_mean = sum(monsoon[y] for y in recent_window) / len(recent_window)
            baseline_mean = sum(monsoon[y] for y in baseline_window) / len(baseline_window)
            if baseline_mean:
                five_year = round((recent_mean - baseline_mean) / baseline_mean * 100, 2)
        latest_rows = by_year.get(latest, [])
        soil_values = [r["soil_moisture"] for r in latest_rows if r["soil_moisture"] is not None]
        temp_values = [r["temp_mean_c"] for r in latest_rows if r["temp_mean_c"] is not None]
        baseline_soil = [
            r["soil_moisture"]
            for y in range(NORMAL_START_YEAR, NORMAL_END_YEAR + 1)
            for r in by_year.get(y, [])
            if r["soil_moisture"] is not None
        ]
        soil_latest = sum(soil_values) / len(soil_values) if soil_values else None
        soil_normal = sum(baseline_soil) / len(baseline_soil) if baseline_soil else None
        summaries[district["district_id"]] = {
            "district_id": district["district_id"],
            "district_name": district["district_name"],
            "state": district["state"],
            "latest_year": latest,
            "monsoon_mm": round(monsoon.get(latest, 0.0), 2),
            "annual_mm": round(annual.get(latest, 0.0), 2),
            "monsoon_normal_mm": round(normal_monsoon, 2),
            "annual_normal_mm": round(normal_annual, 2),
            "departure_pct": round(
                (monsoon.get(latest, 0.0) - normal_monsoon) / normal_monsoon * 100, 2
            ) if normal_monsoon else None,
            "departure_5y_pct": five_year,
            "soil_moisture_latest": round(soil_latest, 4) if soil_latest is not None else None,
            "soil_moisture_anomaly": (
                round(soil_latest - soil_normal, 4)
                if soil_latest is not None and soil_normal is not None else None
            ),
            "temp_mean_c": round(sum(temp_values) / len(temp_values), 2) if temp_values else None,
            "years_available": len(annual),
            "source": SOURCE,
            "provenance": PROVENANCE,
        }

    monthly_rows.sort(key=lambda r: (r["state"], r["district_name"], r["year"], r["month"]))
    season_rows.sort(key=lambda r: (r["state"], r["district_name"], r["year"]))

    _write_csv(PREPARED / "rainfall_district_monthly.csv", monthly_rows)
    _write_csv(PREPARED / "rainfall_district_season.csv", season_rows)

    state_summary: dict[str, dict] = {}
    for (state, year), total in state_series.items():
        entry = state_summary.setdefault(state, {"state": state, "series": {}})
        entry["series"][str(year)] = round(total, 1)
    for state, entry in state_summary.items():
        districts_in_state = [s for s in summaries.values() if s["state"] == state]
        valid = [s["departure_pct"] for s in districts_in_state if s["departure_pct"] is not None]
        entry["mean_departure_pct"] = round(sum(valid) / len(valid), 2) if valid else None
        entry["district_count"] = len(districts_in_state)

    write_json(PREPARED / "climate_summary.json", {
        "source": SOURCE,
        "provenance": PROVENANCE,
        "note": (
            "Gridded MERRA-2 reanalysis sampled at district representative points. "
            "Not IMD rain-gauge observations. Values are monthly totals derived from "
            "POWER daily-mean precipitation rates multiplied by days in month."
        ),
        "period": {"start": RAINFALL_START, "end": RAINFALL_END},
        "districts": summaries,
        "national_monsoon_series": {str(k): round(v, 1) for k, v in sorted(national_series.items())},
        "state_summaries": state_summary,
    })

    return {
        "monthly": monthly_rows,
        "season": season_rows,
        "summaries": summaries,
        "errors": fetched["errors"],
        "missing": [d["district_name"] for d in missing],
        "national_series": national_series,
        "state_summaries": state_summary,
    }


def _write_csv(path: Path, rows: list[dict]) -> None:
    ensure_dir(path.parent)
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
