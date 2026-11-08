import "server-only";

import { getAtlasData, getMonthlyRainfall, getSeasonRainfall } from "@/lib/data/atlas";

export interface MonthlyCell {
  year: number;
  months: number[];
}

export interface ClimateExplorerData {
  years: number[];
  latestYear: number;
  states: string[];
  nationalSeries: { x: number; y: number }[];
  stateSeries: Record<string, { x: number; y: number }[]>;
  nationalMonths: MonthlyCell[];
  stateMonths: Record<string, MonthlyCell[]>;
  districtLatest: {
    id: string;
    name: string;
    state: string;
    departurePct: number;
    monsoonMm: number;
    normalMm: number;
  }[];
}

function emptyMonths(years: number[]): MonthlyCell[] {
  return years.map((year) => ({ year, months: Array.from({ length: 12 }, () => 0) }));
}

export async function getClimateExplorerData(): Promise<ClimateExplorerData> {
  const [atlas, monthly, season] = await Promise.all([
    getAtlasData(),
    getMonthlyRainfall(),
    getSeasonRainfall(),
  ]);

  const latestYear = atlas.metadata.latestYear;
  const years = Array.from(
    new Set(monthly.map((row) => row.year).filter((year) => year >= 2015 && year <= latestYear)),
  ).sort((a, b) => a - b);

  const nationalSums = emptyMonths(years);
  const nationalCounts = emptyMonths(years);
  const stateSums = new Map<string, MonthlyCell[]>();
  const stateCounts = new Map<string, MonthlyCell[]>();

  for (const row of monthly) {
    const yearIndex = years.indexOf(row.year);
    if (yearIndex < 0 || row.month < 1 || row.month > 12) continue;
    const monthIndex = row.month - 1;
    const value = Number(row.rainfall_mm);
    if (!Number.isFinite(value)) continue;

    nationalSums[yearIndex].months[monthIndex] += value;
    nationalCounts[yearIndex].months[monthIndex] += 1;

    if (!stateSums.has(row.state)) {
      stateSums.set(row.state, emptyMonths(years));
      stateCounts.set(row.state, emptyMonths(years));
    }
    stateSums.get(row.state)![yearIndex].months[monthIndex] += value;
    stateCounts.get(row.state)![yearIndex].months[monthIndex] += 1;
  }

  const nationalMonths = nationalSums.map((cell, yearIndex) => ({
    year: cell.year,
    months: cell.months.map((sum, monthIndex) =>
      nationalCounts[yearIndex].months[monthIndex] > 0
        ? sum / nationalCounts[yearIndex].months[monthIndex]
        : 0,
    ),
  }));

  const stateMonths: Record<string, MonthlyCell[]> = {};
  for (const [state, cells] of stateSums) {
    const counts = stateCounts.get(state)!;
    stateMonths[state] = cells.map((cell, yearIndex) => ({
      year: cell.year,
      months: cell.months.map((sum, monthIndex) =>
        counts[yearIndex].months[monthIndex] > 0
          ? sum / counts[yearIndex].months[monthIndex]
          : 0,
      ),
    }));
  }

  const stateDistrictCount = new Map(atlas.states.map((state) => [state.state, state.districts]));
  const stateSeries: Record<string, { x: number; y: number }[]> = {};
  for (const [state, series] of Object.entries(atlas.national.stateSeries)) {
    const count = stateDistrictCount.get(state) ?? 1;
    stateSeries[state] = Object.entries(series)
      .map(([year, total]) => ({ x: Number(year), y: total / count }))
      .sort((a, b) => a.x - b.x);
  }

  const nationalSeries = Object.entries(atlas.national.monsoonSeries)
    .map(([year, total]) => ({
      x: Number(year),
      y: total / Math.max(1, atlas.national.districtsWithRainfall),
    }))
    .sort((a, b) => a.x - b.x);

  const districtLatest = season
    .filter((row) => row.year === latestYear)
    .map((row) => ({
      id: row.district_id,
      name: row.district_name,
      state: row.state,
      departurePct: Number(row.departure_pct),
      monsoonMm: Number(row.monsoon_mm),
      normalMm: Number(row.monsoon_normal_mm),
    }))
    .filter((row) => Number.isFinite(row.departurePct));

  return {
    years,
    latestYear,
    states: Object.keys(stateMonths).sort(),
    nationalSeries,
    stateSeries,
    nationalMonths,
    stateMonths,
    districtLatest,
  };
}
