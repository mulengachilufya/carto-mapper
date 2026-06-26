import { format } from "d3-format";

/** Format a metric value using an optional d3-format string (default thousands). */
export function formatNumber(value: number, fmt?: string): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return format(fmt || ",")(value);
  } catch {
    return String(value);
  }
}

/** Compact, human distance label component. */
export function formatKm(km: number): string {
  try {
    return km >= 100 ? format(",")(Math.round(km)) : format("~r")(km);
  } catch {
    return String(km);
  }
}
