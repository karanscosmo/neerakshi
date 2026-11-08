export interface WeatherDay {
  date: string;
  et0Mm: number;
  rainMm: number;
  tempMaxC: number | null;
  tempMinC: number | null;
}

export interface WeatherResult {
  status: "ok" | "unavailable";
  reason?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  elevationM?: number;
  current?: {
    temperatureC: number | null;
    humidityPct: number | null;
    precipitationMm: number | null;
    windKmh: number | null;
    weatherCode: number | null;
  };
  daily?: WeatherDay[];
  source: string;
  fetchedAt: string;
}

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export async function fetchForecast(lat: number, lon: number): Promise<WeatherResult> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    daily: "et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min",
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
    timezone: "auto",
    forecast_days: "8",
  });

  try {
    const response = await fetch(`${OPEN_METEO}?${params.toString()}`, {
      headers: { "User-Agent": "Neerakshi/0.1 (research project)" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        reason: `Open-Meteo returned HTTP ${response.status}.`,
        source: "Open-Meteo",
        fetchedAt: new Date().toISOString(),
      };
    }
    const data = (await response.json()) as {
      latitude: number;
      longitude: number;
      timezone?: string;
      elevation?: number;
      current?: Record<string, number>;
      daily?: {
        time?: string[];
        et0_fao_evapotranspiration?: (number | null)[];
        precipitation_sum?: (number | null)[];
        temperature_2m_max?: (number | null)[];
        temperature_2m_min?: (number | null)[];
      };
    };

    const times = data.daily?.time ?? [];
    const et0 = data.daily?.et0_fao_evapotranspiration ?? [];
    const rain = data.daily?.precipitation_sum ?? [];
    if (times.length === 0 || et0.length === 0) {
      return {
        status: "unavailable",
        reason: "Open-Meteo did not return daily ET0 or rainfall.",
        source: "Open-Meteo",
        fetchedAt: new Date().toISOString(),
      };
    }

    const daily: WeatherDay[] = times.map((date, index) => ({
      date,
      et0Mm: Number(et0[index] ?? 0),
      rainMm: Number(rain[index] ?? 0),
      tempMaxC:
        data.daily?.temperature_2m_max?.[index] !== null &&
        data.daily?.temperature_2m_max?.[index] !== undefined
          ? Number(data.daily.temperature_2m_max[index])
          : null,
      tempMinC:
        data.daily?.temperature_2m_min?.[index] !== null &&
        data.daily?.temperature_2m_min?.[index] !== undefined
          ? Number(data.daily.temperature_2m_min[index])
          : null,
    }));

    const current = data.current;
    return {
      status: "ok",
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      elevationM: data.elevation,
      current: current
        ? {
            temperatureC: current.temperature_2m ?? null,
            humidityPct: current.relative_humidity_2m ?? null,
            precipitationMm: current.precipitation ?? null,
            windKmh: current.wind_speed_10m ?? null,
            weatherCode: current.weather_code ?? null,
          }
        : undefined,
      daily,
      source: "Open-Meteo (ECMWF/ICON blend) · FAO-56 ET₀",
      fetchedAt: new Date().toISOString(),
    };
  } catch (cause) {
    return {
      status: "unavailable",
      reason:
        cause instanceof Error
          ? `Weather request failed: ${cause.message}`
          : "Weather request failed.",
      source: "Open-Meteo",
      fetchedAt: new Date().toISOString(),
    };
  }
}
