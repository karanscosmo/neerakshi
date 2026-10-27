import "server-only";
import { createDb, type DB } from "./dbcore";

export type { DB };

let dbPromise: Promise<DB> | null = null;

/** Shared app database handle (lazy, one per server instance). */
export function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = createDb().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
