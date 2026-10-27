"""Python mirror of lib/agro/waterBalance.ts and lib/agro/advisory.ts.

Used for batch work (e.g. back-testing advisories over district weather) and
to cross-check the TypeScript implementation: tests/fixtures/water_balance_cases.json
is run through both and must give identical results (see tests/test_agro.py and
tests/waterBalance.test.ts). Keep the two files in step.
"""
from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass

RAIN_IGNORE_FRACTION_OF_ET0 = 0.2
RAIN_EFFECTIVE_FRACTION = 0.8
MEANINGFUL_RAIN_MM = 10.0
KC_ADJ_MAX = 0.15


@dataclass
class Crop:
    crop: str
    lIni: int
    lDev: int
    lMid: int
    lLate: int
    kcIni: float
    kcMid: float
    kcEnd: float
    zrMin: float
    zrMax: float
    p: float


@dataclass
class Soil:
    soil: str
    thetaFc: float
    thetaWp: float


def _d(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def days_between(a: str, b: str) -> int:
    return (_d(b) - _d(a)).days


def add_days(s: str, n: int) -> str:
    return (_d(s) + dt.timedelta(days=n)).isoformat()


def rnd(x: float, d: int) -> float:
    # JS Math.round semantics (round half up), to match the TypeScript output exactly
    f = 10**d
    return math.floor(x * f + 0.5) / f


def season_length(c: Crop) -> int:
    return c.lIni + c.lDev + c.lMid + c.lLate


def stage_of(c: Crop, day: int) -> str:
    if day < 0:
        return "before"
    if day < c.lIni:
        return "initial"
    if day < c.lIni + c.lDev:
        return "development"
    if day < c.lIni + c.lDev + c.lMid:
        return "mid"
    if day < season_length(c):
        return "late"
    return "after"


def kc_on(c: Crop, day: int) -> float | None:
    s = stage_of(c, day)
    if s == "initial":
        return c.kcIni
    if s == "development":
        return c.kcIni + ((day - c.lIni) / c.lDev) * (c.kcMid - c.kcIni)
    if s == "mid":
        return c.kcMid
    if s == "late":
        start = c.lIni + c.lDev + c.lMid
        return c.kcMid + ((day - start) / c.lLate) * (c.kcEnd - c.kcMid)
    return None


def root_depth_on(c: Crop, day: int) -> float:
    end = c.lIni + c.lDev
    if day <= 0:
        return c.zrMin
    if day >= end:
        return c.zrMax
    return c.zrMin + (day / end) * (c.zrMax - c.zrMin)


def taw(soil: Soil, zr: float) -> float:
    return 1000 * (soil.thetaFc - soil.thetaWp) * zr


def adjusted_p(p_table: float, etc: float) -> float:
    return min(0.8, max(0.1, p_table + 0.04 * (5 - etc)))


def effective_rain(precip: float, et0: float) -> float:
    if precip <= 0 or precip < RAIN_IGNORE_FRACTION_OF_ET0 * et0:
        return 0.0
    return RAIN_EFFECTIVE_FRACTION * precip


def run_balance(crop: Crop, soil: Soil, sowing: str, start: str, weather: list[dict], irrigations: list[dict] | None = None, kc_factor: float = 1.0, forecast_from: str | None = None) -> dict:
    factor = min(1 + KC_ADJ_MAX, max(1 - KC_ADJ_MAX, kc_factor))
    irr = {e["date"]: e.get("depthMm") for e in (irrigations or [])}
    days, missing = [], []
    dr = 0.0
    for w in weather:
        if w["date"] < start:
            continue
        day = days_between(sowing, w["date"])
        stage = stage_of(crop, day)
        kc_base = kc_on(crop, day)
        if kc_base is None:
            if stage == "after":
                break
            continue
        et0, precip = w.get("et0"), w.get("precip")
        if et0 is None or precip is None:
            missing.append(w["date"])
            break
        kc = kc_base if stage == "initial" else kc_base * factor
        zr = root_depth_on(crop, day)
        taw_d = taw(soil, zr)
        etc = kc * et0
        p = adjusted_p(crop.p, etc)
        raw_d = p * taw_d
        irrigation = 0.0
        if w["date"] in irr:
            d = irr[w["date"]]
            irrigation = dr if d is None else d
        peff = effective_rain(precip, et0)
        dr_start = max(0.0, dr - irrigation)
        ks = max(0.0, (taw_d - dr_start) / ((1 - p) * taw_d)) if dr_start > raw_d else 1.0
        etc_adj = ks * etc
        nxt = dr - peff - irrigation + etc_adj
        deep = 0.0
        if nxt < 0:
            deep = -nxt
            nxt = 0.0
        if nxt > taw_d:
            nxt = taw_d
        dr = nxt
        days.append(
            {
                "date": w["date"], "day": day, "stage": stage, "kc": rnd(kc, 3), "et0": rnd(et0, 2), "etc": rnd(etc, 2),
                "etcAdj": rnd(etc_adj, 2), "ks": rnd(ks, 3), "precip": rnd(precip, 1), "peff": rnd(peff, 2),
                "irrigation": rnd(irrigation, 1), "zr": rnd(zr, 3), "taw": rnd(taw_d, 1), "raw": rnd(raw_d, 1), "p": rnd(p, 3),
                "dr": rnd(dr, 2), "deepPercolation": rnd(deep, 2), "forecast": bool(forecast_from and w["date"] >= forecast_from),
            }
        )
    return {"days": days, "missing": missing}


def compute_advisory(crop: Crop, soil: Soil, sowing: str, start: str, weather: list[dict], today: str, area_ha: float, efficiency: float, irrigations: list[dict] | None = None, kc_factor: float = 1.0) -> dict:
    day_today = days_between(sowing, today)
    stage = stage_of(crop, day_today)
    if stage == "before":
        return {"type": "unavailable", "reason": "not_sown"}
    if stage == "after":
        return {"type": "unavailable", "reason": "harvested"}
    res = run_balance(crop, soil, sowing, start, weather, irrigations, kc_factor, add_days(today, 1))
    history = [d for d in res["days"] if d["date"] <= today]
    forecast = [d for d in res["days"] if d["date"] > today]
    if not history or history[-1]["date"] != today:
        return {"type": "unavailable", "reason": "weather"}
    t = history[-1]
    wmap = {w["date"]: w for w in weather}

    def rain_on(n: int) -> float:
        w = wmap.get(add_days(today, n))
        return (w or {}).get("precip") or 0.0

    w3 = wmap.get(add_days(today, 3))
    if not w3 or w3.get("precip") is None:
        return {"type": "unavailable", "reason": "weather"}
    rain48 = rnd(rain_on(1) + rain_on(2), 1)

    def amounts(net: float) -> dict:
        gross = net / efficiency
        return {"netDepthMm": rnd(net, 1), "grossDepthMm": rnd(gross, 1), "grossLitres": math.floor((gross * area_ha * 10_000) / 100 + 0.5) * 100}

    if t["dr"] >= t["raw"]:
        if rain48 >= MEANINGFUL_RAIN_MM:
            return {"type": "wait_rain", "nextCheck": add_days(today, 2), "dr": t["dr"], "raw": t["raw"]}
        return {"type": "irrigate_now", "nextCheck": add_days(today, 1), "dr": t["dr"], "raw": t["raw"], **amounts(t["dr"])}
    crossing = next((d for d in forecast if d["dr"] >= d["raw"]), None)
    if crossing:
        n = days_between(today, crossing["date"])
        if n <= 3:
            return {"type": "irrigate_in", "inDays": n, "nextCheck": crossing["date"], "dr": t["dr"], "raw": t["raw"], **amounts(crossing["dr"])}
        return {"type": "no_need", "nextCheck": crossing["date"], "dr": t["dr"], "raw": t["raw"]}
    return {"type": "no_need", "nextCheck": add_days(today, 3), "dr": t["dr"], "raw": t["raw"]}
