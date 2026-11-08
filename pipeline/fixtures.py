"""Deterministic interface fixtures for datasets that need official downloads.

IMPORTANT: Every value produced here is synthetic. It exists so the atlas and
advisory interface can be demonstrated end-to-end when CGWB / ICRISAT / data.gov.in
files are not present. Rows carry provenance="demo_fixture" and the UI renders a
persistent DEMO DATA warning wherever they are shown.
"""
from __future__ import annotations

import csv
import hashlib
from pathlib import Path

from .config import (
    CROP_REFERENCE,
    FIXTURE_NOTE,
    FIXTURE_PROVENANCE,
    PREPARED,
    REFERENCE,
    STATE_ARIDITY,
    STATE_IRRIGATION_BASE,
)
from .io_utils import ensure_dir, write_json

CROP_SEASON = {"rice": "Kharif", "maize": "Kharif", "sugarcane": "Whole year", "wheat": "Rabi"}
CROP_AREA_SHARE = {"rice": 0.28, "wheat": 0.25, "maize": 0.12, "sugarcane": 0.06}
CROP_IRRIGATION = {"rice": 0.95, "wheat": 0.90, "maize": 0.35, "sugarcane": 0.90}
STATE_YIELD_FACTOR = {
    "Punjab": 1.25, "Haryana": 1.20, "Uttar Pradesh": 1.10, "West Bengal": 1.10,
    "Andhra Pradesh": 1.05, "Tamil Nadu": 1.05, "Karnataka": 0.95, "Gujarat": 0.95,
    "Madhya Pradesh": 0.95, "Bihar": 0.90, "Maharashtra": 0.85, "Rajasthan": 0.85,
}


def _jitter(key: str, low: float = 0.0, high: float = 1.0) -> float:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    unit = int(digest[:8], 16) / 0xFFFFFFFF
    return low + unit * (high - low)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def build_fixtures(districts: list[dict], climate_summaries: dict[str, dict]) -> dict:
    ensure_dir(PREPARED)
    ensure_dir(REFERENCE)

    irrigation_rows: list[dict] = []
    groundwater_rows: list[dict] = []
    crop_rows: list[dict] = []

    for district in districts:
        name = district["district_name"]
        state = district["state"]
        did = district["district_id"]
        area = district["area_km2"]
        climate = climate_summaries.get(did, {})
        base_irrigation = STATE_IRRIGATION_BASE.get(state, 0.36)
        jitter = _jitter(did + "irrigation", -0.12, 0.12)
        irrigated_share = _clamp(base_irrigation + jitter, 0.05, 0.98)
        net_sown = max(area * (0.45 + _jitter(did + "sown", -0.08, 0.10)), 25.0)

        for offset, year in enumerate(range(2019, 2025)):
            yearly_share = _clamp(
                irrigated_share + _jitter(f"{did}irr{year}", -0.02, 0.02), 0.05, 0.98
            )
            irrigation_rows.append({
                "district_id": did,
                "district_name": name,
                "state": state,
                "year": year,
                "net_sown_area_ha": round(net_sown * 100, 1),
                "irrigated_area_ha": round(net_sown * 100 * yearly_share, 1),
                "irrigated_share_pct": round(yearly_share * 100, 2),
                "source": "Synthetic interface fixture (ICRISAT DLD schema)",
                "provenance": FIXTURE_PROVENANCE,
                "note": FIXTURE_NOTE,
            })

        aridity = STATE_ARIDITY.get(state, 0.30)
        departure = climate.get("departure_pct")
        departure = 0.0 if departure is None else departure
        deficit = max(0.0, -departure)
        rain_ratio = 0.0
        if climate.get("monsoon_normal_mm"):
            rain_ratio = climate["monsoon_mm"] / climate["monsoon_normal_mm"]
        rain_ratio = _clamp(rain_ratio if rain_ratio else 0.9, 0.35, 1.5)

        base_depth = _clamp(
            2.0 + aridity * 17.0 + deficit * 0.09 + _jitter(did + "gw", 0.0, 6.0),
            0.8,
            42.0,
        )
        for offset, year in enumerate(range(2019, 2025)):
            trend = (year - 2019) * 0.22
            pre = _clamp(
                base_depth - trend + _jitter(f"{did}gw{year}", -1.1, 1.1),
                0.6,
                45.0,
            )
            post = _clamp(
                pre * _clamp(1.02 - 0.32 * rain_ratio + _jitter(f"{did}post{year}", -0.04, 0.04), 0.45, 1.02),
                0.4,
                45.0,
            )
            groundwater_rows.append({
                "district_id": did,
                "district_name": name,
                "state": state,
                "year": year,
                "pre_monsoon_depth_m": round(pre, 2),
                "post_monsoon_depth_m": round(post, 2),
                "change_m": round(post - pre, 2),
                "source": "Synthetic interface fixture (CGWB schema)",
                "provenance": FIXTURE_PROVENANCE,
                "note": FIXTURE_NOTE,
            })

        yield_factor = STATE_YIELD_FACTOR.get(state, 1.0)
        for crop, reference in CROP_REFERENCE.items():
            crop_jitter = _jitter(f"{did}{crop}area", 0.65, 1.35)
            crop_area = max(net_sown * CROP_AREA_SHARE[crop] * crop_jitter * 100, 1.0)
            for year in range(2020, 2025):
                yearly_factor = _jitter(f"{did}{crop}{year}", 0.86, 1.14)
                yield_kg_ha = reference["yield_kg_ha"] * yield_factor * yearly_factor
                production_tonnes = crop_area * yield_kg_ha / 1000.0
                crop_irr = _clamp(
                    CROP_IRRIGATION[crop] * (0.65 + 0.45 * irrigated_share),
                    0.05,
                    0.99,
                )
                crop_rows.append({
                    "district_id": did,
                    "district_name": name,
                    "state": state,
                    "year": year,
                    "season": CROP_SEASON[crop],
                    "crop": crop,
                    "crop_name": reference["name"],
                    "area_ha": round(crop_area, 1),
                    "production_tonnes": round(production_tonnes, 1),
                    "yield_kg_per_ha": round(yield_kg_ha, 1),
                    "irrigated_share_pct": round(crop_irr * 100, 2),
                    "source": "Synthetic interface fixture (data.gov.in schema)",
                    "provenance": FIXTURE_PROVENANCE,
                    "note": FIXTURE_NOTE,
                })

    _write_csv(PREPARED / "irrigation_district.csv", irrigation_rows)
    _write_csv(PREPARED / "groundwater_district.csv", groundwater_rows)
    _write_csv(PREPARED / "crop_production.csv", crop_rows)

    crop_mapping = []
    for crop, reference in CROP_REFERENCE.items():
        crop_mapping.append({
            "crop_code": crop,
            "crop_name": reference["name"],
            "season": CROP_SEASON[crop],
            "kc_ini": reference["kc_ini"],
            "kc_mid": reference["kc_mid"],
            "kc_end": reference["kc_end"],
            "zr_max_m": reference["zr_max_m"],
            "p_depletion": reference["p_depletion"],
            "kc_source": "FAO Irrigation and Drainage Paper 56, Tables 11-12",
        })
    _write_csv(REFERENCE / "crop_mapping.csv", crop_mapping)

    with open(PREPARED / "advisories.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "advisory_id", "field_id", "created_at", "crop", "growth_stage",
            "et0_mm", "kc", "etc_mm", "effective_rain_mm", "depletion_mm",
            "raw_mm", "net_irrigation_mm", "gross_irrigation_mm",
            "decision", "confidence", "satellite_used", "model_version",
        ])

    write_json(REFERENCE / "dataset_manifest.json", {
        "generated_by": "pipeline/fixtures.py",
        "datasets": [
            {
                "file": "irrigation_district.csv",
                "provenance": FIXTURE_PROVENANCE,
                "note": FIXTURE_NOTE,
                "real_source_schema": "ICRISAT District Level Database",
            },
            {
                "file": "groundwater_district.csv",
                "provenance": FIXTURE_PROVENANCE,
                "note": FIXTURE_NOTE,
                "real_source_schema": "CGWB via India-WRIS",
            },
            {
                "file": "crop_production.csv",
                "provenance": FIXTURE_PROVENANCE,
                "note": FIXTURE_NOTE,
                "real_source_schema": "data.gov.in district-wise season-wise crop production",
            },
        ],
    })

    return {
        "irrigation": irrigation_rows,
        "groundwater": groundwater_rows,
        "crops": crop_rows,
    }


def _write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
