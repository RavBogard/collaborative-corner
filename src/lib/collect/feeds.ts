import Papa from "papaparse";
import type { RawEvent } from "./raw";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();

/** "2026-10-09 18:00:00" (already local Atlanta time) → date + time parts */
function splitLocal(s: string | undefined): { date?: string; time?: string } {
  const m = s?.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  return m ? { date: m[1], time: m[2] } : {};
}

/**
 * ShulCloud calendar CSV export. Columns: Type,Start,End,Name,Calendar,Location,Description,Hebrew Date.
 * "Schedule Rule" rows are recurring services and are skipped.
 */
export function parseShulCloudCsv(csv: string): RawEvent[] {
  const { data } = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  const out: RawEvent[] = [];
  for (const r of data) {
    if (!r.Name || /schedule rule/i.test(r.Type ?? "")) continue;
    const s = splitLocal(r.Start);
    const e = splitLocal(r.End);
    if (!s.date) continue;
    const allDay = !s.time || (s.time === "00:00" && (!e.time || e.time === "00:00" || e.time === "23:59"));
    out.push({
      title: decode(r.Name),
      startDate: s.date,
      endDate: e.date,
      startTime: allDay ? undefined : s.time,
      endTime: allDay || e.time === s.time ? undefined : e.time,
      allDay,
      location: r.Location ? decode(r.Location) : undefined,
      description: [r.Calendar && `Calendar: ${decode(r.Calendar)}`, r.Description && decode(r.Description)]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 500) || undefined,
      confidence: 1,
    });
  }
  return out;
}

interface TribeEvent {
  title: string;
  url?: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  venue?: { venue?: string } | [];
  categories?: { name: string }[];
}

/** The Events Calendar (WordPress) REST API, paginated. */
export async function fetchTribe(
  baseUrl: string,
  from: string,
  to: string,
  get: (url: string) => Promise<Response>,
  maxPages = 25,
): Promise<RawEvent[]> {
  const u = new URL(baseUrl);
  const today = new Date().toISOString().slice(0, 10);
  u.searchParams.set("start_date", today > from ? today : from);
  u.searchParams.set("end_date", to);
  u.searchParams.set("per_page", "50");
  const out: RawEvent[] = [];
  let next: string | undefined = u.toString();
  for (let page = 0; next && page < maxPages; page++) {
    const json = (await (await get(next)).json()) as { events: TribeEvent[]; next_rest_url?: string };
    for (const e of json.events ?? []) {
      const s = splitLocal(e.start_date);
      const en = splitLocal(e.end_date);
      if (!s.date) continue;
      out.push({
        title: decode(e.title),
        startDate: s.date,
        endDate: en.date,
        startTime: e.all_day ? undefined : s.time,
        endTime: e.all_day || en.time === s.time ? undefined : en.time,
        allDay: e.all_day,
        url: e.url,
        location: !Array.isArray(e.venue) && e.venue?.venue ? decode(e.venue.venue) : undefined,
        description: e.categories?.length ? `Categories: ${e.categories.map((c) => c.name).join(", ")}` : undefined,
        confidence: 1,
      });
    }
    next = json.next_rest_url;
  }
  return out;
}

interface SquarespaceEvent {
  title: string;
  startDate: number;
  endDate: number;
  fullUrl?: string;
  location?: { addressTitle?: string };
}

const etDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(ms);
const etTime = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);

/** Squarespace events collection (?format=json). */
export function parseSquarespace(json: { upcoming?: SquarespaceEvent[]; past?: SquarespaceEvent[] }, siteUrl: string): RawEvent[] {
  return [...(json.upcoming ?? []), ...(json.past ?? [])].map((e) => ({
    title: decode(e.title),
    startDate: etDate(e.startDate),
    endDate: etDate(e.endDate),
    startTime: etTime(e.startDate),
    endTime: etTime(e.endDate),
    allDay: false,
    url: e.fullUrl ? new URL(e.fullUrl, siteUrl).toString() : undefined,
    location: e.location?.addressTitle,
    confidence: 1,
  }));
}
