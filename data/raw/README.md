# data/raw (git-ignored)

Raw source files live here and are **not committed**. Rebuild them with:

```bash
python -m pipeline.sources          # download every automatic source (pinned GitHub mirrors)
```

`manifest.csv` (committed) records each file's URL, retrieval time and SHA-256. Manual-only sources (ICRISAT, IMD grid) are described in `docs/MANUAL_STEPS.md`.
