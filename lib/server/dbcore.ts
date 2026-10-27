import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

export type DB = NeonHttpDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "db", "migrations");

/**
 * Neon serverless Postgres over HTTP when DATABASE_URL is set; otherwise an
 * embedded PGlite database in ~/.cache/neerakshi/pglite for local development (never on Vercel).
 */
export async function createDb(opts: { migrate?: boolean } = {}): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzleNeon(neon(url), { schema });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/neon-http/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS });
    }
    return db;
  }
  if (process.env.VERCEL === "1") {
    throw new Error("DATABASE_URL is not set. Add a Neon database from the Vercel Marketplace.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // Outside the project tree: the dev server watches the project, and PGlite's
  // writes would otherwise trigger endless recompiles and page reloads.
  const os = await import("node:os");
  const dir = process.env.PGLITE_DIR ?? path.join(os.homedir(), ".cache", "neerakshi", "pglite");
  (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}
