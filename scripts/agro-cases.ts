/** Runs every shared water-balance fixture through the TypeScript implementation and prints JSON (used by tests/test_agro.py). */
import fs from "node:fs";
import path from "node:path";
import { runBalance, addDays } from "@/lib/agro/waterBalance";
import { computeAdvisory } from "@/lib/agro/advisory";

const cases = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/water_balance_cases.json"), "utf8"));
const out = cases.map((c: any) => {
  const bal = runBalance({ crop: c.crop, soil: c.soil, sowingDate: c.sowingDate, startDate: c.startDate, weather: c.weather, irrigations: c.irrigations, forecastFrom: addDays(c.today, 1) });
  const adv = computeAdvisory({ crop: c.crop, soil: c.soil, sowingDate: c.sowingDate, startDate: c.startDate, weather: c.weather, irrigations: c.irrigations, today: c.today, areaHa: c.areaHa, efficiency: c.efficiency, startAssumedFc: true });
  return { name: c.name, days: bal.days, missing: bal.missing, advisory: { type: adv.type, reason: adv.reason ?? null, inDays: adv.inDays ?? null, nextCheck: adv.nextCheck ?? null, netDepthMm: adv.netDepthMm ?? null, grossDepthMm: adv.grossDepthMm ?? null, grossLitres: adv.grossLitres ?? null } };
});
process.stdout.write(JSON.stringify(out));
