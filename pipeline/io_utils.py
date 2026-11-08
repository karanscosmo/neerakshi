"""Small IO helpers shared by the pipeline."""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def download(url: str, dest: Path, *, timeout: int = 120, retries: int = 3) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    ensure_dir(dest.parent)
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with requests.get(url, timeout=timeout, stream=True) as response:
                response.raise_for_status()
                tmp = dest.with_suffix(dest.suffix + ".part")
                with open(tmp, "wb") as handle:
                    for chunk in response.iter_content(chunk_size=1 << 20):
                        handle.write(chunk)
                tmp.replace(dest)
            return dest
        except Exception as exc:  # noqa: BLE001 - pipeline surfaces the final error
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Could not download {url}: {last_error}")


def get_json(url: str, *, params: dict | None = None, cache: Path | None = None,
             timeout: int = 120, retries: int = 4, headers: dict | None = None) -> object:
    if cache and cache.exists() and cache.stat().st_size > 0:
        with open(cache, encoding="utf-8") as handle:
            return json.load(handle)
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, timeout=timeout, headers=headers)
            response.raise_for_status()
            payload = response.json()
            if cache:
                ensure_dir(cache.parent)
                with open(cache, "w", encoding="utf-8") as handle:
                    json.dump(payload, handle)
            return payload
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Request failed for {url}: {last_error}")


def write_json(path: Path, payload: object) -> None:
    ensure_dir(path.parent)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, default=str)
