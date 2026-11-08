import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export type Provenance = "observed" | "reanalysis" | "demo_fixture" | "model" | "live";

export function provenanceLabel(provenance: Provenance | string): string {
  switch (provenance) {
    case "observed":
      return "Observed";
    case "reanalysis":
      return "Reanalysis";
    case "demo_fixture":
      return "Demo fixture";
    case "model":
      return "Model";
    case "live":
      return "Live";
    default:
      return provenance;
  }
}

export const STRESS_COLORS: Record<string, string> = {
  Low: "#8CE5B1",
  Moderate: "#F2B85B",
  High: "#FF9F6B",
  Severe: "#FF6B65",
  Unavailable: "#8CA8B5",
};

export function stressColor(value: number | null | undefined): string {
  if (value === null || value === undefined) return STRESS_COLORS.Unavailable;
  if (value < 30) return STRESS_COLORS.Low;
  if (value < 55) return STRESS_COLORS.Moderate;
  if (value < 75) return STRESS_COLORS.High;
  return STRESS_COLORS.Severe;
}

export function decisionTone(decision: string): string {
  switch (decision) {
    case "IRRIGATE_NOW":
      return "text-coral";
    case "IRRIGATE_IN_DAYS":
      return "text-amber";
    case "WAIT_FOR_RAIN":
      return "text-glacier";
    case "NO_IRRIGATION":
      return "text-mint";
    default:
      return "text-muted";
  }
}

export function formatDate(value: string | null | undefined, locale = "en-IN"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
