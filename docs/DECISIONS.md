# Decisions and assumptions

Every default chosen without asking, with the reason. Newest sections at the bottom of each group.

## Scope

- **Demo region**: Karnataka. **Default district**: Mandya (`d573`) — Cauvery-irrigated paddy and sugarcane, both target crops, good groundwater coverage. Used when the visitor neither shares location nor picks a district.
- **Crops**: rice, wheat, maize, sugarcane only. Others exist in APY but are out of scope.
- **Languages**: English, Hindi, Kannada. Strings are hand-written per language; Hindi and Kannada need native review (MANUAL_STEPS §3).
- **WhatsApp Business** delivery is a production extension, not part of the demo (needs Meta business verification and paid templates). Telegram is free and needs no approval, so it is the demo channel.
- **Predictive ML**: not built. The advisory stands on FAO-56. Honest evaluation would need years of field NDVI, which this build could not download. No accuracy numbers are reported anywhere.

## Data

- **Canonical districts = Census 2011 (640 polygons, DataMeet)**. Newer datasets use up to 737 names; districts carved out after 2011 are summed into their *principal* parent (method `carved_principal_parent` in the crosswalk). Where a new district came from two parents (e.g. Amethi from Sultanpur and Rae Bareli) the whole of it goes to one parent — a known, documented approximation.
- **Matching** is explicit: hand-written aliases (`data/reference/district_aliases.csv`) or exact match after normalisation (lower-case, `&`→`and`, letters only) inside the right state. No similarity scoring.
- **GitHub mirrors** were used because the official portals were unreachable from the build machine. Each mirror is pinned to a commit and its provenance is stated in DATA_SOURCES. Byte identity with the portal file is unverified for APY (the mirror author's own check is quoted).
- **Rainfall basis**: district rainfall uses IMD *sub-divisional* values (1901–2015) and IMD-grid *state* values (2016–2025) until the IMD 0.25° grid files are added. The `spatial_basis` column and every map key say which. Subdivision normal = 1951–2000 (IMD's long-period-average base before 2022); state normal = 1981–2010 (as published by the aggregator). Departures from the two bases are not mixed in one statistic except the Atlas year slider, which labels the basis of each year.
- **All-India JJAS** = subdivision values area-weighted by summed Census 2011 district areas. 1951–2000 mean = 902 mm vs IMD's 890 mm LPA — reported as a consistency check only.
- **Groundwater**: pre-monsoon = May, post-monsoon = November reading. Change vs baseline uses each well's own 1996–2005 mean (≥ 3 readings) so network changes do not create false trends. Depths > 200 m removed as entry errors (12 readings). The network is mostly dug wells (shallow aquifer).
- **Yield thresholds** (rows above are excluded and listed): rice 12, wheat 10, maize 15, sugarcane 200 t/ha.
- **Water Stress Index**: equal-weight mean of percentile-ranked components, needs ≥ 2 components; with ICRISAT missing it is rain + groundwater. Labelled "Neerakshi composite, not an official index" everywhere it appears.
- **IMD district normals file** not used (truncated names; source mixing). See DATA_SOURCES D3e.
- **Prepared CSVs are committed** (≈ 40 MB) so Tableau users and classmates need no Python; raw files are git-ignored and re-downloaded by `python -m pipeline.run_all --fetch`.

## Agronomy

- **FAO-56 table rows chosen**: rice tropics 150 d; wheat "Central India, Nov" 120 d; maize "India, Oct dry season" 125 d; sugarcane ratoon tropics 320 d. Kc ranges resolved to the midpoint (rice end 0.75) or the dry-harvest value (maize end 0.35). Root depth midpoints of Table 22 ranges.
- **Soils**: four farmer-recognisable classes mapped to FAO-56 Table 19 midpoints; "clay loam" uses Table 19's silty clay loam (no clay loam row).
- **Effective rainfall**: ignore rain < 0.2·ET₀ (evaporates from the surface; FAO-56 §8); otherwise 80 % of rain is effective; anything beyond refilling the root zone is deep percolation. Chosen over USDA-SCS because SCS is a *monthly* method and the balance is daily.
- **Application efficiency** (Brouwer et al. 1989, FAO Training Manual 4): flood/basin and furrow 60 %, drip 90 %.
- **Water stress coefficient Ks** (FAO-56 Eq. 84) is applied, so actual ET falls once depletion exceeds RAW.
- **p adjustment** for ETc (FAO-56 Table 22 footnote) is applied.
- **Spin-up**: start at field capacity on the last recorded irrigation; if unknown, on max(sowing date, today − 30 d), and say so on the card. History beyond 92 days is not available from the forecast API, so start is never earlier than today − 92 d.
- **"Meaningful rain"** = 10 mm (from the brief). The gap case (stressed, ≥ 10 mm forecast only on day 3) → irrigate now (the brief waits only for rain within 48 h).
- **Satellite Kc adjustment**: Kamble et al. (2013) Kc = 1.457·NDVI − 0.1725, ratio to FAO Kc clamped to ±15 %, only for fresh (≤ 10 d) cloud-free NDVI in development/mid/late stages, never for rice (flooded paddy). Stage mismatch is a flag only.
- **Rice**: the soil-moisture bucket is a simplification for puddled paddy; the card says so via the methods page.

## Design

- **Palette**: the brief's colours are kept as fills. For *text* on paper, darker shades are added (`--teal-text #256A70`, `--olive-text`, `--ochre-text`, `--laterite-text`, `--slate-text`) because e.g. teal on paper is 3.76:1 (< WCAG AA 4.5:1). All text pairs used are ≥ 4.5:1.
- **Fonts** are self-hosted from @fontsource packages through `next/font/local` (Google Fonts is not reachable from the build machine, and self-hosting avoids a runtime third party). Devanagari/Kannada faces are not preloaded; they load only when used.
- **Basemap**: the Atlas draws its own paper-style map from TopoJSON (graticule, compass rose, scale bar) in MapLibre with no external tile server, so it works offline and looks like a survey sheet. The field-drawing step uses EOX Sentinel-2 cloudless imagery tiles (free, attribution required) as the satellite basemap.
- **Field drawing**: Terra Draw polygon mode on MapLibre, as suggested in the brief.

## Platform

- **Local database**: when `DATABASE_URL` is empty in development, the app uses embedded PGlite (`.data/pglite`) with the same Drizzle schema and migrations. Production must use Neon.
- **Next.js 16 / React 19 / Drizzle 0.45 / MapLibre 6 / Vitest 5** — current versions at build time.
