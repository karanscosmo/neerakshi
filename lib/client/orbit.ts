import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec } from "satellite.js";

export type Tle = { name: string; line1: string; line2: string };

/** Current sub-satellite point (degrees) and height (km). */
export function subPoint(tle: Tle, date = new Date()): { lat: number; lon: number; heightKm: number } | null {
  const rec = twoline2satrec(tle.line1, tle.line2);
  const pv = propagate(rec, date);
  if (!pv || typeof pv.position !== "object" || !pv.position) return null;
  const g = eciToGeodetic(pv.position, gstime(date));
  return { lat: degreesLat(g.latitude), lon: degreesLong(g.longitude), heightKm: g.height };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Next daytime pass of the satellite's ground track within half the
 * Sentinel-2 swath (290 km / 2) of a point. Daytime = local solar time 09–12 h
 * (Sentinel-2 descends at ≈ 10:30). Searches up to `days` ahead in 20 s steps.
 */
export function nextImagingPass(tle: Tle, lat: number, lon: number, from = new Date(), days = 6): Date | null {
  const rec = twoline2satrec(tle.line1, tle.line2);
  const end = from.getTime() + days * 86_400_000;
  let best: { t: number; d: number } | null = null;
  for (let t = from.getTime(); t < end; t += 20_000) {
    const date = new Date(t);
    const pv = propagate(rec, date);
    if (!pv || typeof pv.position !== "object" || !pv.position) continue;
    const g = eciToGeodetic(pv.position, gstime(date));
    const sLat = degreesLat(g.latitude);
    if (Math.abs(sLat - lat) > 3) {
      if (best) return new Date(best.t);
      continue;
    }
    const sLon = degreesLong(g.longitude);
    const d = haversineKm(sLat, sLon, lat, lon);
    const solarHour = (((date.getUTCHours() + date.getUTCMinutes() / 60 + lon / 15) % 24) + 24) % 24;
    if (d <= 145 && solarHour >= 9 && solarHour <= 12) {
      if (!best || d < best.d) best = { t, d };
    } else if (best) {
      return new Date(best.t);
    }
  }
  return best ? new Date(best.t) : null;
}

export function nearestDistrict<T extends { lat: number; lon: number }>(list: T[], lat: number, lon: number, maxKm = 80): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const d of list) {
    const k = haversineKm(lat, lon, d.lat, d.lon);
    if (k < bd) {
      bd = k;
      best = d;
    }
  }
  return bd <= maxKm ? best : null;
}

export function formatLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}
