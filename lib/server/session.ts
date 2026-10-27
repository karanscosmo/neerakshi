import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Anonymous farmer identity: a random id in a signed, httpOnly cookie.
 * No sign-up, no phone number, no name. Losing the cookie only loses the
 * link to saved fields (the farmer can re-create them).
 */
const COOKIE = "nk_sid";
const ADMIN_COOKIE = "nk_admin";
const ONE_YEAR = 60 * 60 * 24 * 365;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set (32+ characters) in production");
  }
  return "dev-only-insecure-session-secret-change-me-0123456789";
}

export function sign(value: string): string {
  const mac = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verify(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value).slice(i + 1));
  const given = Buffer.from(signed.slice(i + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return value;
}

export function newId(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

/** Read the anonymous owner id, creating the cookie if needed (Route Handlers / Server Actions only). */
export async function getOrCreateOwnerId(): Promise<string> {
  const jar = await cookies();
  const existing = verify(jar.get(COOKIE)?.value);
  if (existing) return existing;
  const id = newId(16);
  jar.set(COOKIE, sign(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return id;
}

export async function getOwnerId(): Promise<string | null> {
  const jar = await cookies();
  return verify(jar.get(COOKIE)?.value);
}

/* ─── Officer (admin) session ─────────────────────────────────────────── */

export function passcodeMatches(given: string): boolean {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return false;
  const a = Buffer.from(createHmac("sha256", "cmp").update(given).digest());
  const b = Buffer.from(createHmac("sha256", "cmp").update(expected).digest());
  return timingSafeEqual(a, b);
}

export async function setAdminSession(): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + 1000 * 60 * 60 * 8; // 8 hours
  jar.set(ADMIN_COOKIE, sign(`admin:${exp}`), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const v = verify(jar.get(ADMIN_COOKIE)?.value);
  if (!v?.startsWith("admin:")) return false;
  return Number(v.slice(6)) > Date.now();
}

/** Constant-time compare for bearer secrets (cron, telegram webhook). */
export function secretEquals(given: string | null | undefined, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
