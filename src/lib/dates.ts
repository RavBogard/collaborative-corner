import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "./types";

export const localDate = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd");
export const localTime = (d: Date) => formatInTimeZone(d, TZ, "HH:mm");

/** Add n days to a YYYY-MM-DD string (calendar math, no timezone). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Every YYYY-MM-DD from start through end inclusive (capped for safety). */
export function eachDay(start: string, end: string, cap = 120): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < cap; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
