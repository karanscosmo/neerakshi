"""Rebuild every prepared dataset from data/raw/ and write the validation report.

    python -m pipeline.run_all            # use files already in data/raw
    python -m pipeline.run_all --fetch    # first download every automatic source
"""
from __future__ import annotations

import sys
import time

import pandas as pd

from . import boundaries, crops, groundwater, irrigation, ndvi, rainfall, report, sky, stress
from .common import Report, write_csv


def main() -> int:
    t0 = time.time()
    if "--fetch" in sys.argv:
        from .sources import fetch

        for r in fetch():
            print(f"  {r['status']:<12} {r['id']}")
    rep = Report()
    steps = []

    def step(name, fn):
        t = time.time()
        res = fn()
        steps.append((name, time.time() - t))
        print(f"✓ {name} ({time.time() - t:.1f}s)")
        return res

    d = step("boundaries + districts", lambda: boundaries.run(rep))
    write_csv(d.drop(columns=["census_state"]), "districts.csv", rep, grain="canonical district (Census 2011)")
    step("crop production", lambda: crops.run(rep))
    irr = step("irrigation", lambda: irrigation.run(rep))
    rain = step("rainfall", lambda: rainfall.run(rep, d))
    gw = step("groundwater", lambda: groundwater.run(rep))
    step("water stress index", lambda: stress.run(rep, d, rain.get("rainfall_district_season"), gw, irr))
    step("ndvi (file check)", lambda: ndvi.ensure_file(rep))
    step("sky", lambda: sky.run(rep))
    step("validation report", lambda: report.write(rep))
    print(f"done in {time.time() - t0:.1f}s → data/prepared/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
