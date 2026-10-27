"""Python water balance: hand-checked expectations + identical output to the TypeScript module."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from pipeline.agro import Crop, Soil, add_days, compute_advisory, run_balance

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / "tests/fixtures/water_balance_cases.json").read_text())


def _run(c):
    crop, soil = Crop(**c["crop"]), Soil(**c["soil"])
    bal = run_balance(crop, soil, c["sowingDate"], c["startDate"], c["weather"], c.get("irrigations"), 1.0, add_days(c["today"], 1))
    adv = compute_advisory(crop, soil, c["sowingDate"], c["startDate"], c["weather"], c["today"], c["areaHa"], c["efficiency"], c.get("irrigations"))
    return bal, adv


@pytest.mark.parametrize("c", CASES, ids=[c["name"] for c in CASES])
def test_expected(c):
    bal, adv = _run(c)
    e = c["expected"]
    for k in ("type", "reason", "inDays", "nextCheck", "netDepthMm", "grossDepthMm", "grossLitres"):
        if k in e:
            assert adv.get(k) == pytest.approx(e[k]) if isinstance(e[k], float) else adv.get(k) == e[k], k
    if "dr" in e:
        today = [d for d in bal["days"] if d["date"] == c["today"]][0]
        assert today["dr"] == pytest.approx(e["dr"], abs=0.01)
    if "ks" in e:
        today = [d for d in bal["days"] if d["date"] == c["today"]][0]
        assert today["ks"] == pytest.approx(e["ks"], abs=0.001)


@pytest.mark.skipif(shutil.which("npx") is None, reason="node not available")
def test_identical_to_typescript():
    out = subprocess.run(["npx", "tsx", "scripts/agro-cases.ts"], cwd=ROOT, capture_output=True, text=True, check=True)
    ts = {r["name"]: r for r in json.loads(out.stdout)}
    for c in CASES:
        bal, adv = _run(c)
        assert bal["days"] == ts[c["name"]]["days"], c["name"]
        assert bal["missing"] == ts[c["name"]]["missing"], c["name"]
        t = ts[c["name"]]["advisory"]
        assert adv["type"] == t["type"], c["name"]
        for k in ("inDays", "nextCheck", "netDepthMm", "grossDepthMm", "grossLitres", "reason"):
            if t.get(k) is not None:
                assert adv.get(k) == t[k], (c["name"], k)
