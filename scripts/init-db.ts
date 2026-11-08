import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath =
  process.env.NEERAKSHI_DB_PATH ?? path.join(process.cwd(), "data", "app", "neerakshi.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    geometry TEXT,
    centroid_lat REAL NOT NULL,
    centroid_lon REAL NOT NULL,
    area_ha REAL NOT NULL,
    crop TEXT NOT NULL,
    soil TEXT NOT NULL,
    irrigation_method TEXT NOT NULL DEFAULT 'flood',
    sowing_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS advisories (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    assessment_date TEXT NOT NULL,
    decision TEXT NOT NULL,
    payload TEXT NOT NULL,
    result TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS advisories_field_idx ON advisories(field_id, created_at);
  CREATE TABLE IF NOT EXISTS irrigation_events (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL,
    applied_on TEXT NOT NULL,
    depth_mm REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS irrigation_field_idx ON irrigation_events(field_id, applied_on);
`);
sqlite.close();
console.log(`Neerakshi database ready at ${dbPath}`);
