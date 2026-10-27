/**
 * Deterministic, explainable advisory rules on top of the FAO-56 balance.
 *
 *  Condition (today, depletion Dr vs readily available water RAW)          Advice
 *  Dr ≥ RAW and ≥ 10 mm rain forecast within 48 h                          wait_rain (re-check in 2 days)
 *  Dr ≥ RAW otherwise                                                      irrigate_now (net = Dr, refill to field capacity)
 *  Dr < RAW, projected balance (with forecast rain) crosses RAW in 1–3 d   irrigate_in N days
 *  Dr < RAW otherwise                                                      no_need (next check = projected crossing ≤ 7 d, else +3 d)
 *  Missing weather / not sown / season over                                unavailable (with reason)
 *
 * The "≥ RAW, ≥ 10 mm on day 3 only" case is treated as irrigate_now: the crop is
 * already under stress and the rule only waits for rain arriving within 48 h.
 */
import {
  addDays,
  MEANINGFUL_RAIN_MM,
  runBalance,
  stageOf,
  type BalanceDay,
  type BalanceInput,
  type Stage,
} from "./waterBalance";

export type AdviceType = "irrigate_now" | "irrigate_in" | "wait_rain" | "no_need" | "unavailable";
export type UnavailableReason = "weather" | "not_sown" | "harvested" | "unknown";

export type Advisory = {
  type: AdviceType;
  date: string; // today
  reason?: UnavailableReason;
  inDays?: number;
  nextCheck?: string;
  netDepthMm?: number; // refill depth at field
  grossDepthMm?: number; // after application efficiency
  grossLitres?: number;
  efficiency: number;
  areaHa: number;
  today?: BalanceDay;
  rainNext48hMm?: number;
  rainNext3dMm?: number;
  stage?: Stage;
  dayOfSeason?: number;
  startAssumedFc: boolean;
  startDate: string;
  history: BalanceDay[];
  forecast: BalanceDay[];
};

export type AdvisoryInput = Omit<BalanceInput, "forecastFrom"> & {
  today: string;
  areaHa: number;
  efficiency: number;
  startAssumedFc: boolean;
};

export function computeAdvisory(inp: AdvisoryInput): Advisory {
  const base = {
    date: inp.today,
    efficiency: inp.efficiency,
    areaHa: inp.areaHa,
    startAssumedFc: inp.startAssumedFc,
    startDate: inp.startDate,
  };
  const dayToday = Math.round((Date.parse(inp.today) - Date.parse(inp.sowingDate)) / 86_400_000);
  const stage = stageOf(inp.crop, dayToday);
  if (stage === "before") return { ...base, type: "unavailable", reason: "not_sown", stage, dayOfSeason: dayToday, history: [], forecast: [] };
  if (stage === "after") return { ...base, type: "unavailable", reason: "harvested", stage, dayOfSeason: dayToday, history: [], forecast: [] };

  const res = runBalance({ ...inp, forecastFrom: addDays(inp.today, 1) });
  const history = res.days.filter((d) => d.date <= inp.today);
  const forecast = res.days.filter((d) => d.date > inp.today);
  const today = history.at(-1);
  if (!today || today.date !== inp.today) {
    return { ...base, type: "unavailable", reason: "weather", stage, dayOfSeason: dayToday, history, forecast };
  }
  const rainOn = (n: number) => {
    const w = inp.weather.find((x) => x.date === addDays(inp.today, n));
    return w?.precip ?? 0;
  };
  const forecastAvailable = inp.weather.some((x) => x.date === addDays(inp.today, 3) && x.precip !== null);
  if (!forecastAvailable) {
    return { ...base, type: "unavailable", reason: "weather", stage, dayOfSeason: dayToday, history, forecast, today };
  }
  const rain48 = round1(rainOn(1) + rainOn(2));
  const rain3 = round1(rainOn(1) + rainOn(2) + rainOn(3));
  const common = { ...base, today, history, forecast, rainNext48hMm: rain48, rainNext3dMm: rain3, stage, dayOfSeason: dayToday };

  const amounts = (net: number) => {
    const gross = net / inp.efficiency;
    return {
      netDepthMm: round1(net),
      grossDepthMm: round1(gross),
      // 1 mm over 1 m² = 1 litre; 1 ha = 10 000 m²
      grossLitres: Math.round((gross * inp.areaHa * 10_000) / 100) * 100,
    };
  };

  if (today.dr >= today.raw) {
    if (rain48 >= MEANINGFUL_RAIN_MM) {
      return { ...common, type: "wait_rain", nextCheck: addDays(inp.today, 2) };
    }
    return { ...common, type: "irrigate_now", ...amounts(today.dr), nextCheck: addDays(inp.today, 1) };
  }
  const crossing = forecast.find((d) => d.dr >= d.raw);
  if (crossing) {
    const n = Math.round((Date.parse(crossing.date) - Date.parse(inp.today)) / 86_400_000);
    if (n <= 3) {
      return { ...common, type: "irrigate_in", inDays: n, nextCheck: crossing.date, ...amounts(crossing.dr) };
    }
    return { ...common, type: "no_need", nextCheck: crossing.date };
  }
  return { ...common, type: "no_need", nextCheck: addDays(inp.today, 3) };
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}
