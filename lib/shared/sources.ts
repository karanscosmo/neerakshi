/** Registry of data sources shown on Methods & Sources and in "About this data" drawers. */
export type SourceInfo = {
  id: string;
  title: string;
  publisher: string;
  licence: string;
  url: string;
  usedFor: string;
  file?: string; // prepared CSV it feeds
  limitations: string;
};

export const SOURCES: SourceInfo[] = [
  {
    id: "D1_apy",
    title: "District-wise, season-wise crop production (APY), 1997–2022",
    publisher: "Directorate of Economics & Statistics, Ministry of Agriculture & Farmers Welfare (via India Data Portal / data.gov.in)",
    licence: "Open Data Commons Attribution / GODL-India",
    url: "https://ckandev.indiadataportal.com/dataset/area-production-yield-apy",
    usedFor: "Area, production and yield of rice, wheat, maize and sugarcane by district and season.",
    file: "crop_production.csv",
    limitations:
      "Obtained through a GitHub mirror (portal blocks automated download). Districts created after 2011 are summed into their 2011 parent. Rice is reported as rice, not paddy. 56 rows with physically implausible yields are excluded.",
  },
  {
    id: "D2_icrisat",
    title: "ICRISAT-TCI District Level Database (irrigated area)",
    publisher: "ICRISAT",
    licence: "CC BY 4.0",
    url: "http://data.icrisat.org/dld/",
    usedFor: "Irrigated share of cropped area (third component of the Water Stress Index).",
    file: "irrigation_district.csv",
    limitations: "Requires free registration and a manual download. Until it is added, the stress index uses two components.",
  },
  {
    id: "D3_subdiv",
    title: "IMD sub-divisional monthly rainfall, 1901–2015",
    publisher: "India Meteorological Department (via data.gov.in)",
    licence: "GODL-India",
    url: "https://data.gov.in/resource/sub-divisional-monthly-rainfall-1901-2017",
    usedFor: "Long-run monsoon history; district rainfall where gridded data is absent (each district takes its subdivision's value).",
    file: "rainfall_subdivision_monthly.csv",
    limitations: "36 meteorological subdivisions, not districts. Normal = 1951–2000 mean.",
  },
  {
    id: "D3_state_jjas",
    title: "IMD 0.25° gridded rainfall aggregated to states, 1981–2025",
    publisher: "IMD gridded data, area-weighted to states by Siddalingaiah (hssling/elnino-heat-india)",
    licence: "CC BY 4.0 (aggregates); IMD gridded-data terms",
    url: "https://github.com/hssling/elnino-heat-india",
    usedFor: "Recent monsoon (JJAS) departure by state, 2016–2025, and the rainfall component of the stress index.",
    file: "monsoon_series.csv",
    limitations: "State level only; Andaman & Nicobar and Lakshadweep excluded. Normal = 1981–2010 mean.",
  },
  {
    id: "D3_grid",
    title: "IMD 0.25° daily gridded rainfall (district level)",
    publisher: "India Meteorological Department, Pune",
    licence: "IMD gridded-data terms",
    url: "https://imdpune.gov.in/cmpg/Griddata/Rainfall_25_NetCDF.html",
    usedFor: "True district rainfall when the yearly files are downloaded (overrides subdivision values).",
    limitations: "Not yet downloaded for this build (see MANUAL_STEPS).",
  },
  {
    id: "D4_cgwb",
    title: "CGWB groundwater observation wells, 1996–2017",
    publisher: "Central Ground Water Board (data obtained from CGWB, mirrored by craigdsouza/cgwb)",
    licence: "Government of India data; attribute CGWB",
    url: "https://github.com/craigdsouza/cgwb",
    usedFor: "Pre- and post-monsoon depth to water and change against each well's 1996–2005 baseline.",
    file: "groundwater_district.csv",
    limitations: "Ends in January 2017. 24 states present; others have no wells in this file. Well network changes over time.",
  },
  {
    id: "D5_cdse",
    title: "Sentinel-2 L2A via Copernicus Data Space Ecosystem (Statistical API)",
    publisher: "European Space Agency / Copernicus",
    licence: "Copernicus open data licence",
    url: "https://dataspace.copernicus.eu/",
    usedFor: "Field-level NDVI and NDWI time series for the Advisor, cloud-masked with the scene classification layer.",
    limitations: "Needs CDSE OAuth credentials on the server. Cloudy observations are shown as gaps.",
  },
  {
    id: "D6_ndvi",
    title: "Sentinel-2 L2A via Microsoft Planetary Computer (district NDVI batch)",
    publisher: "ESA / Microsoft Planetary Computer; ESA WorldCover 2021 cropland mask",
    licence: "Copernicus open data licence; WorldCover CC BY 4.0",
    url: "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
    usedFor: "Monthly district NDVI over cropland (Atlas NDVI layer).",
    file: "ndvi_district_monthly.csv",
    limitations: "Batch job run off-platform; until then the NDVI layer shows an empty state.",
  },
  {
    id: "D7_openmeteo",
    title: "Open-Meteo forecast and historical weather",
    publisher: "Open-Meteo.com (ECMWF, DWD, NOAA models; ERA5 reanalysis)",
    licence: "CC BY 4.0 (non-commercial API use)",
    url: "https://open-meteo.com/",
    usedFor: "Daily reference evapotranspiration (FAO-56 ET₀), rainfall and soil moisture for the Advisor and live numbers.",
    limitations: "Model output at ~1–11 km resolution, not a rain gauge.",
  },
  {
    id: "D8_fao56",
    title: "FAO Irrigation and Drainage Paper 56 (Allen et al., 1998)",
    publisher: "FAO",
    licence: "© FAO; tables cited",
    url: "https://www.fao.org/4/x0490e/x0490e00.htm",
    usedFor: "Crop coefficients, stage lengths, root depths, depletion fractions and soil water holding.",
    limitations: "Generic values; local calibration would improve them.",
  },
  {
    id: "D10_boundaries",
    title: "Census 2011 districts and Survey of India boundaries",
    publisher: "DataMeet community maps",
    licence: "CC BY 2.5 India",
    url: "https://github.com/datameet/maps",
    usedFor: "Choropleth maps and the canonical district list.",
    limitations: "640 Census 2011 districts; newer districts are merged into their 2011 parent.",
  },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
