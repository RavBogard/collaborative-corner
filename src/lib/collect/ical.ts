import ical, { type VEvent } from "node-ical";
import { addDays, localDate, localTime } from "../dates";
import type { RawEvent } from "./raw";

/** node-ical represents all-day dates as system-local midnight. */
function systemLocalDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MAX_PER_SERIES = 200;

export function parseIcs(text: string, from: string, to: string): RawEvent[] {
  const data = ical.sync.parseICS(text);
  const out: RawEvent[] = [];
  const range = { from: new Date(`${from}T00:00:00Z`), to: new Date(`${to}T23:59:59Z`) };

  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as VEvent;
    if (ev.status === "CANCELLED") continue;
    let instances;
    try {
      instances = ical.expandRecurringEvent(ev, range).slice(0, MAX_PER_SERIES);
    } catch {
      continue;
    }
    for (const inst of instances) {
      const title = textOf(inst.summary ?? ev.summary);
      if (!title) continue;
      if (inst.isFullDay) {
        const startDate = systemLocalDate(inst.start);
        const endExclusive = inst.end ? systemLocalDate(inst.end) : addDays(startDate, 1);
        out.push({
          title,
          startDate,
          endDate: endExclusive > startDate ? addDays(endExclusive, -1) : startDate,
          allDay: true,
          location: textOf(ev.location),
          url: textOf(ev.url),
          description: textOf(ev.description)?.slice(0, 500),
          confidence: 1,
        });
      } else {
        const end = inst.end ?? inst.start;
        out.push({
          title,
          startDate: localDate(inst.start),
          endDate: localDate(end),
          startTime: localTime(inst.start),
          endTime: localTime(end),
          allDay: false,
          location: textOf(ev.location),
          url: textOf(ev.url),
          description: textOf(ev.description)?.slice(0, 500),
          confidence: 1,
        });
      }
    }
  }
  return out;
}

function textOf(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "object" && "val" in v) return textOf((v as { val: unknown }).val);
  return String(v);
}
