import { z } from "zod";
import { cached, fetchJson } from "@/lib/server/cache";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

const Res = z.object({
  results: z
    .array(z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), admin1: z.string().optional(), admin2: z.string().optional(), admin3: z.string().optional(), country_code: z.string().optional() }))
    .optional(),
});

/** Village/town search (Open-Meteo geocoding, GeoNames-based), India only. */
export async function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 3 || q.length > 60) return error(400, "Query must be 3–60 characters");
    const lang = new URL(req.url).searchParams.get("lang") ?? "en";
    const { value } = await cached(`geo:${lang}:${q.toLowerCase()}`, "open-meteo-geocoding", 30 * 86_400_000, async () =>
      Res.parse(
        await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=${encodeURIComponent(lang)}&countryCode=IN&format=json`, {
          provider: "Open-Meteo geocoding",
        }),
      ),
    );
    const results = (value.results ?? []).filter((r) => !r.country_code || r.country_code === "IN").map((r) => ({ name: r.name, lat: r.latitude, lon: r.longitude, admin: [r.admin3, r.admin2, r.admin1].filter(Boolean).join(", ") }));
    return json({ results }, { cacheSeconds: 86400 });
  });
}
