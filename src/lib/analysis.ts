import { eachDay } from "./dates";
import type { CalEvent } from "./types";

/** How much an event "occupies" a day for conflict-heat purposes. */
export function weight(e: CalEvent, category: string): number {
  if (category === "holiday") return e.importance === "major" ? 2 : 0.25;
  if (e.tags?.schoolClosure) return 1.5;
  return e.importance === "major" ? 1 : 0.25;
}

/** Map of YYYY-MM-DD → events touching that day. Multi-day events span every day. */
export function byDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const m = new Map<string, CalEvent[]>();
  for (const e of events) {
    for (const d of eachDay(e.startDate, e.endDate, 60)) {
      const list = m.get(d);
      if (list) list.push(e);
      else m.set(d, [e]);
    }
  }
  return m;
}

/** 0 (open) … 4 (packed) */
export function heatLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0.3) return 0;
  if (score < 1.5) return 1;
  if (score < 3) return 2;
  if (score < 5) return 3;
  return 4;
}

export function dayScore(events: CalEvent[], categoryOf: (e: CalEvent) => string): number {
  return events.reduce((s, e) => s + weight(e, categoryOf(e)), 0);
}

/** Events overlapping [start, end] inclusive, sorted by date then time. */
export function eventsInRange(events: CalEvent[], start: string, end: string): CalEvent[] {
  return events
    .filter((e) => e.endDate >= start && e.startDate <= end)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
}

/** Do two timed events on the same day overlap in clock time? All-day always overlaps. */
export function timesOverlap(a: CalEvent, b: CalEvent): boolean {
  if (a.allDay || b.allDay || !a.startTime || !b.startTime) return true;
  const aEnd = a.endTime ?? addHour(a.startTime);
  const bEnd = b.endTime ?? addHour(b.startTime);
  return a.startTime < bEnd && b.startTime < aEnd;
}

function addHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "19:30" → "7:30 pm" (times are already Atlanta-local; no conversion). */
export function fmtTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const mer = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${mer}` : `${hh} ${mer}`;
}
