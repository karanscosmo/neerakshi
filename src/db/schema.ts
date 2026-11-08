import { index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const fields = sqliteTable("fields", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  geometry: text("geometry"),
  centroidLat: real("centroid_lat").notNull(),
  centroidLon: real("centroid_lon").notNull(),
  areaHa: real("area_ha").notNull(),
  crop: text("crop").notNull(),
  soil: text("soil").notNull(),
  irrigationMethod: text("irrigation_method").notNull().default("flood"),
  sowingDate: text("sowing_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const advisories = sqliteTable(
  "advisories",
  {
    id: text("id").primaryKey(),
    fieldId: text("field_id").notNull(),
    createdAt: text("created_at").notNull(),
    assessmentDate: text("assessment_date").notNull(),
    decision: text("decision").notNull(),
    payload: text("payload").notNull(),
    result: text("result").notNull(),
  },
  (table) => [index("advisories_field_idx").on(table.fieldId, table.createdAt)],
);

export const irrigationEvents = sqliteTable(
  "irrigation_events",
  {
    id: text("id").primaryKey(),
    fieldId: text("field_id").notNull(),
    appliedOn: text("applied_on").notNull(),
    depthMm: real("depth_mm").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("irrigation_field_idx").on(table.fieldId, table.appliedOn)],
);

export type FieldRow = typeof fields.$inferSelect;
export type AdvisoryRow = typeof advisories.$inferSelect;
export type IrrigationRow = typeof irrigationEvents.$inferSelect;
export type NewField = typeof fields.$inferInsert;
