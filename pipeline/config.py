"""Shared configuration for the Neerakshi data pipeline."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
BOUNDARIES = RAW / "boundaries"
OPENMETEO_RAW = RAW / "openmeteo"
PREPARED = DATA / "prepared"
REFERENCE = DATA / "reference"
PUBLIC_GEO = ROOT / "public" / "geo"
DOCS = ROOT / "docs"

RAINFALL_START = "2015-01-01"
RAINFALL_END = "2025-12-31"
NORMAL_START_YEAR = 2015
NORMAL_END_YEAR = 2024
LATEST_YEAR = 2025

GEOBOUNDARIES = {
    "ADM1": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM1/geoBoundaries-IND-ADM1_simplified.geojson",
    "ADM2": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2_simplified.geojson",
}

OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast"

DATA_GOV_IN_API_KEY = os.environ.get("DATA_GOV_IN_API_KEY", "").strip()

# Fixture provenance is surfaced everywhere in the UI. These datasets are
# synthetic placeholders used ONLY so the interface can be demonstrated when
# official district files are not present. They are never presented as
# observations.
FIXTURE_PROVENANCE = "demo_fixture"
FIXTURE_NOTE = (
    "DEMO FIXTURE — synthetic values generated for interface demonstration. "
    "Not an observation and not suitable for inference."
)

STATE_IRRIGATION_BASE = {
    "Punjab": 0.94,
    "Haryana": 0.90,
    "Uttar Pradesh": 0.80,
    "Bihar": 0.69,
    "West Bengal": 0.56,
    "Tamil Nadu": 0.57,
    "Andhra Pradesh": 0.60,
    "Telangana": 0.58,
    "Karnataka": 0.41,
    "Maharashtra": 0.30,
    "Gujarat": 0.46,
    "Rajasthan": 0.51,
    "Madhya Pradesh": 0.39,
    "Odisha": 0.41,
    "Assam": 0.29,
    "Kerala": 0.32,
    "Chhattisgarh": 0.34,
    "Jharkhand": 0.22,
    "Uttarakhand": 0.62,
    "Himachal Pradesh": 0.30,
    "Jammu and Kashmir": 0.52,
}

STATE_ARIDITY = {
    "Rajasthan": 0.92,
    "Gujarat": 0.68,
    "Haryana": 0.62,
    "Punjab": 0.55,
    "Delhi": 0.66,
    "Uttar Pradesh": 0.44,
    "Madhya Pradesh": 0.42,
    "Maharashtra": 0.40,
    "Karnataka": 0.38,
    "Telangana": 0.37,
    "Andhra Pradesh": 0.36,
    "Tamil Nadu": 0.35,
    "Bihar": 0.30,
    "Jharkhand": 0.28,
    "Odisha": 0.26,
    "Chhattisgarh": 0.26,
    "West Bengal": 0.24,
    "Assam": 0.20,
    "Kerala": 0.18,
}

# Agronomic reference values (FAO-56). Used by the advisory engine.
CROP_REFERENCE = {
    "rice": {
        "name": "Rice / Paddy",
        "kc_ini": 1.05,
        "kc_mid": 1.20,
        "kc_end": 0.90,
        "stage_lengths": [30, 30, 60, 30],
        "zr_max_m": 0.60,
        "p_depletion": 0.20,
        "yield_kg_ha": 3900,
    },
    "wheat": {
        "name": "Wheat",
        "kc_ini": 0.30,
        "kc_mid": 1.15,
        "kc_end": 0.40,
        "stage_lengths": [20, 30, 50, 30],
        "zr_max_m": 1.50,
        "p_depletion": 0.55,
        "yield_kg_ha": 3200,
    },
    "maize": {
        "name": "Maize",
        "kc_ini": 0.30,
        "kc_mid": 1.20,
        "kc_end": 0.50,
        "stage_lengths": [20, 35, 40, 30],
        "zr_max_m": 1.20,
        "p_depletion": 0.55,
        "yield_kg_ha": 2800,
    },
    "sugarcane": {
        "name": "Sugarcane",
        "kc_ini": 0.40,
        "kc_mid": 1.25,
        "kc_end": 0.75,
        "stage_lengths": [30, 60, 180, 60],
        "zr_max_m": 1.20,
        "p_depletion": 0.65,
        "yield_kg_ha": 70000,
    },
}

SOIL_REFERENCE = {
    "sandy": {"name": "Sandy", "field_capacity": 0.10, "wilting_point": 0.05, "infiltration": 30},
    "loam": {"name": "Loam", "field_capacity": 0.29, "wilting_point": 0.12, "infiltration": 15},
    "clay_loam": {"name": "Clay loam", "field_capacity": 0.36, "wilting_point": 0.18, "infiltration": 5},
    "clay": {"name": "Clay", "field_capacity": 0.42, "wilting_point": 0.24, "infiltration": 2},
}

IRRIGATION_EFFICIENCY = {"flood": 0.60, "furrow": 0.70, "drip": 0.90}
