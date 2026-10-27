/** Writes data/prepared/advisories.csv (anonymised) from the database: npm run export:advisories */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createDb } from "@/lib/server/dbcore";
import * as s from "@/db/schema";
import { toCsv } from "@/lib/shared/csv";

(async () => {
  const db = await createDb({ migrate: true });
  const rows = await db
    .select({
      date: s.advisories.date,
      district_id: s.advisories.districtId,
      district: s.districts.name,
      crop: s.advisories.crop,
      advice_type: s.advisories.adviceType,
      etc_mm: s.advisories.etcMm,
      rain_forecast_mm: s.advisories.rainForecastMm,
      deficit_mm: s.advisories.deficitMm,
      raw_mm: s.advisories.rawMm,
      net_depth_mm: s.advisories.netDepthMm,
    })
    .from(s.advisories)
    .leftJoin(s.districts, eq(s.districts.id, s.advisories.districtId))
    .orderBy(s.advisories.date);
  const out = path.join(process.cwd(), "data", "prepared", "advisories.csv");
  fs.writeFileSync(out, toCsv(rows, ["date", "district_id", "district", "crop", "advice_type", "etc_mm", "rain_forecast_mm", "deficit_mm", "raw_mm", "net_depth_mm"]));
  console.log(`wrote ${rows.length} rows → ${out}`);
  process.exit(0);
})();
