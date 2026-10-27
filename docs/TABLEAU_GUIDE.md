# Tableau build guide

Six dashboards and one Story, built from `data/prepared/` with the **same metric definitions** as the app (see `data/prepared/README.md`). Works in Tableau Desktop or Tableau Public.

## 0. Connect

1. *Connect → Text file →* `data/prepared/districts.csv`.
2. Drag in, as **relationships** (not joins) on `district_id`: `water_stress_index.csv`, `groundwater_district.csv`, `rainfall_district_season.csv`, `crop_district_annual.csv`, `crop_production.csv`, `ndvi_district_monthly.csv`, `irrigation_district.csv`.
3. Separately add `monsoon_series.csv` and `rainfall_subdivision_monthly.csv` (no district key) and `advisories.csv` (relate on `district_id`).
4. *Spatial file →* `districts.geojson`; relate its `id` to `districts.district_id`.
5. Set geographic roles: `lat` → Latitude, `lon` → Longitude.
6. Formats: `departure_pct`, `irrigated_share_pct` → number, 0 decimals, suffix `%`; `*_mbgl` → 1 decimal, suffix ` m`.

### Shared calculated fields (identical to the app)
```
// Yield (t/ha) — aggregate first, then divide
[Yield t/ha] = SUM([production_t]) / SUM([area_ha])

// Deficit / excess year flag
[Monsoon class] = IF [departure_pct] <= -10 THEN "Deficit"
                  ELSEIF [departure_pct] >= 10 THEN "Excess" ELSE "Normal" END

// Groundwater decline (positive = deeper than 1996–2005)
[Decline m] = [change_vs_baseline_m]
```
Never average `yield_t_per_ha` or `departure_pct` across regions; use the formulas above.

### Palette (create a custom palette in `My Tableau Repository/Preferences.tps`)
```xml
<color-palette name="Neerakshi stress" type="ordered-sequential">
  <color>#EFE6D2</color><color>#E3A65A</color><color>#B8834A</color><color>#A9533E</color><color>#6E2F22</color>
</color-palette>
<color-palette name="Neerakshi diverging" type="ordered-diverging">
  <color>#A9533E</color><color>#D9A27F</color><color>#EFE6D2</color><color>#7FB2B5</color><color>#2F7F86</color>
</color-palette>
```
Font: Fraunces for titles (or Georgia), IBM Plex Sans for text. Background `#EFE6D2`.

## 1. Water Stress Overview
- **Map**: `districts.geojson` geometry; Color = `stress_index_0_100` (Neerakshi stress palette, 5 steps); Tooltip: district, state, index, `rank_national`, `rank_state`, `components_used`.
- **Component filters**: parameter *Component* (Index / Rain / Groundwater / Irrigation) → calculated field switching Color among `stress_index_0_100`, `rain_score*100`, `gw_score*100`, `irrigation_score*100`.
- **Drill-down**: state filter (action on a states bar chart) → map zooms to state; a bar chart of the selected state's districts sorted by index.
- Caption: "Neerakshi composite, not an official index. Rain: JJAS departure {rain_period} ({rain_basis}). Groundwater: pre-monsoon depth {gw_year}."

## 2. Monsoon Story
- **Long-run bars**: `monsoon_series` filtered `region_type = india`; Columns `year`, Rows `departure_pct`; Color `[Monsoon class]` (Deficit = `#A9533E`, Excess = `#2F7F86`, Normal = `#D9CFBB`). Reference line at 0.
- **Month × year heatmap**: `rainfall_subdivision_monthly`; Columns `month`, Rows `year`, Color `departure_pct` (diverging palette, centre 0, clamp ±100). Filter `subdivision` (parameter driven by the district's `imd_subdivision`).
- **State 1981–2025**: `monsoon_series` `region_type = state`, line by year.

## 3. Groundwater Depletion Tracker
- **Line**: `groundwater_district` Columns `year`, Rows `median_depth_mbgl` (reversed axis: depth increases downward), Color `season`.
- **Animated map**: map coloured by `median_depth_mbgl` (pre_monsoon only), **Pages shelf = `year`** (Tableau's animation). Sequential teal→ochre.
- **Ranked strip**: latest year's `change_vs_baseline_m`, top 20 districts.

## 4. Crop, Rain and Irrigation
- **Scatter**: rows = `[Yield t/ha]` from `crop_district_annual`, columns = `departure_pct` from `rainfall_district_season` (season = jjas, same `year`), Detail = district + year, Color = `irrigated_share_pct` (when loaded). Filter `crop`.
- Caption: "Correlation only — this chart does not show cause."
- Trend lines of production, area and yield by year (dual axis).

## 5. Satellite Crop Health
- `ndvi_district_monthly`: line `ndvi_median` by `month`, Color by district; seasonality = average by month-of-year; anomaly = `ndvi_median − WINDOW_AVG(ndvi_median)` by same month across years.
- Show an empty-state text box if the source has no rows ("NDVI batch not yet run").

## 6. Advisory Activity
- `advisories.csv`: bar of count by `date` (day), stacked by `advice_type`; map of counts by `district_id`; crop breakdown.
- Live option: see below.

## Story: "Every drop, seen from the sky"
1. *Where is farming under water stress?* — Dashboard 1.
2. *A century of monsoons* — Dashboard 2, deficit years highlighted (2002, 2009, 2014 …).
3. *The water table below* — Dashboard 3.
4. *Rain, irrigation and yield* — Dashboard 4 (correlation caption).
5. *Seen from space* — Dashboard 5.
6. *From atlas to advice* — Dashboard 6.

## Live Tableau Public dashboard (optional)
Tableau Public can refresh daily from **Google Sheets**, not from CSVs. Optional job:
1. Create a Google Cloud service account with the Sheets API, download its JSON key, share the target Sheet with the service-account email.
2. Add GitHub secrets `GOOGLE_SERVICE_ACCOUNT_JSON`, `ADVISORIES_SHEET_ID`, `NEERAKSHI_EXPORT_URL` (= `https://<site>/api/admin/export?format=csv`) and `ADMIN_PASSCODE`.
3. Enable `.github/workflows/advisories-to-sheet.yml`; it runs daily, downloads the anonymised CSV and overwrites the sheet's first tab.
4. In Tableau Public, connect to the Google Sheet and tick *Keep data in sync*.
