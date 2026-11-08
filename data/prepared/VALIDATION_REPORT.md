# Neerakshi Prepared Data Validation Report

Generated: 2026-11-07T06:10:25.239462+00:00

## Summary

- Districts in boundary reference: **735**
- Districts with rainfall summary: **735**
- Districts missing a POWER response: **0**
- Monsoon observations: **8085** district-year rows
- Monthly rainfall observations: **97020** rows
- Advisory index version: **0.1.0**

## File inventory

| file                          |   rows |   columns |   null_cells |   duplicate_rows |   size_kb |
|:------------------------------|-------:|----------:|-------------:|-----------------:|----------:|
| advisories.csv                |      0 |        17 |            0 |                0 |       0.2 |
| crop_production.csv           |  14700 |        14 |            0 |                0 |    4151.2 |
| district_crosswalk.csv        |    735 |         9 |            0 |                0 |     100.5 |
| groundwater_district.csv      |   4410 |        10 |            0 |                0 |    1060   |
| irrigation_district.csv       |   4410 |        10 |            0 |                0 |    1117.4 |
| rainfall_district_monthly.csv |  97020 |        10 |          132 |                0 |   11390.8 |
| rainfall_district_season.csv  |   8085 |        11 |            0 |                0 |    1084.4 |
| water_stress_index.csv        |    735 |        31 |            2 |                0 |     199.1 |

## Water-stress class distribution

|   Low |   Moderate |   High |   Severe |   Unavailable |
|------:|-----------:|-------:|---------:|--------------:|
|    66 |        386 |    242 |       41 |             0 |

## Year coverage

### Rainfall season

|   year |   rows |
|-------:|-------:|
|   2015 |    735 |
|   2016 |    735 |
|   2017 |    735 |
|   2018 |    735 |
|   2019 |    735 |
|   2020 |    735 |
|   2021 |    735 |
|   2022 |    735 |
|   2023 |    735 |
|   2024 |    735 |
|   2025 |    735 |

### Rainfall monthly

|   year |   rows |
|-------:|-------:|
|   2015 |   8820 |
|   2016 |   8820 |
|   2017 |   8820 |
|   2018 |   8820 |
|   2019 |   8820 |
|   2020 |   8820 |
|   2021 |   8820 |
|   2022 |   8820 |
|   2023 |   8820 |
|   2024 |   8820 |
|   2025 |   8820 |

### Groundwater (fixture)

|   year |   rows |
|-------:|-------:|
|   2019 |    735 |
|   2020 |    735 |
|   2021 |    735 |
|   2022 |    735 |
|   2023 |    735 |
|   2024 |    735 |

### Crop production (fixture)

|   year |   rows |
|-------:|-------:|
|   2020 |   2940 |
|   2021 |   2940 |
|   2022 |   2940 |
|   2023 |   2940 |
|   2024 |   2940 |

### Irrigation (fixture)

|   year |   rows |
|-------:|-------:|
|   2019 |    735 |
|   2020 |    735 |
|   2021 |    735 |
|   2022 |    735 |
|   2023 |    735 |
|   2024 |    735 |


## State coverage

### Rainfall season

| state                                    |   rows |
|:-----------------------------------------|-------:|
| Andaman and Nicobar Islands              |     33 |
| Andhra Pradesh                           |    154 |
| Arunachal Pradesh                        |    275 |
| Assam                                    |    363 |
| Bihar                                    |    418 |
| Chandigarh                               |     11 |
| Chhattisgarh                             |    308 |
| Dadra and Nagar Haveli and Daman and Diu |     33 |
| Delhi                                    |    121 |
| Goa                                      |     22 |
| Gujarat                                  |    363 |
| Haryana                                  |    231 |
| Himachal Pradesh                         |    132 |
| Jammu and Kashmir                        |    220 |
| Jharkhand                                |    264 |
| Karnataka                                |    330 |
| Kerala                                   |    154 |
| Ladakh                                   |     33 |
| Lakshadweep                              |     11 |
| Madhya Pradesh                           |    572 |
| Maharashtra                              |    396 |
| Manipur                                  |    176 |
| Meghalaya                                |    121 |
| Mizoram                                  |    121 |
| Nagaland                                 |    121 |
| Odisha                                   |    330 |
| Puducherry                               |     33 |
| Punjab                                   |    242 |
| Rajasthan                                |    363 |
| Sikkim                                   |     44 |
| Tamil Nadu                               |    418 |
| Telangana                                |    363 |
| Tripura                                  |     88 |
| Uttar Pradesh                            |    825 |
| Uttarakhand                              |    143 |
| West Bengal                              |    253 |


## Missing values (key columns)

|   rainfall_missing_departure |   rainfall_missing_monsoon |   groundwater_missing_pre |   crop_missing_yield |
|-----------------------------:|---------------------------:|--------------------------:|---------------------:|
|                            0 |                          0 |                         0 |                    0 |

## Unmatched / excluded districts

None.

## Pipeline errors

None.

## Data integrity warnings

- Groundwater, irrigation and crop-production layers are synthetic fixtures (provenance=demo_fixture). They are NOT observations.
- Rainfall is NASA POWER / MERRA-2 reanalysis sampled at district representative points; it is not the IMD rain-gauge product.
- District boundaries are geoBoundaries gbOpen 2021 (ODbL 1.0), not the Survey of India administrative boundary.
- NDVI district statistics are not generated by this pipeline. The application uses NASA GIBS MODIS NDVI tiles and live Sentinel-2 statistics for fields.
- No missing rainfall values were zero-filled. Districts without a successful POWER response are excluded from rainfall-derived metrics.

## Sources

- Boundaries: geoBoundaries gbOpen IND ADM1/ADM2 (2021), ODbL 1.0.
- Climate: NASA POWER API v2, MERRA-2 monthly reanalysis (public domain).
- Crop coefficients: FAO Irrigation and Drainage Paper 56.
- Official datasets requiring manual acquisition: see docs/MANUAL_STEPS.md.
