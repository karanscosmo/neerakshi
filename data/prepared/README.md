# Prepared datasets (Tableau-ready)

Flat, tidy CSVs: one row per observation, `snake_case` columns, units in the column name, UTF-8, `.` decimal, empty cell = unknown (never zero). Join everything on **`district_id`** (Census 2011 code with a `d` prefix, e.g. `d573` = Mandya).

**Refresh:** `python -m pipeline.run_all` (add `--fetch` to re-download raw files) → then `npm run db:load` for the app. Tableau: *Data → Refresh* on each source. Row counts, coverage and every excluded record are in `VALIDATION_REPORT.md`.

The app computes nothing that is not here: every metric shown in Neerakshi is read from these columns (or, for the live Advisor, from the FAO-56 module documented in `docs/ARCHITECTURE.md`).

---

## districts.csv — canonical districts
| column | meaning |
|---|---|
| district_id | `d` + Census 2011 district code. Primary key everywhere. |
| district_name, state_name, state_code | Census 2011 spelling; state codes ISO-style (KA, UP …; Telangana districts sit under AP as in 2011) |
| census_code | Census 2011 district code |
| lat, lon | representative point inside the polygon (degrees, WGS84) |
| area_km2 | polygon area, equal-area projection EPSG:6933 |
| imd_subdivision | IMD meteorological subdivision (as spelled in the 1901–2015 rainfall file) |

Geometry: `districts.geojson` (same `id` = district_id) for Tableau maps.

## crop_production.csv — year × district × season × crop
Source D1 (APY, DES MoA&FW). Crops: rice, wheat, maize, sugarcane.
| column | unit | rule |
|---|---|---|
| year | crop year (first year of the agricultural year) | |
| district_id | | post-2011 districts summed into their Census 2011 parent |
| season | kharif, rabi, autumn, summer, winter, whole_year | preserved as reported |
| crop | rice, wheat, maize, sugarcane | rice = rice (not paddy) |
| area_ha | hectares | sum of source districts |
| production_t | tonnes | null if every part is null |
| yield_t_per_ha | t/ha | production_t / area_ha, only when area > 0 and production known |

**Aggregation:** sum `area_ha` and `production_t` across seasons/districts, then divide — never average `yield_t_per_ha`.

## crop_district_annual.csv — year × district × crop
Seasons summed (safe: the source has no "Total" rows). `production_t` and `yield_t_per_ha` are null when any season has area but unknown production. Extra column `seasons` = number of seasons reported.

## irrigation_district.csv — year × district × crop
Source D2 (ICRISAT DLD). **Header-only until the manual download is done** (MANUAL_STEPS §2.1). Columns: `irrigated_area_ha`, `gross_cropped_area_ha` (crop area, or gross cropped area when crop = `all`), `irrigated_share_pct` = 100 × irrigated / cropped (capped at 100).

## rainfall_district_season.csv — year × district × season
| column | meaning |
|---|---|
| season | `jjas` (Jun–Sep monsoon), `ond` (Oct–Dec), `annual` |
| rain_mm | season total; null unless every month is present |
| normal_rain_mm | mean of the base period in `normal_period` |
| departure_pct | 100 × (rain − normal) / normal |
| spatial_basis | `imd_grid_district` (true district mean of IMD 0.25° cells) > `imd_subdivision` (district takes its subdivision's value, 1901–2015) > `imd_grid_state` (state mean, JJAS only, 2016–2025). The finest available basis is kept. |
| normal_period | 1991-2020 (grid), 1951-2000 (subdivision), 1981-2010 (state) |

**Do not** average `departure_pct` across bases or compare departures with different `normal_period` without saying so.

## rainfall_district_monthly.csv — year × month × district (1971 onward)
Same columns as above at monthly grain (no `normal_period`; subdivision normal 1951–2000).

## rainfall_subdivision_monthly.csv — year × month × IMD subdivision (1901–2015)
The underlying sub-divisional series. Normal 1951–2000 (≥ 40 years required).

## monsoon_series.csv — region × year (JJAS)
| region_type | region_id | source |
|---|---|---|
| india | IN | subdivisions area-weighted by Census 2011 area; years with ≥ 90 % area reporting |
| subdivision | IMD subdivision name | IMD sub-divisional 1901–2015 |
| state | state unit (AP_TG = Andhra Pradesh + Telangana, DNH_DD = Dadra & Nagar Haveli + Daman & Diu) | IMD grid aggregated to states 1981–2025 |
| india_grid | IN | state units area-weighted (Census 2011 areas), 1981–2025, normal 1981–2010 |
Columns: `jjas_mm`, `normal_mm`, `departure_pct`. Deficit year: `departure_pct ≤ −10`; excess: `≥ +10`.

## groundwater_district.csv — year × season × district
Source D4 (CGWB wells, 1996–2016 May/Nov readings).
| column | meaning |
|---|---|
| season | `pre_monsoon` (May), `post_monsoon` (November) |
| median_depth_mbgl | median depth to water, metres below ground level, over wells read |
| well_count | wells with a reading |
| change_vs_baseline_m | median over wells of (depth − the well's own 1996–2005 mean for that season); positive = deeper = decline |
| baseline_wells | wells contributing to the change |

Aggregation: medians do not add; for state views, use the median of wells (re-run the pipeline) or show district medians side by side.

## water_stress_index.csv — district (latest)
**Neerakshi composite, not an official index.** Components (percentile rank 0–1, higher = more stress):
- `rain_score` ← mean JJAS `departure_pct` over `rain_period` (sign flipped; larger deficit → higher). `rain_basis` says which spatial basis was used.
- `gw_score` ← pre-monsoon `gw_depth_mbgl` in `gw_year` (deeper → higher).
- `irrigation_score` ← `irrigated_share_pct` in `irrigation_year` (higher dependence → higher). Absent until ICRISAT is added.

`stress_index_0_100 = 100 × mean(available scores)`, only when `components_used ≥ 2`. `rank_national` / `rank_state`: 1 = most stressed.

## ndvi_district_monthly.csv — month × district
Sentinel-2 L2A NDVI over ESA WorldCover cropland, SCL-masked. `ndvi_median` null when < 5 % valid pixels (cloud). **Header-only until the batch job runs** (MANUAL_STEPS §2.3).

## advisories.csv — export from the database
Written by the officer view (*Export advisories.csv*) or `npm run export:advisories`. Anonymised: no field id, owner, name, polygon or chat id. Columns: `date, district_id, district, crop, advice_type, etc_mm, rain_forecast_mm, deficit_mm, raw_mm, net_depth_mm`.

## district_crosswalk.csv, crop_mapping.csv — reference
Every source's district name → `district_id`, with `method` (`exact_normalised`, `rename`, `carved_principal_parent`, `unmatched`). Crop names per source → canonical crop.
