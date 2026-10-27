/** Small astronomy helpers for the journey sky (accuracy: a fraction of a degree — enough to draw a real sky). */
const D2R = Math.PI / 180;

export function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Local sidereal time in degrees. */
export function localSiderealDeg(date: Date, lonDeg: number): number {
  const d = julianDay(date) - 2451545.0;
  const gmst = 280.46061837 + 360.98564736629 * d;
  return (((gmst + lonDeg) % 360) + 360) % 360;
}

/** Equatorial (RA/Dec, degrees) → horizontal (altitude/azimuth, degrees; azimuth from north through east). */
export function altAz(raDeg: number, decDeg: number, latDeg: number, lstDeg: number): { alt: number; az: number } {
  const H = (lstDeg - raDeg) * D2R;
  const dec = decDeg * D2R;
  const lat = latDeg * D2R;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const az = Math.atan2(-Math.sin(H) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(H));
  return { alt: alt / D2R, az: (((az / D2R) % 360) + 360) % 360 };
}

/** Moon phase in [0, 1): 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. Mean synodic month from the 2000-01-06 18:14 UTC new moon. */
export function moonPhase(date: Date): number {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;
  const days = date.getTime() / 86_400_000 - ref;
  return (((days % synodic) + synodic) % synodic) / synodic;
}

/** Star colour from B−V index (approximate blackbody tint). */
export function bvToRgb(bv: number): string {
  const t = Math.max(-0.4, Math.min(2, bv));
  if (t < 0) return "200,214,255";
  if (t < 0.4) return "235,238,255";
  if (t < 0.8) return "255,244,226";
  if (t < 1.4) return "255,222,180";
  return "255,198,150";
}
