# Data sources

What each source really contains, as inspected while building the pipeline (October 2026). Every raw file, its URL, retrieval time and SHA-256 is recorded in `data/raw/manifest.csv` by `python -m pipeline.sources`.

> **Network note.** The build container could reach GitHub but not data.gov.in, India Data Portal, IMD Pune, India-WRIS, ICRISAT, Copernicus, Planetary Computer, Open-Meteo or CelesTrak. National datasets were therefore taken from **GitHub mirrors pinned to a commit**, and each mirror's provenance is stated below. The runtime APIs (Open-Meteo, Copernicus, CelesTrak, Telegram) are called from the deployed server, not the build container.

## D1 — District-wise, season-wise crop production (APY)

| | |
|---|---|
| Publisher | Directorate of Economics & Statistics (DES), Ministry of Agriculture & Farmers Welfare |
| Original | data.gov.in "District-wise, season-wise crop production statistics from 1997"; updated series on India Data Portal (`area-production-yield-apy`, Open Data Commons Attribution) |
| Obtained from | `github.com/Ankush-Manhas840/crop-yield-prediction@f42942c` → `data/crop_production.csv`. The mirror's author replaced the old 1997–2014 data.gov.in file with the India Data Portal 1997–2022 series, renamed the columns to the original schema and dropped the `Total` season rows (which sum the other seasons). They report 99.9 % identical area values for 2005 between the two series. |
| Columns (checked) | `State_Name, District_Name, Crop_Year, Season, Crop, Area, Production` |
| Units | Area in hectares; Production in tonnes for cereals and sugarcane (cotton in bales and coconut in nuts — not used) |
| Coverage | 407,315 rows; 34 states/UTs; 737 district names; crop years 1997–2022 (`Crop_Year` is the first year of the agricultural year); 6 seasons (Kharif, Rabi, Autumn, Summer, Winter, Whole Year); 115 crops |
| Licence | GODL-India / ODC-By; attribute DES, MoA&FW |
| Used | rice, wheat, maize, sugarcane only (`data/reference/crop_mapping.csv`). Rice is reported as rice, not paddy. |

## D2 — ICRISAT District Level Database (irrigated area)

| | |
|---|---|
| Publisher | ICRISAT-TCI, http://data.icrisat.org/dld/ |
| Access | Free registration, then manual download. **Not obtained** in this build (host unreachable and login needed). |
| Licence | CC BY 4.0 |
| Status | Importer written (`pipeline/irrigation.py`); it recognises the DLD column pattern `<CROP> IRRIGATED AREA (1000 ha)` / `<CROP> AREA (1000 ha)` and refuses to guess otherwise. Until the file is added, `irrigation_district.csv` holds headers only and the stress index has two components. |

## D3 — Rainfall (IMD)

### D3a — Sub-divisional monthly rainfall 1901–2015

| | |
|---|---|
| Publisher | India Meteorological Department, via data.gov.in ("Rainfall in India 1901–2015") |
| Obtained from | `github.com/yRaviKanthh/india-rainfall-dashboard@e8d66dd` → `rainfall in india 1901-2015.csv` |
| Columns | `SUBDIVISION, YEAR, JAN … DEC, ANNUAL, Jan-Feb, Mar-May, Jun-Sep, Oct-Dec` |
| Units | mm |
| Coverage | 36 meteorological subdivisions × 1901–2015; 70 missing monthly cells (kept null) |
| Licence | GODL-India |

### D3b — District → IMD subdivision mapping

`github.com/hssling/elnino-heat-india@e89069c` → `pipeline/reference/district_to_imd_subdivision.csv` (CC BY 4.0). Columns `region_id, district_name, state_name, imd_subdivision, imd_subdivision_current, imd_district, basis, note`; 666 rows (GADM district names). Matched to Census 2011 districts through the crosswalk.

### D3c — IMD gridded rainfall aggregated to states, 1981–2025

`github.com/hssling/elnino-heat-india@e89069c` → `data/derived/climate_unit_year.csv` (CC BY 4.0 for the aggregation; IMD gridded-data terms). Built by the repository author from IMD 0.25° daily gridded rainfall, area-weighted to 34 state units. Columns used: `unit_id, year, rain_jjas_mm, rain_jjas_normal_mm (1981–2010 mean), rain_jjas_dep_pct`. Andaman & Nicobar has no valid grid cell and Lakshadweep is a Kerala-coast proxy, so both are excluded (as the author recommends). Tamil Nadu and Puducherry 2011–12 are already blank (IMD grid artefact).

### D3d — IMD 0.25° gridded daily rainfall (district level) — preferred, manual

`imdlib` (installed) downloads from imdpune.gov.in, which was unreachable here. `pipeline/rainfall.py` reads yearly `.grd` files from `data/raw/imd/grid/` when present and then **overrides** subdivision values with true district means (cells whose centres fall inside the district). See `MANUAL_STEPS.md`.

### D3e — IMD district rainfall normals (not used)

`district_wise_rainfall_normal.csv` was downloaded but **not used**: district names are truncated to 13 characters (e.g. `TIRUVANNAMALA`, `SOUTH 24 PARG`), which would need 168 hand aliases, and comparing IMD normals with Open-Meteo actuals would mix sources. The "this season vs normal" ribbon instead compares Open-Meteo with Open-Meteo's own 1991–2020 history.

## D4 — CGWB groundwater levels

| | |
|---|---|
| Publisher | Central Ground Water Board |
| Obtained from | `github.com/craigdsouza/cgwb@caebf7e` → `data/CGWB_data_wide.csv` ("obtained by email from CGWB by Tejasvi Hora, University of Waterloo") |
| Columns | `(index), STATE, DISTRICT, LAT, LON, SITE_TYPE, WLCODE, May 1996, Aug 1996, Nov 1996, Jan 1997, …, Jan 2017` |
| Units | metres below ground level (mbgl) |
| Coverage | 28,076 wells (19,672 dug wells, 3,975 bore wells, 3,801 tube wells …); 24 state codes; readings May/Aug/Nov/Jan 1996 – Jan 2017; 491,563 May+Nov readings |
| Values | min −2.33 (artesian), median 5.87, max 534 (12 readings > 200 m treated as entry errors) |
| Caveat | Mostly dug wells, i.e. the shallow phreatic aquifer. Deep hard-rock borewell depths (often > 100 m in e.g. Kolar) are not represented. |

## D5 — Sentinel-2 L2A via Copernicus Data Space Ecosystem (runtime)

Sentinel Hub **Statistical API** (`https://sh.dataspace.copernicus.eu/api/v1/statistics`), OAuth2 client-credentials token from `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`. Free CDSE accounts get a monthly processing-unit quota (see the CDSE quota page). Called only from `lib/server/cdse.ts`; responses cached in Postgres for 24 h. Not callable from the build container; implementation follows the documented request schema and is exercised by unit tests on request construction and response parsing only.

## D6 — Sentinel-2 L2A via Microsoft Planetary Computer (batch)

STAC API `https://planetarycomputer.microsoft.com/api/stac/v1`, collection `sentinel-2-l2a` (bands B04, B08, SCL) and `esa-worldcover` (class 40 cropland). Anonymous access with SAS-signed asset URLs (`planetary-computer` package). Batch job `python -m pipeline.ndvi`. Not run in this build (host unreachable) — `ndvi_district_monthly.csv` is header-only.

## D7 — Open-Meteo (runtime)

Forecast API `https://api.open-meteo.com/v1/forecast` with `daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min`, `hourly=soil_moisture_9_to_27cm`, `past_days≤92`, `forecast_days=8`, `timezone=Asia/Kolkata`. Historical API `https://archive-api.open-meteo.com/v1/archive` for 1991–2020 season normals. No key; free for non-commercial use (fair use ≈ 10,000 calls/day); attribution CC BY 4.0. Cached in Postgres (`api_cache`) for 3 h (forecast) and 30 days (archive).

## D8 — FAO-56 crop tables → `data/reference/fao56_crops.csv`

Transcribed from Allen et al. (1998) Tables 11 (stage lengths), 12 (Kc) and 22 (root depth, p). Each row cites its table and the range it picked from. **Check against the PDF before submission** (MANUAL_STEPS item).

## D9 — Soil water → `data/reference/soil_types.csv`

FAO-56 Table 19 midpoints. "Clay loam" has no row in Table 19, so the closest listed texture (silty clay loam) is used and the CSV says so.

## D10 — Boundaries

DataMeet `maps@b3fbbde` (CC BY 2.5 India): `Districts/Census_2011/2011_Dist.*` (641 polygons incl. one "Data Not Available" polygon in J&K, EPSG:4326, fields `DISTRICT, ST_NM, ST_CEN_CD, DT_CEN_CD, censuscode`), `Survey-of-India-Index-Maps/Boundaries/India-States.*` and `Country/india-soi.geojson` (Survey of India national outline). Simplified with mapshaper to TopoJSON in `public/data/`.

## Sky

d3-celestial `stars.6.json` and `constellations.lines.json` (BSD-3-Clause; Hipparcos-derived): RA/Dec in degrees, V magnitude, B−V colour. The 300 brightest stars go to `public/data/sky.json`.

## Sentinel-2 orbit (runtime)

CelesTrak GP data for SENTINEL-2A (NORAD 40697) in TLE format, `https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=TLE`, cached for 12 h; propagated with `satellite.js` (SGP4).
