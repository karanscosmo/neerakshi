CREATE TABLE "advisories" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"date" date NOT NULL,
	"district_id" text,
	"crop" text NOT NULL,
	"advice_type" text NOT NULL,
	"etc_mm" double precision,
	"rain_forecast_mm" double precision,
	"deficit_mm" double precision,
	"raw_mm" double precision,
	"taw_mm" double precision,
	"net_depth_mm" double precision,
	"gross_litres" double precision,
	"payload" jsonb NOT NULL,
	"trigger" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"channel" text NOT NULL,
	"advice_type" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"body" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_production" (
	"year" integer NOT NULL,
	"district_id" text NOT NULL,
	"season" text NOT NULL,
	"crop" text NOT NULL,
	"area_ha" double precision,
	"production_t" double precision,
	"yield_t_per_ha" double precision,
	CONSTRAINT "crop_production_year_district_id_season_crop_pk" PRIMARY KEY("year","district_id","season","crop")
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"licence" text NOT NULL,
	"url" text,
	"coverage" text,
	"rows" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"refreshed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state_code" text NOT NULL,
	"state_name" text NOT NULL,
	"census_code" integer,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"area_km2" real,
	"imd_subdivision" text
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text,
	"geometry" jsonb NOT NULL,
	"area_ha" double precision NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"district_id" text,
	"crop" text NOT NULL,
	"sowing_date" date NOT NULL,
	"soil" text NOT NULL,
	"method" text NOT NULL,
	"last_irrigation_date" date,
	"language" text DEFAULT 'en' NOT NULL,
	"subscribed" boolean DEFAULT false NOT NULL,
	"last_alert_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groundwater_district" (
	"year" integer NOT NULL,
	"season" text NOT NULL,
	"district_id" text NOT NULL,
	"median_depth_mbgl" double precision,
	"well_count" integer NOT NULL,
	"change_vs_baseline_m" double precision,
	CONSTRAINT "groundwater_district_year_season_district_id_pk" PRIMARY KEY("year","season","district_id")
);
--> statement-breakpoint
CREATE TABLE "irrigation_district" (
	"year" integer NOT NULL,
	"district_id" text NOT NULL,
	"crop" text NOT NULL,
	"irrigated_area_ha" double precision,
	"gross_cropped_area_ha" double precision,
	"irrigated_share_pct" double precision,
	CONSTRAINT "irrigation_district_year_district_id_crop_pk" PRIMARY KEY("year","district_id","crop")
);
--> statement-breakpoint
CREATE TABLE "irrigation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"date" date NOT NULL,
	"depth_mm" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monsoon_series" (
	"region_type" text NOT NULL,
	"region_id" text NOT NULL,
	"region_name" text NOT NULL,
	"year" integer NOT NULL,
	"jjas_mm" double precision,
	"normal_mm" double precision,
	"departure_pct" double precision,
	"source" text NOT NULL,
	CONSTRAINT "monsoon_series_region_type_region_id_year_pk" PRIMARY KEY("region_type","region_id","year")
);
--> statement-breakpoint
CREATE TABLE "ndvi_district_monthly" (
	"month" date NOT NULL,
	"district_id" text NOT NULL,
	"ndvi_median" double precision,
	"valid_pixel_pct" double precision,
	CONSTRAINT "ndvi_district_monthly_month_district_id_pk" PRIMARY KEY("month","district_id")
);
--> statement-breakpoint
CREATE TABLE "rainfall_district_season" (
	"year" integer NOT NULL,
	"district_id" text NOT NULL,
	"season" text NOT NULL,
	"rain_mm" double precision,
	"normal_rain_mm" double precision,
	"departure_pct" double precision,
	"spatial_basis" text NOT NULL,
	"normal_period" text,
	CONSTRAINT "rainfall_district_season_year_district_id_season_pk" PRIMARY KEY("year","district_id","season")
);
--> statement-breakpoint
CREATE TABLE "rainfall_subdivision_monthly" (
	"subdivision" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"rain_mm" double precision,
	"normal_rain_mm" double precision,
	"departure_pct" double precision,
	CONSTRAINT "rainfall_subdivision_monthly_subdivision_year_month_pk" PRIMARY KEY("subdivision","year","month")
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"chat_id" text,
	"link_code" text NOT NULL,
	"code_expires_at" timestamp with time zone NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"linked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "water_stress_index" (
	"district_id" text PRIMARY KEY NOT NULL,
	"rain_period" text,
	"rain_basis" text,
	"rain_departure_5y_pct" double precision,
	"rain_score" double precision,
	"gw_year" integer,
	"gw_depth_mbgl" double precision,
	"gw_score" double precision,
	"irrigation_year" integer,
	"irrigated_share_pct" double precision,
	"irrigation_score" double precision,
	"components_used" integer NOT NULL,
	"stress_index_0_100" double precision,
	"rank_national" integer,
	"rank_state" integer
);
--> statement-breakpoint
CREATE INDEX "advisories_field_date" ON "advisories" USING btree ("field_id","date");--> statement-breakpoint
CREATE INDEX "advisories_date" ON "advisories" USING btree ("date");--> statement-breakpoint
CREATE INDEX "alert_log_created" ON "alert_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_cache_provider" ON "api_cache" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "crop_prod_crop_year" ON "crop_production" USING btree ("crop","year");--> statement-breakpoint
CREATE INDEX "crop_prod_district" ON "crop_production" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "fields_owner" ON "fields" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "gw_district" ON "groundwater_district" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "irr_events_field" ON "irrigation_events" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "rain_season_district" ON "rainfall_district_season" USING btree ("district_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_link_code" ON "telegram_links" USING btree ("link_code");--> statement-breakpoint
CREATE INDEX "telegram_chat" ON "telegram_links" USING btree ("chat_id");