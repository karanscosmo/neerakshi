import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function json<T>(data: T, init?: ResponseInit & { cacheSeconds?: number }) {
  const headers = new Headers(init?.headers);
  if (init?.cacheSeconds) headers.set("Cache-Control", `public, s-maxage=${init.cacheSeconds}, stale-while-revalidate=${init.cacheSeconds * 6}`);
  else if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export function error(status: number, message: string, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, { status });
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof ZodError) return error(400, "Invalid input", { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    console.error(e);
    return error(500, e instanceof Error ? e.message : "Server error");
  });
}
