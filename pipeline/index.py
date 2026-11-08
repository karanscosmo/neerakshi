"""Composite water-stress index, atlas summary and validation report."""
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .config import (
    CROP_REFERENCE,
    FIXTURE_PROVENANCE,
    PREPARED,
    LATEST_YEAR,
)
from .io_utils import write_json

INDEX_VERSION = "0.1.0"


def _percentile(series: pd.Series) -> pd.Series:
    return series.rank(pct=True, method="average") * 100.0


def build_index(districts: list[dict], climate: dict, fixtures: dict) -> dict:
    district_df = pd.DataFrame([
        {k: v for k, v in d.items() if k != "geom"} for d in districts
    ])

    climate_df = pd.DataFrame(list(climate["summaries"].values()))
    if climate_df.empty:
        climate_df = pd.DataFrame(columns=["district_id", "departure_pct", "departure_5y_pct"])
    else:
        climate_df = climate_df.drop(columns=["district_name", "state"], errors="ignore")

    gw = pd.DataFrame(fixtures["groundwater"])
    gw_latest = gw[gw["year"] == gw["year"].max()].copy()
    gw_latest["groundwater_depth_m"] = gw_latest["pre_monsoon_depth_m"]
    gw_latest = gw_latest[[
        "district_id", "groundwater_depth_m", "pre_monsoon_depth_m",
        "post_monsoon_depth_m", "year",
    ]].rename(columns={"year": "groundwater_year"})

    irr = pd.DataFrame(fixtures["irrigation"])
    irr_latest = irr[irr["year"] == irr["year"].max()].copy()
    irr_latest = irr_latest[[
        "district_id", "irrigated_share_pct", "irrigated_area_ha",
        "net_sown_area_ha", "year",
    ]].rename(columns={"year": "irrigation_year"})

    merged = district_df.merge(climate_df, on="district_id", how="left")
    merged = merged.merge(gw_latest, on="district_id", how="left")
    merged = merged.merge(irr_latest, on="district_id", how="left")

    # Component direction: higher score == greater stress / vulnerability.
    merged["rainfall_score"] = _percentile(-merged["departure_5y_pct"].fillna(
        merged["departure_pct"]
    ))
    merged["groundwater_score"] = _percentile(merged["groundwater_depth_m"])
    merged["irrigation_score"] = _percentile(100.0 - merged["irrigated_share_pct"])

    merged["components_available"] = (
        merged[["rainfall_score", "groundwater_score", "irrigation_score"]]
        .notna().sum(axis=1)
    )
    merged["stress_index"] = merged[
        ["rainfall_score", "groundwater_score", "irrigation_score"]
    ].mean(axis=1, skipna=True).round(2)

    def classify(value: float) -> str:
        if pd.isna(value):
            return "Unavailable"
        if value < 30:
            return "Low"
        if value < 55:
            return "Moderate"
        if value < 75:
            return "High"
        return "Severe"

    merged["stress_class"] = merged["stress_index"].apply(classify)

    output_cols = [
        "district_id", "district_name", "state", "centroid_lon", "centroid_lat",
        "area_km2", "departure_pct", "departure_5y_pct", "monsoon_mm",
        "monsoon_normal_mm", "soil_moisture_latest", "soil_moisture_anomaly",
        "groundwater_depth_m", "pre_monsoon_depth_m", "post_monsoon_depth_m",
        "groundwater_year", "irrigated_share_pct", "irrigated_area_ha",
        "net_sown_area_ha", "irrigation_year", "rainfall_score", "groundwater_score",
        "irrigation_score", "stress_index", "stress_class", "components_available",
    ]
    if "temp_mean_c" in merged.columns:
        output_cols.insert(9, "temp_mean_c")
    output = merged[output_cols].copy()
    output["rainfall_provenance"] = "reanalysis"
    output["groundwater_provenance"] = FIXTURE_PROVENANCE
    output["irrigation_provenance"] = FIXTURE_PROVENANCE
    output["index_version"] = INDEX_VERSION
    output.to_csv(PREPARED / "water_stress_index.csv", index=False)

    atlas_districts = []
    for _, row in output.iterrows():
        atlas_districts.append({
            "id": row["district_id"],
            "name": row["district_name"],
            "state": row["state"],
            "centroid": [round(row["centroid_lon"], 4), round(row["centroid_lat"], 4)],
            "areaKm2": None if pd.isna(row["area_km2"]) else round(float(row["area_km2"]), 1),
            "rainfall": {
                "departurePct": _num(row.get("departure_pct")),
                "departure5yPct": _num(row.get("departure_5y_pct")),
                "monsoonMm": _num(row.get("monsoon_mm")),
                "normalMm": _num(row.get("monsoon_normal_mm")),
                "soilMoisture": _num(row.get("soil_moisture_latest")),
                "soilMoistureAnomaly": _num(row.get("soil_moisture_anomaly")),
                "tempC": _num(row.get("temp_mean_c")),
                "provenance": "reanalysis",
                "source": "NASA POWER / MERRA-2",
            },
            "groundwater": {
                "depthM": _num(row.get("groundwater_depth_m")),
                "preMonsoonM": _num(row.get("pre_monsoon_depth_m")),
                "postMonsoonM": _num(row.get("post_monsoon_depth_m")),
                "year": _num(row.get("groundwater_year")),
                "provenance": FIXTURE_PROVENANCE,
            },
            "irrigation": {
                "sharePct": _num(row.get("irrigated_share_pct")),
                "irrigatedAreaHa": _num(row.get("irrigated_area_ha")),
                "netSownAreaHa": _num(row.get("net_sown_area_ha")),
                "year": _num(row.get("irrigation_year")),
                "provenance": FIXTURE_PROVENANCE,
            },
            "stress": {
                "index": _num(row.get("stress_index")),
                "class": row["stress_class"],
                "components": {
                    "rainfall": _num(row.get("rainfall_score")),
                    "groundwater": _num(row.get("groundwater_score")),
                    "irrigation": _num(row.get("irrigation_score")),
                },
                "available": int(row.get("components_available") or 0),
            },
        })

    atlas_districts.sort(key=lambda d: (d["state"], d["name"]))

    state_summaries = []
    grouped = output.groupby("state")
    for state, frame in grouped:
        state_summaries.append({
            "state": state,
            "districts": int(len(frame)),
            "stressIndex": _num(frame["stress_index"].mean()),
            "rainfallDeparturePct": _num(frame["departure_pct"].mean()),
            "groundwaterDepthM": _num(frame["groundwater_depth_m"].mean()),
            "irrigatedSharePct": _num(frame["irrigated_share_pct"].mean()),
            "severeDistricts": int((frame["stress_class"] == "Severe").sum()),
        })
    state_summaries.sort(key=lambda s: (s["stressIndex"] or -1), reverse=True)

    classes = {}
    for label in ["Low", "Moderate", "High", "Severe", "Unavailable"]:
        classes[label] = int((output["stress_class"] == label).sum())

    national = _national_summary(output, climate, fixtures)

    atlas = {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "latestYear": int(climate["season"][-1]["year"]) if climate["season"] else None,
            "indexVersion": INDEX_VERSION,
            "districtCount": len(atlas_districts),
            "stressDefinition": (
                "Mean of percentile ranks for (a) five-year monsoon departure "
                "(drier = higher), (b) pre-monsoon groundwater depth (deeper = higher), "
                "(c) non-irrigated share (less irrigated = higher)."
            ),
            "stressNotice": (
                "Neerakshi Water Stress Index is a project-defined analytical "
                "composite, not an official government classification."
            ),
            "provenance": {
                "rainfall": {"type": "reanalysis", "source": "NASA POWER / MERRA-2"},
                "groundwater": {"type": "demo_fixture", "source": "CGWB schema fixture"},
                "irrigation": {"type": "demo_fixture", "source": "ICRISAT schema fixture"},
                "crops": {"type": "demo_fixture", "source": "data.gov.in schema fixture"},
                "boundaries": {"type": "observed", "source": "geoBoundaries gbOpen (ODbL)"},
            },
            "demoNotice": (
                "DEMO DATA — NOT REAL OBSERVATIONS. Groundwater, irrigation and crop "
                "production layers are synthetic fixtures pending official downloads."
            ),
        },
        "classes": classes,
        "districts": atlas_districts,
        "states": state_summaries,
        "national": national,
        "crops": _crop_summary(fixtures["crops"]),
        "groundwater": _groundwater_summary(fixtures["groundwater"]),
    }
    write_json(PREPARED / "atlas.json", atlas)
    return atlas


def _num(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, (int, float)):
        return round(float(value), 3)
    return value


def _national_summary(output: pd.DataFrame, climate: dict, fixtures: dict) -> dict:
    monsoon_series = climate.get("national_series", {})
    state_series = {}
    for state, entry in climate.get("state_summaries", {}).items():
        state_series[state] = entry.get("series", {})
    return {
        "monsoonSeries": {str(k): round(v, 1) for k, v in sorted(monsoon_series.items())},
        "stateSeries": state_series,
        "meanStressIndex": _num(output["stress_index"].mean()),
        "meanDeparturePct": _num(output["departure_pct"].mean()),
        "meanGroundwaterDepthM": _num(output["groundwater_depth_m"].mean()),
        "meanIrrigatedSharePct": _num(output["irrigated_share_pct"].mean()),
        "districtsWithRainfall": int(output["departure_pct"].notna().sum()),
        "districtsTotal": int(len(output)),
    }


def _crop_summary(rows: list[dict]) -> dict:
    frame = pd.DataFrame(rows)
    if frame.empty:
        return {"series": [], "states": [], "scatter": []}
    latest_year = int(frame["year"].max())
    series = []
    for (crop, year), group in frame.groupby(["crop", "year"]):
        area = group["area_ha"].sum()
        production = group["production_tonnes"].sum()
        series.append({
            "crop": crop,
            "cropName": CROP_REFERENCE[crop]["name"],
            "year": int(year),
            "areaHa": round(float(area), 0),
            "productionTonnes": round(float(production), 0),
            "yieldKgHa": round(float(production * 1000 / area), 1) if area else None,
            "irrigatedSharePct": round(float(group["irrigated_share_pct"].mean()), 1),
        })
    states = []
    latest = frame[frame["year"] == latest_year]
    for (crop, state), group in latest.groupby(["crop", "state"]):
        area = group["area_ha"].sum()
        production = group["production_tonnes"].sum()
        states.append({
            "crop": crop,
            "state": state,
            "productionTonnes": round(float(production), 0),
            "areaHa": round(float(area), 0),
            "yieldKgHa": round(float(production * 1000 / area), 1) if area else None,
        })
    states.sort(key=lambda s: s["productionTonnes"], reverse=True)
    return {"latestYear": latest_year, "series": series, "states": states}


def _groundwater_summary(rows: list[dict]) -> dict:
    frame = pd.DataFrame(rows)
    if frame.empty:
        return {"series": [], "states": []}
    series = []
    for (year,), group in frame.groupby(["year"]):
        series.append({
            "year": int(year),
            "preMonsoonDepthM": round(float(group["pre_monsoon_depth_m"].mean()), 2),
            "postMonsoonDepthM": round(float(group["post_monsoon_depth_m"].mean()), 2),
        })
    latest_year = int(frame["year"].max())
    latest = frame[frame["year"] == latest_year]
    states = []
    for state, group in latest.groupby("state"):
        states.append({
            "state": state,
            "preMonsoonDepthM": round(float(group["pre_monsoon_depth_m"].mean()), 2),
            "postMonsoonDepthM": round(float(group["post_monsoon_depth_m"].mean()), 2),
            "changeM": round(float(group["change_m"].mean()), 2),
        })
    states.sort(key=lambda s: s["preMonsoonDepthM"], reverse=True)
    return {"series": series, "states": states}


def write_validation_report(
    districts: list[dict],
    climate: dict,
    fixtures: dict,
    atlas: dict,
    errors: list[str],
) -> None:
    """Write a reproducible coverage and quality report."""
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 160)

    files = sorted(PREPARED.glob("*.csv"))
    rows = []
    for path in files:
        frame = pd.read_csv(path)
        rows.append({
            "file": path.name,
            "rows": len(frame),
            "columns": len(frame.columns),
            "null_cells": int(frame.isna().sum().sum()),
            "duplicate_rows": int(frame.duplicated().sum()),
            "size_kb": round(path.stat().st_size / 1024, 1),
        })
    file_table = pd.DataFrame(rows)

    season = pd.DataFrame(climate["season"])
    monthly = pd.DataFrame(climate["monthly"])
    gw = pd.DataFrame(fixtures["groundwater"])
    crops = pd.DataFrame(fixtures["crops"])
    irr = pd.DataFrame(fixtures["irrigation"])

    def year_table(frame: pd.DataFrame, name: str) -> str:
        if frame.empty:
            return f"### {name}\n\nNo rows.\n"
        counts = frame.groupby("year").size().reset_index(name="rows")
        return f"### {name}\n\n{counts.to_markdown(index=False)}\n"

    def state_table(frame: pd.DataFrame, name: str) -> str:
        if frame.empty:
            return f"### {name}\n\nNo rows.\n"
        counts = frame.groupby("state").size().reset_index(name="rows").sort_values("state")
        return f"### {name}\n\n{counts.to_markdown(index=False)}\n"

    stress_classes = atlas["classes"]
    unmatched = climate.get("missing", [])
    warnings = [
        "Groundwater, irrigation and crop-production layers are synthetic fixtures "
        "(provenance=demo_fixture). They are NOT observations.",
        "Rainfall is NASA POWER / MERRA-2 reanalysis sampled at district representative "
        "points; it is not the IMD rain-gauge product.",
        "District boundaries are geoBoundaries gbOpen 2021 (ODbL 1.0), not the Survey "
        "of India administrative boundary.",
        "NDVI district statistics are not generated by this pipeline. The application "
        "uses NASA GIBS MODIS NDVI tiles and live Sentinel-2 statistics for fields.",
        "No missing rainfall values were zero-filled. Districts without a successful "
        "POWER response are excluded from rainfall-derived metrics.",
    ]

    lines = [
        "# Neerakshi Prepared Data Validation Report",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Summary",
        "",
        f"- Districts in boundary reference: **{len(districts)}**",
        f"- Districts with rainfall summary: **{len(climate['summaries'])}**",
        f"- Districts missing a POWER response: **{len(unmatched)}**",
        f"- Monsoon observations: **{len(season)}** district-year rows",
        f"- Monthly rainfall observations: **{len(monthly)}** rows",
        f"- Advisory index version: **{INDEX_VERSION}**",
        "",
        "## File inventory",
        "",
        file_table.to_markdown(index=False),
        "",
        "## Water-stress class distribution",
        "",
        pd.DataFrame([stress_classes]).to_markdown(index=False),
        "",
        "## Year coverage",
        "",
        year_table(season, "Rainfall season"),
        year_table(monthly, "Rainfall monthly"),
        year_table(gw, "Groundwater (fixture)"),
        year_table(crops, "Crop production (fixture)"),
        year_table(irr, "Irrigation (fixture)"),
        "",
        "## State coverage",
        "",
        state_table(season, "Rainfall season"),
        "",
        "## Missing values (key columns)",
        "",
        pd.DataFrame([{
            "rainfall_missing_departure": int(season["departure_pct"].isna().sum()) if not season.empty else 0,
            "rainfall_missing_monsoon": int(season["monsoon_mm"].isna().sum()) if not season.empty else 0,
            "groundwater_missing_pre": int(gw["pre_monsoon_depth_m"].isna().sum()) if not gw.empty else 0,
            "crop_missing_yield": int(crops["yield_kg_per_ha"].isna().sum()) if not crops.empty else 0,
        }]).to_markdown(index=False),
        "",
        "## Unmatched / excluded districts",
        "",
        ("- " + "\n- ".join(unmatched)) if unmatched else "None.",
        "",
        "## Pipeline errors",
        "",
        ("- " + "\n- ".join(errors[:50])) if errors else "None.",
        "",
        "## Data integrity warnings",
        "",
        "- " + "\n- ".join(warnings),
        "",
        "## Sources",
        "",
        "- Boundaries: geoBoundaries gbOpen IND ADM1/ADM2 (2021), ODbL 1.0.",
        "- Climate: NASA POWER API v2, MERRA-2 monthly reanalysis (public domain).",
        "- Crop coefficients: FAO Irrigation and Drainage Paper 56.",
        "- Official datasets requiring manual acquisition: see docs/MANUAL_STEPS.md.",
        "",
    ]
    (PREPARED / "VALIDATION_REPORT.md").write_text("\n".join(lines), encoding="utf-8")


def write_metadata(districts: list[dict], climate: dict, fixtures: dict) -> None:
    files = {}
    for path in sorted(PREPARED.glob("*")):
        if path.is_file():
            files[path.name] = {
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()[:16],
            }
    write_json(PREPARED / "metadata.json", {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "indexVersion": INDEX_VERSION,
        "districtCount": len(districts),
        "rainfallDistricts": len(climate["summaries"]),
        "datasets": {
            "rainfall": {
                "source": "NASA POWER / MERRA-2",
                "provenance": "reanalysis",
                "period": "2015-2025",
            },
            "groundwater": {"provenance": "demo_fixture"},
            "irrigation": {"provenance": "demo_fixture"},
            "crops": {"provenance": "demo_fixture"},
        },
        "files": files,
    })
