"""FAO-56 single crop coefficient water balance.

Mirrors lib/agro/waterBalance.ts. Shared JSON fixtures in tests/fixtures are
executed by both the TypeScript and Python test suites.

References:
  FAO Irrigation and Drainage Paper 56 (Allen et al., 1998), Chapters 1, 4, 6, 8.
  Crop coefficient tables: FAO-56 Tables 11 and 12.
  Soil water retention: FAO-56 Table 19 (approximate texture classes).
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Iterable

from .config import CROP_REFERENCE, IRRIGATION_EFFICIENCY, SOIL_REFERENCE

MODEL_VERSION = "fao56-1.0.0"
SIGNIFICANT_RAIN_MM = 10.0
MIN_ROOT_DEPTH_M = 0.15


def _parse_date(value: str | date | datetime) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return datetime.strptime(value, "%Y-%m-%d").date()


def stage_for_day(days_after_sowing: int, stage_lengths: Iterable[int]) -> tuple[str, int, float]:
    """Return (stage name, index, fraction through the stage)."""
    lengths = list(stage_lengths)
    names = ["initial", "development", "mid", "late"]
    remaining = max(days_after_sowing, 0)
    for index, length in enumerate(lengths):
        if remaining < length or index == len(lengths) - 1:
            fraction = min(remaining / length, 1.0) if length > 0 else 1.0
            return names[index], index, fraction
        remaining -= length
    return "late", 3, 1.0


def crop_coefficient(crop: str, days_after_sowing: int) -> tuple[float, str, int]:
    reference = CROP_REFERENCE[crop]
    stage, index, fraction = stage_for_day(days_after_sowing, reference["stage_lengths"])
    if index == 0:
        kc = reference["kc_ini"]
    elif index == 1:
        kc = reference["kc_ini"] + (reference["kc_mid"] - reference["kc_ini"]) * fraction
    elif index == 2:
        kc = reference["kc_mid"]
    else:
        kc = reference["kc_mid"] + (reference["kc_end"] - reference["kc_mid"]) * fraction
    return round(kc, 4), stage, index


def root_depth(crop: str, days_after_sowing: int) -> float:
    reference = CROP_REFERENCE[crop]
    zr_max = reference["zr_max_m"]
    total = sum(reference["stage_lengths"])
    fraction = min(max(days_after_sowing / max(total * 0.55, 1), 0.0), 1.0)
    return round(MIN_ROOT_DEPTH_M + (zr_max - MIN_ROOT_DEPTH_M) * fraction, 3)


def total_available_water(soil: str, root_depth_m: float) -> float:
    soil_ref = SOIL_REFERENCE[soil]
    return 1000.0 * (soil_ref["field_capacity"] - soil_ref["wilting_point"]) * root_depth_m


def effective_rainfall(rain_mm: float) -> float:
    """USDA-SCS effective rainfall approximation (FAO-56 Ch. 4 guidance)."""
    if rain_mm <= 0:
        return 0.0
    return round(min(rain_mm, rain_mm * (125.0 - 0.2 * rain_mm) / 125.0), 2)


def satellite_kc_adjustment(ndvi: float | None, valid_fraction: float | None) -> float:
    """Small, bounded adjustment used only as contextual evidence.

    NDVI is an indicator, never a direct root-zone water measurement. The
    adjustment is capped at +/- 0.05 and requires >=30% valid pixels.
    """
    if ndvi is None or valid_fraction is None or valid_fraction < 0.30:
        return 0.0
    if ndvi < 0.25:
        return -0.05
    if ndvi < 0.40:
        return -0.025
    if ndvi > 0.75:
        return 0.025
    return 0.0


def compute_advisory(payload: dict) -> dict:
    crop = payload.get("crop")
    soil = payload.get("soil")
    method = payload.get("irrigationMethod", "flood")
    if crop not in CROP_REFERENCE or soil not in SOIL_REFERENCE:
        return _unavailable("Crop or soil type is not in the FAO-56 reference table.")

    forecast = payload.get("forecast") or []
    if not forecast:
        return _unavailable("A seven-day weather forecast is required for the water balance.")

    et0_values = [day.get("et0Mm") for day in forecast]
    if any(value is None or not math.isfinite(float(value)) for value in et0_values):
        return _unavailable("Reference evapotranspiration (ET0) is missing from the forecast.")

    assessment_date = _parse_date(payload.get("assessmentDate") or date.today().isoformat())
    sowing_date = _parse_date(payload.get("sowingDate"))
    days_after_sowing = (assessment_date - sowing_date).days
    if days_after_sowing < 0:
        return _unavailable("The sowing date is after the assessment date.")

    reference = CROP_REFERENCE[crop]
    kc, stage, stage_index = crop_coefficient(crop, days_after_sowing)
    zr = root_depth(crop, days_after_sowing)
    taw = total_available_water(soil, zr)
    raw = reference["p_depletion"] * taw
    satellite = payload.get("satellite") or {}
    adjustment = satellite_kc_adjustment(satellite.get("ndvi"), satellite.get("validFraction"))
    kc_adjusted = round(max(0.1, kc + adjustment), 4)

    previous = payload.get("previousDepletionMm")
    if previous is None:
        previous = 0.0
    depletion = max(0.0, min(float(previous), taw))

    efficiency = IRRIGATION_EFFICIENCY.get(method, 0.60)
    area_ha = float(payload.get("areaHa") or 1.0)

    daily = []
    for index, day in enumerate(forecast[:7]):
        day_date = _parse_date(day.get("date") or (assessment_date + timedelta(days=index)))
        day_kc, _, _ = crop_coefficient(crop, days_after_sowing + index)
        day_kc = round(max(0.1, day_kc + adjustment), 4)
        et0 = float(day.get("et0Mm") or 0.0)
        rain = float(day.get("rainMm") or 0.0)
        peff = effective_rainfall(rain)
        etc = day_kc * et0
        if index == 0:
            day_depletion = max(0.0, min(depletion - peff + etc, taw))
            irrigation = 0.0
        else:
            irrigation = 0.0
            day_depletion = max(0.0, min(daily[-1]["depletionMm"] - peff + etc, taw))
        daily.append({
            "date": day_date.isoformat(),
            "et0Mm": round(et0, 2),
            "rainMm": round(rain, 2),
            "effectiveRainMm": peff,
            "kc": day_kc,
            "etcMm": round(etc, 2),
            "depletionMm": round(day_depletion, 2),
            "irrigationMm": irrigation,
        })

    today = daily[0]
    decision = "NO_IRRIGATION"
    target_day = None
    reason_codes: list[str] = []

    future_rain_2d = sum(day["effectiveRainMm"] for day in daily[1:3])
    future_rain_7d = sum(day["effectiveRainMm"] for day in daily[1:])
    deficit = max(0.0, today["depletionMm"] - raw)

    if today["depletionMm"] >= raw:
        if future_rain_2d >= SIGNIFICANT_RAIN_MM and future_rain_2d >= deficit:
            decision = "WAIT_FOR_RAIN"
            reason_codes.append("raw_reached_but_rain_expected")
        else:
            decision = "IRRIGATE_NOW"
            target_day = today
            reason_codes.append("depletion_at_or_above_raw")
    else:
        threshold_day = None
        for day in daily[1:]:
            if day["depletionMm"] >= raw:
                threshold_day = day
                break
        if threshold_day:
            days_before = daily[1:daily.index(threshold_day)]
            rain_before = sum(day["effectiveRainMm"] for day in days_before)
            if future_rain_2d >= SIGNIFICANT_RAIN_MM:
                decision = "WAIT_FOR_RAIN"
                reason_codes.append("rain_expected_before_threshold")
            elif rain_before >= SIGNIFICANT_RAIN_MM:
                decision = "WAIT_FOR_RAIN"
                reason_codes.append("rain_expected_before_threshold")
            else:
                decision = "IRRIGATE_IN_DAYS"
                target_day = threshold_day
                reason_codes.append("raw_expected_within_seven_days")
        else:
            if future_rain_7d >= 20.0:
                decision = "WAIT_FOR_RAIN"
                reason_codes.append("rain_expected_before_threshold")
            else:
                decision = "NO_IRRIGATION"
                reason_codes.append("depletion_below_raw")
                target_day = daily[-1]

    if decision == "UNAVAILABLE":
        net = 0.0
    elif decision == "IRRIGATE_NOW":
        net = max(0.0, today["depletionMm"])
    elif decision == "IRRIGATE_IN_DAYS" and target_day is not None:
        net = max(0.0, target_day["depletionMm"])
    elif decision == "WAIT_FOR_RAIN":
        net = 0.0
    else:
        net = 0.0

    net = round(net, 2)
    gross = round(net / efficiency, 2) if net > 0 else 0.0
    volume_litres = round(gross * area_ha * 10000.0, 0)
    days_until = 0
    if target_day is not None:
        days_until = (assessment_date - _parse_date(target_day["date"])).days * -1

    confidence_parts = {
        "weather": 1.0,
        "satellite": 1.0 if satellite.get("ndvi") is not None else 0.0,
        "previousState": 1.0 if payload.get("previousDepletionMm") is not None else 0.5,
    }
    confidence = round(0.6 * confidence_parts["weather"] + 0.2 * confidence_parts["satellite"] + 0.2 * confidence_parts["previousState"], 2)

    return {
        "status": "ok",
        "modelVersion": MODEL_VERSION,
        "decision": decision,
        "decisionLabel": {
            "IRRIGATE_NOW": "Irrigate now",
            "IRRIGATE_IN_DAYS": "Irrigate in {n} days",
            "WAIT_FOR_RAIN": "Wait for rain",
            "NO_IRRIGATION": "No irrigation required",
            "UNAVAILABLE": "Advisory unavailable",
        }[decision].replace("{n}", str(days_until)),
        "daysUntilAction": max(0, days_until),
        "assessmentDate": assessment_date.isoformat(),
        "sowingDate": sowing_date.isoformat(),
        "nextAssessmentDate": (assessment_date + timedelta(days=1)).isoformat(),
        "crop": crop,
        "cropName": reference["name"],
        "soil": soil,
        "growthStage": stage,
        "stageIndex": stage_index,
        "daysAfterSowing": days_after_sowing,
        "kc": kc,
        "kcAdjusted": kc_adjusted,
        "satelliteAdjustment": adjustment,
        "rootDepthM": zr,
        "tawMm": round(taw, 2),
        "rawMm": round(raw, 2),
        "depletionMm": round(depletion, 2),
        "todayDepletionMm": today["depletionMm"],
        "et0Mm": today["et0Mm"],
        "etcMm": today["etcMm"],
        "effectiveRainMm": today["effectiveRainMm"],
        "forecastRain7dMm": round(sum(day["rainMm"] for day in daily[1:]), 2),
        "netIrrigationMm": net,
        "grossIrrigationMm": gross,
        "irrigationEfficiency": efficiency,
        "volumeLitres": volume_litres,
        "areaHa": area_ha,
        "reasonCodes": reason_codes,
        "daily": daily,
        "confidence": confidence,
        "satellite": {
            "ndvi": satellite.get("ndvi"),
            "validFraction": satellite.get("validFraction"),
            "used": satellite.get("ndvi") is not None,
        },
    }


def _unavailable(message: str) -> dict:
    return {
        "status": "unavailable",
        "modelVersion": MODEL_VERSION,
        "decision": "UNAVAILABLE",
        "decisionLabel": "Advisory unavailable",
        "reason": message,
        "reasonCodes": ["missing_critical_input"],
    }
