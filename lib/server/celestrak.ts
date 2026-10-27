import "server-only";
import { cached, UpstreamError } from "./cache";

const URL_S2A = "https://celestrak.org/NORAD/elements/gp.php?CATNR=40697&FORMAT=TLE";

/** Two-line element set for Sentinel-2A (NORAD 40697), cached 12 h. */
export async function getSentinelTle(): Promise<{ name: string; line1: string; line2: string; fetchedAt: string }> {
  const { value, fetchedAt } = await cached("celestrak:40697", "celestrak", 12 * 3600_000, async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(URL_S2A, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new UpstreamError("CelesTrak", res.status, await res.text());
      const lines = (await res.text()).trim().split(/\r?\n/).map((l) => l.trim());
      if (lines.length < 3 || !lines[1].startsWith("1 ") || !lines[2].startsWith("2 ")) throw new UpstreamError("CelesTrak", 200, "unexpected TLE format");
      return { name: lines[0], line1: lines[1], line2: lines[2] };
    } finally {
      clearTimeout(t);
    }
  });
  return { ...value, fetchedAt: fetchedAt.toISOString() };
}
