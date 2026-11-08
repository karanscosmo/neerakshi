"""Reproducible Neerakshi data pipeline.

Usage:
    python -m pipeline.run_all
    python -m pipeline.run_all --skip-climate   # reuse cached POWER responses
"""
from __future__ import annotations

import argparse
import sys
import time

from .climate import build_climate
from .config import PREPARED
from .fixtures import build_fixtures
from .geodata import build_geography
from .index import build_index, write_metadata, write_validation_report
from .io_utils import ensure_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Neerakshi prepared datasets")
    parser.add_argument(
        "--skip-climate",
        action="store_true",
        help="Reuse cached NASA POWER responses (no network calls)",
    )
    args = parser.parse_args()

    started = time.time()
    ensure_dir(PREPARED)
    print("[1/6] Building district and state geography")
    geography = build_geography()
    districts = geography["districts"]
    print(f"      {len(districts)} districts, {len(geography['states'])} states")

    print("[2/6] Fetching NASA POWER climate reanalysis")
    if args.skip_climate:
        print("      --skip-climate: using cached responses where available")
    climate = build_climate(districts)
    print(
        f"      {len(climate['summaries'])} districts with rainfall, "
        f"{len(climate['errors'])} errors"
    )

    print("[3/6] Building documented interface fixtures")
    fixtures = build_fixtures(districts, climate["summaries"])
    print(
        f"      irrigation={len(fixtures['irrigation'])} "
        f"groundwater={len(fixtures['groundwater'])} "
        f"crops={len(fixtures['crops'])}"
    )

    print("[4/6] Computing Neerakshi Water Stress Index")
    atlas = build_index(districts, climate, fixtures)
    print(f"      classes={atlas['classes']}")

    print("[5/6] Writing validation report")
    write_validation_report(districts, climate, fixtures, atlas, climate["errors"])

    print("[6/6] Writing metadata manifest")
    write_metadata(districts, climate, fixtures)

    elapsed = time.time() - started
    print(f"Done in {elapsed:.1f}s -> {PREPARED}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
