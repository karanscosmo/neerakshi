import "server-only";
import { eq, lt } from "drizzle-orm";
import { getDb } from "./db";
import { apiCache } from "@/db/schema";

/**
 * Read-through cache for external API responses, stored in Postgres so it
 * survives serverless cold starts and respects provider rate limits.
 * Returns { value, cached, fetchedAt }. Failures are never cached.
 */
export async function cached<T>(
  key: string,
  provider: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<{ value: T; cached: boolean; fetchedAt: Date }> {
  const db = await getDb();
  const hit = await db.select().from(apiCache).where(eq(apiCache.key, key)).limit(1);
  const now = new Date();
  if (hit[0] && hit[0].expiresAt > now) {
    return { value: hit[0].body as T, cached: true, fetchedAt: hit[0].fetchedAt };
  }
  const value = await fetcher();
  const expiresAt = new Date(now.getTime() + ttlMs);
  await db
    .insert(apiCache)
    .values({ key, provider, body: value as object, fetchedAt: now, expiresAt })
    .onConflictDoUpdate({ target: apiCache.key, set: { body: value as object, fetchedAt: now, expiresAt } });
  return { value, cached: false, fetchedAt: now };
}

export async function purgeExpired(): Promise<void> {
  const db = await getDb();
  await db.delete(apiCache).where(lt(apiCache.expiresAt, new Date(Date.now() - 7 * 86_400_000)));
}

/** fetch with timeout and a clear error message (status + provider). */
export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number; provider: string }): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new UpstreamError(init.provider, res.status, body.slice(0, 300));
    }
    return await res.json();
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError(init.provider, 0, e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(t);
  }
}

export class UpstreamError extends Error {
  constructor(
    public provider: string,
    public status: number,
    public detail: string,
  ) {
    super(`${provider} request failed${status ? ` (HTTP ${status})` : ""}: ${detail}`);
  }
}
