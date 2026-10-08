import Papa from "papaparse";
import type { RawEvent } from "./raw";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s*(\d{4}))?/gi;
const TIME_RANGE_RE =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i;
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i;

const pad = (n: number) => String(n).padStart(2, "0");

function to24(h: number, m: number, mer: string | undefined): string {
  const pm = mer?.toLowerCase().startsWith("p");
  let hh = h % 12;
  if (pm) hh += 12;
  return `${pad(hh)}:${pad(m)}`;
}

/** Year for a month/day with no explicit year: next occurrence on/after `ref`. */
function inferYear(month: number, day: number, ref: string): number {
  const refYear = Number(ref.slice(0, 4));
  const candidate = `${refYear}-${pad(month)}-${pad(day)}`;
  return candidate >= ref ? refYear : refYear + 1;
}

export interface ParsedDate {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  confidence: number;
}

/**
 * Deterministic parser for phrases like "Wed Sep 23, 2026, 12:00pm - 1:00pm ET",
 * "Sunday, October 18, 4:00-6:00 PM", "Thursday, November 12-Saturday, November 14".
 * Returns null when it can't confidently parse (caller falls back to AI).
 */
export function parseDatePhrase(text: string, refDate: string): ParsedDate | null {
  const dates = [...text.matchAll(MONTH_RE)];
  if (dates.length === 0) return null;
  const mk = (m: RegExpMatchArray) => {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)];
    const day = Number(m[2]);
    if (!month || day < 1 || day > 31) return null;
    const year = m[3] ? Number(m[3]) : inferYear(month, day, refDate);
    return { date: `${year}-${pad(month)}-${pad(day)}`, explicitYear: Boolean(m[3]) };
  };
  const first = mk(dates[0]);
  if (!first) return null;
  const second = dates[1] ? mk(dates[1]) : null;

  const out: ParsedDate = {
    startDate: first.date,
    endDate: second && second.date >= first.date ? second.date : first.date,
    confidence: first.explicitYear ? 0.95 : 0.85,
  };

  const range = text.match(TIME_RANGE_RE);
  if (range) {
    const endMer = range[6];
    const startMer = range[3] ?? endMer;
    out.startTime = to24(Number(range[1]), Number(range[2] ?? 0), startMer);
    out.endTime = to24(Number(range[4]), Number(range[5] ?? 0), endMer);
    // "11:00-1:00 PM" — start actually AM
    if (!range[3] && out.startTime > out.endTime) out.startTime = to24(Number(range[1]), Number(range[2] ?? 0), "am");
  } else {
    const t = text.match(TIME_RE);
    if (t) out.startTime = to24(Number(t[1]), Number(t[2] ?? 0), t[3]);
  }
  if (/\b(approx|tbd|tba|around|early|mid|late)\b/i.test(text)) out.confidence = 0.5;
  return out;
}

/** "6/1/2026" → "2026-06-01" */
export function usDate(s: string | undefined): string | undefined {
  const m = s?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${pad(Number(m[1]))}-${pad(Number(m[2]))}` : undefined;
}

export interface SheetRow {
  index: number;
  submitted?: string;
  org: string;
  guest?: string;
  when: string;
  title?: string;
  location?: string;
  collaboration?: string;
}

/** Parse the Collaborative Corner CSV. Contact name/email columns are deliberately dropped. */
export function parseSheetCsv(csv: string): SheetRow[] {
  const { data } = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true });
  const [header, ...rows] = data;
  if (!header) return [];
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const c = {
    submitted: col(/submission/i),
    org: col(/organization/i),
    guest: col(/guest/i),
    when: col(/approximate|date and time/i),
    title: col(/title|content/i),
    location: col(/location/i),
    collab: col(/collaboration/i),
  };
  return rows
    .map((r, index) => ({
      index,
      submitted: usDate(r[c.submitted]?.trim()),
      org: r[c.org]?.trim() ?? "",
      guest: r[c.guest]?.trim() || undefined,
      when: r[c.when]?.trim() ?? "",
      title: r[c.title]?.trim() || undefined,
      location: r[c.location]?.trim().replace(/\s+/g, " ") || undefined,
      collaboration: r[c.collab]?.trim() || undefined,
    }))
    .filter((r) => r.org && r.when);
}

export function rowToRaw(row: SheetRow, d: ParsedDate, sheetUrl: string): RawEvent {
  const title = row.title && row.title.length <= 140 ? row.title : row.guest ? `${row.org}: ${row.guest}` : row.org;
  const collab = row.collaboration?.replace(/^yes\s*[-–:]?\s*/i, "").trim();
  return {
    title,
    startDate: d.startDate,
    endDate: d.endDate,
    startTime: d.startTime,
    endTime: d.endTime,
    allDay: !d.startTime,
    location: row.location,
    url: sheetUrl,
    description: row.title && row.title.length > 140 ? row.title.slice(0, 500) : undefined,
    importance: "major",
    confidence: d.confidence,
    tags: {
      host: row.org,
      featuredGuest: row.guest?.replace(/:\s*https?:\/\/\S+/, "").trim() || undefined,
      collaboration: /^yes/i.test(row.collaboration ?? "") ? collab || "Open to collaboration" : undefined,
    },
  };
}
