"""Shared helpers: paths, a run log that feeds the validation report, CSV writing."""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
REF = ROOT / "data" / "reference"
PREPARED = ROOT / "data" / "prepared"
PUBLIC_DATA = ROOT / "public" / "data"

TARGET_CROPS = {"Rice": "rice", "Wheat": "wheat", "Maize": "maize", "Sugarcane": "sugarcane"}

# Documented plausibility thresholds (t/ha). Rows above are excluded and listed.
# Rice in the APY series is reported as rice (milled-equivalent), not paddy.
YIELD_MAX_T_PER_HA = {"rice": 12.0, "wheat": 10.0, "maize": 15.0, "sugarcane": 200.0}
# Depth to water below ground level: values above this are treated as entry errors.
GW_DEPTH_MAX_M = 200.0


@dataclass
class Report:
    """Collects facts for data/prepared/VALIDATION_REPORT.md. Nothing here is invented:
    every entry is a count or list computed from the data during the run."""

    started: str = field(default_factory=lambda: dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"))
    sections: dict[str, list[str]] = field(default_factory=dict)
    tables: dict[str, pd.DataFrame] = field(default_factory=dict)
    files: dict[str, dict] = field(default_factory=dict)
    sources: dict[str, dict] = field(default_factory=dict)

    def note(self, section: str, line: str) -> None:
        self.sections.setdefault(section, []).append(line)

    def table(self, name: str, df: pd.DataFrame) -> None:
        self.tables[name] = df

    def wrote(self, name: str, df: pd.DataFrame, **meta) -> None:
        self.files[name] = {"rows": int(len(df)), "columns": list(df.columns), **meta}

    def source(self, sid: str, status: str, **meta) -> None:
        self.sources[sid] = {"status": status, **meta}


def write_csv(df: pd.DataFrame, name: str, report: Report, **meta) -> Path:
    PREPARED.mkdir(parents=True, exist_ok=True)
    p = PREPARED / name
    df.to_csv(p, index=False, float_format="%.4g", lineterminator="\n")
    report.wrote(name, df, **meta)
    return p


def write_json(obj, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
