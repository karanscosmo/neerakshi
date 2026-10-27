import {
  pgTable,
  text,
  integer,
  real,
  doublePrecision,
  timestamp,
  date,
  jsonb,
  boolean,
  serial,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ─── Reference ─────────────────────────────────────────────────────────── */

/** Canonical districts (Census 2011 boundaries, see data/reference/district_crosswalk.csv). */
export const districts = pgTable("districts", {
  id: text("id").primaryKey(), // e.g. "KA-572"  (state code + census 2011 district code)
  name: text("name").notNull(),
  stateCode: text("state_code").notNull(),
  stateName: text("state_name").notNull(),
  censusCode: integer("census_code"),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  areaKm2: real("area_km2"),
  imdSubdivision: text("imd_subdivision"),
});

/** Freshness/provenance of each prepared dataset, written by the loader. */
export const dataSources = pgTable("data_sources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  publisher: text("publisher").notNull(),
  licence: text("licence").notNull(),
  url: text("url"),
  coverage: text("coverage"),
  rows: integer("rows").notNull().default(0),
  status: text("status").notNull(), // "loaded" | "missing" | "partial"
  note: text("note"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
});

/* ─── Atlas (prepared, pre-aggregated) ──────────────────────────────────── */

export const cropProduction = pgTable(
  "crop_production",
  {
    year: integer("year").notNull(),
    districtId: text("district_id").notNull(),
    season: text("season").notNull(),
    crop: text("crop").notNull(),
    areaHa: doublePrecision("area_ha"),
    productionT: doublePrecision("production_t"),
    yieldTPerHa: doublePrecision("yield_t_per_ha"),
  },
  (t) => [
    primaryKey({ columns: [t.year, t.districtId, t.season, t.crop] }),
    index("crop_prod_crop_year").on(t.crop, t.year),
    index("crop_prod_district").on(t.districtId),
  ],
);

export const irrigationDistrict = pgTable(
  "irrigation_district",
  {
    year: integer("year").notNull(),
    districtId: text("district_id").notNull(),
    crop: text("crop").notNull(),
    irrigatedAreaHa: doublePrecision("irrigated_area_ha"),
    grossCroppedAreaHa: doublePrecision("gross_cropped_area_ha"),
    irrigatedSharePct: doublePrecision("irrigated_share_pct"),
  },
  (t) => [primaryKey({ columns: [t.year, t.districtId, t.crop] })],
);

export const rainfallDistrictSeason = pgTable(
  "rainfall_district_season",
  {
    year: integer("year").notNull(),
    districtId: text("district_id").notNull(),
    season: text("season").notNull(), // jjas | ond | annual
    rainMm: doublePrecision("rain_mm"),
    normalRainMm: doublePrecision("normal_rain_mm"),
    departurePct: doublePrecision("departure_pct"),
    spatialBasis: text("spatial_basis").notNull(), // imd_grid_district | imd_subdivision | imd_grid_state
    normalPeriod: text("normal_period"),
  },
  (t) => [primaryKey({ columns: [t.year, t.districtId, t.season] }), index("rain_season_district").on(t.districtId)],
);

/** IMD sub-divisional monthly rainfall (1901–2015). Districts link via districts.imd_subdivision. */
export const rainfallSubdivisionMonthly = pgTable(
  "rainfall_subdivision_monthly",
  {
    subdivision: text("subdivision").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    rainMm: doublePrecision("rain_mm"),
    normalRainMm: doublePrecision("normal_rain_mm"),
    departurePct: doublePrecision("departure_pct"),
  },
  (t) => [primaryKey({ columns: [t.subdivision, t.year, t.month] })],
);

/** Long-run monsoon series by region (all-India, IMD subdivision, state unit). */
export const monsoonSeries = pgTable(
  "monsoon_series",
  {
    regionType: text("region_type").notNull(), // india | subdivision | state
    regionId: text("region_id").notNull(),
    regionName: text("region_name").notNull(),
    year: integer("year").notNull(),
    jjasMm: doublePrecision("jjas_mm"),
    normalMm: doublePrecision("normal_mm"),
    departurePct: doublePrecision("departure_pct"),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.regionType, t.regionId, t.year] })],
);

export const groundwaterDistrict = pgTable(
  "groundwater_district",
  {
    year: integer("year").notNull(),
    season: text("season").notNull(), // pre_monsoon | post_monsoon
    districtId: text("district_id").notNull(),
    medianDepthMbgl: doublePrecision("median_depth_mbgl"),
    wellCount: integer("well_count").notNull(),
    changeVsBaselineM: doublePrecision("change_vs_baseline_m"),
  },
  (t) => [primaryKey({ columns: [t.year, t.season, t.districtId] }), index("gw_district").on(t.districtId)],
);

export const waterStressIndex = pgTable("water_stress_index", {
  districtId: text("district_id").primaryKey(),
  rainPeriod: text("rain_period"),
  rainBasis: text("rain_basis"),
  rainDeparture5yPct: doublePrecision("rain_departure_5y_pct"),
  rainScore: doublePrecision("rain_score"),
  gwYear: integer("gw_year"),
  gwDepthMbgl: doublePrecision("gw_depth_mbgl"),
  gwScore: doublePrecision("gw_score"),
  irrigationYear: integer("irrigation_year"),
  irrigatedSharePct: doublePrecision("irrigated_share_pct"),
  irrigationScore: doublePrecision("irrigation_score"),
  componentsUsed: integer("components_used").notNull(),
  stressIndex0100: doublePrecision("stress_index_0_100"),
  rankNational: integer("rank_national"),
  rankState: integer("rank_state"),
});

export const ndviDistrictMonthly = pgTable(
  "ndvi_district_monthly",
  {
    month: date("month").notNull(), // first of month
    districtId: text("district_id").notNull(),
    ndviMedian: doublePrecision("ndvi_median"),
    validPixelPct: doublePrecision("valid_pixel_pct"),
  },
  (t) => [primaryKey({ columns: [t.month, t.districtId] })],
);

/* ─── Advisor (operational) ─────────────────────────────────────────────── */

export const fields = pgTable(
  "fields",
  {
    id: text("id").primaryKey(), // random, url-safe
    ownerId: text("owner_id").notNull(), // anonymous session id (signed cookie)
    name: text("name"),
    geometry: jsonb("geometry").notNull(), // GeoJSON Polygon
    areaHa: doublePrecision("area_ha").notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    districtId: text("district_id"),
    crop: text("crop").notNull(),
    sowingDate: date("sowing_date").notNull(),
    soil: text("soil").notNull(),
    method: text("method").notNull(),
    lastIrrigationDate: date("last_irrigation_date"),
    language: text("language").notNull().default("en"),
    subscribed: boolean("subscribed").notNull().default(false),
    lastAlertKey: text("last_alert_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fields_owner").on(t.ownerId)],
);

/** Farmer-recorded irrigation events ("I irrigated today"). */
export const irrigationEvents = pgTable(
  "irrigation_events",
  {
    id: serial("id").primaryKey(),
    fieldId: text("field_id").notNull(),
    date: date("date").notNull(),
    depthMm: doublePrecision("depth_mm"), // null => assume refill to field capacity
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("irr_events_field").on(t.fieldId)],
);

export const advisories = pgTable(
  "advisories",
  {
    id: serial("id").primaryKey(),
    fieldId: text("field_id").notNull(),
    date: date("date").notNull(),
    districtId: text("district_id"),
    crop: text("crop").notNull(),
    adviceType: text("advice_type").notNull(), // irrigate_now | irrigate_in | wait_rain | no_need | unavailable
    etcMm: doublePrecision("etc_mm"),
    rainForecastMm: doublePrecision("rain_forecast_mm"),
    deficitMm: doublePrecision("deficit_mm"),
    rawMm: doublePrecision("raw_mm"),
    tawMm: doublePrecision("taw_mm"),
    netDepthMm: doublePrecision("net_depth_mm"),
    grossLitres: doublePrecision("gross_litres"),
    payload: jsonb("payload").notNull(),
    trigger: text("trigger").notNull().default("user"), // user | cron | telegram
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("advisories_field_date").on(t.fieldId, t.date), index("advisories_date").on(t.date)],
);

/** Server-side cache for external API responses (Open-Meteo, CDSE, CelesTrak). */
export const apiCache = pgTable(
  "api_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    body: jsonb("body").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("api_cache_provider").on(t.provider)],
);

export const telegramLinks = pgTable(
  "telegram_links",
  {
    id: serial("id").primaryKey(),
    fieldId: text("field_id").notNull(),
    chatId: text("chat_id"),
    linkCode: text("link_code").notNull(),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }).notNull(),
    language: text("language").notNull().default("en"),
    active: boolean("active").notNull().default(false),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("telegram_link_code").on(t.linkCode), index("telegram_chat").on(t.chatId)],
);

export const alertLog = pgTable(
  "alert_log",
  {
    id: serial("id").primaryKey(),
    fieldId: text("field_id").notNull(),
    channel: text("channel").notNull(), // telegram
    adviceType: text("advice_type").notNull(),
    status: text("status").notNull(), // sent | failed | skipped_unchanged | skipped_no_channel
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("alert_log_created").on(t.createdAt)],
);

export type Field = typeof fields.$inferSelect;
export type NewField = typeof fields.$inferInsert;
export type Advisory = typeof advisories.$inferSelect;
