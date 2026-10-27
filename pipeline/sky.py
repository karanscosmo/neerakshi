"""Star catalogue for the Journey sky: the 300 brightest stars + constellation lines.

Source: d3-celestial (Hipparcos-derived, BSD-3-Clause). Output is tiny
(public/data/sky.json) so the first act can render a real sky offline.
"""
from __future__ import annotations

import json

from .common import PUBLIC_DATA, RAW, Report, write_json

N_STARS = 300


def run(report: Report) -> None:
    sp = RAW / "sky" / "stars.6.json"
    cp = RAW / "sky" / "constellations.lines.json"
    if not sp.exists():
        report.note("Sky", "Star catalogue missing; journey sky will render without stars.")
        return
    feats = json.loads(sp.read_text())["features"]
    feats = sorted(feats, key=lambda f: f["properties"]["mag"])[:N_STARS]
    stars = []
    for f in feats:
        ra, dec = f["geometry"]["coordinates"]
        try:
            bv = float(f["properties"].get("bv") or 0.6)
        except ValueError:
            bv = 0.6
        stars.append([round(ra % 360, 3), round(dec, 3), f["properties"]["mag"], round(bv, 2)])
    lines = []
    if cp.exists():
        for f in json.loads(cp.read_text())["features"]:
            if f["properties"].get("rank") == "1":  # the most prominent figures only
                for seg in f["geometry"]["coordinates"]:
                    lines.append([[round(p[0] % 360, 2), round(p[1], 2)] for p in seg])
    write_json({"source": "d3-celestial (Hipparcos), BSD-3-Clause", "stars": stars, "lines": lines}, PUBLIC_DATA / "sky.json")
    report.note("Sky", f"public/data/sky.json: {len(stars)} brightest stars (mag ≤ {stars[-1][2]}), {len(lines)} constellation line segments.")
