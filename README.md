# Neerakshi

**Every drop, seen from the sky.**

Neerakshi is a satellite-driven agricultural water intelligence platform for India. It connects district-level water stress analysis with an explainable, field-level FAO-56 irrigation advisory.

- Live deployment: https://neerakshi.vercel.app
- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, MapLibre GL, Drizzle ORM + SQLite
- Data pipeline: Python 3 with NASA POWER, geoBoundaries and deterministic interface fixtures

## What it does

| Route | Purpose |
| --- | --- |
| `/` | Cinematic Earth-to-field journey and platform overview |
| `/overview` | National water stress summary, hotspots, monsoon series and district map |
| `/atlas` | Interactive district atlas with rainfall, groundwater, irrigation and NDVI layers |
| `/monsoon` | Rainfall time series, heatmaps and district drill-down |
| `/groundwater` | Pre- and post-monsoon depth views (demo fixture) |
| `/crops` | Crop production, area and yield exploration (demo fixture) |
| `/advisor` | Draw a field, choose crop and soil, and receive a FAO-56 irrigation decision |
| `/impact` | Theory of change, coverage and the impact evaluation framework |
| `/methods` | Data lineage, index definition, validation results and limitations |

## Data provenance

This distinction is central to the project and is surfaced in the UI.

| Layer | Provenance | Source |
| --- | --- | --- |
| District and state boundaries | Observed / open | geoBoundaries gbOpen 2021 (ODbL 1.0) |
| Rainfall and temperature | Reanalysis | NASA POWER / MERRA-2, 2015–2025 |
| Groundwater depth | Demo fixture | Deterministic values on the CGWB schema |
| Irrigation share | Demo fixture | Deterministic values on the ICRISAT / data.gov.in schema |
| Crop production | Demo fixture | Deterministic values on the data.gov.in schema |
| Basemap | Observed | EOX Sentinel-2 cloudless 2024 |
| Vegetation raster | Observed | NASA GIBS MODIS Terra NDVI 8-day |
| Weather forecast | Live | Open-Meteo |
| Field satellite statistics | Live | Sentinel-2 L2A via Earth Search STAC + titiler |

The Water Stress Index is a project-defined composite of percentile-ranked rainfall departure, groundwater depth and non-irrigated share. It is not an official government classification.

No measured water savings, yield gains or income effects are claimed.

## Project structure

```text
.
├── data/
│   ├── prepared/            # Runtime datasets consumed by the app
│   ├── raw/                 # Pipeline inputs and cached NASA POWER responses
│   └── reference/           # Crop mapping and dataset manifest
├── pipeline/                # Python build pipeline and requirements
├── public/
│   ├── geo/                 # District and state GeoJSON for maps
│   ├── images/              # Photography used by the journey pages
│   └── vendor/              # Generated MapLibre worker (gitignored)
├── scripts/
│   ├── copy-maplibre-worker.mjs
│   └── init-db.ts
├── src/
│   ├── app/                 # App Router pages and API routes
│   ├── components/          # Advisor, atlas, charts, journey, maps, navigation, shared
│   ├── db/                  # Drizzle schema and SQLite client
│   ├── i18n/                # English, Hindi and Kannada messages
│   └── lib/                 # Data loaders, agro model, services, utilities
├── tests/unit/              # Vitest unit tests
├── next.config.ts
├── package.json
└── vercel.json
```

## Getting started

Requirements:

- Node.js 20 or newer
- pnpm 10
- Python 3.11+ only if you rebuild the datasets

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

The local SQLite database is created automatically at `data/app/neerakshi.db`. To choose another location, set `NEERAKSHI_DB_PATH`.

## Environment variables

| Variable | Required | Used by |
| --- | --- | --- |
| `NEERAKSHI_DB_PATH` | No | Overrides the SQLite file path |
| `DATA_GOV_IN_API_KEY` | No | Python pipeline, for future official dataset downloads |
| `VERCEL` | Auto | Switches the database to ephemeral `/tmp` storage |

No API keys are required to run the web application. Weather, satellite and place-search requests use public endpoints.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Generate the MapLibre worker and build for production |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run the TypeScript compiler |
| `pnpm test` | Run Vitest in watch mode |
| `pnpm test:run` | Run Vitest once |
| `pnpm db:init` | Create the local SQLite tables |
| `pnpm pipeline` | Rebuild all prepared datasets (network access required) |
| `pnpm pipeline:offline` | Rebuild using cached NASA POWER responses |

## Data pipeline

The pipeline is deterministic from its inputs. It:

1. Builds district and state geometry from geoBoundaries.
2. Fetches monthly meteorology for district representative points from NASA POWER.
3. Generates documented demo fixtures for groundwater, irrigation and crops.
4. Computes the Water Stress Index and writes prepared tables and map data.
5. Writes a validation report and a metadata manifest with file checksums.

Run it with:

```bash
python3 -m pip install -r pipeline/requirements.txt
pnpm pipeline
```

The runtime application only reads `data/prepared/` and `public/geo/`; it does not call the Python pipeline.

## Testing

```bash
pnpm test:run
```

The committed suite covers utility formatting, stress-class boundaries and clamping. Browser and visual checks were performed during development with Playwright but are not part of the committed test suite.

## Production and persistence

The app deploys to Vercel. On Vercel, SQLite is placed in `/tmp`, which is ephemeral: saved fields and advisories can disappear between deployments or cold starts. For durable field storage, configure an external database.

The MapLibre worker is copied from `node_modules` into `public/vendor/` by `scripts/copy-maplibre-worker.mjs` during `dev` and `build`, because the bundler does not emit the worker beside the Next.js chunk.

## Known limitations

- Groundwater, irrigation and crop production are demo fixtures, not observations.
- Rainfall is gridded reanalysis, not IMD rain-gauge interpolation.
- Boundaries are geoBoundaries, not Survey of India administrative boundaries.
- District NDVI statistics are not generated; NDVI is a raster context layer only.
- The prepared advisory log is empty; field impact requires a live deployment log.
- No measured impact is claimed.

## License

See [LICENSE](LICENSE).
