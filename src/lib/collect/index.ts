import { horizon } from "../horizon";
import { normalize } from "../normalize";
import { SOURCES } from "../sources";
import type { CalEvent, Dataset, FetchSpec, Source, SourceStatus } from "../types";
import { extractFromPage, extractFromPdf, parseDatePhrases } from "./ai-extract";
import { fetchHebcal } from "./hebcal";
import { parseIcs } from "./ical";
import type { RawEvent } from "./raw";
import { parseDatePhrase, parseSheetCsv, rowToRaw } from "./sheet";

const UA =
  "Mozilla/5.0 (compatible; CollaborativeCornerBot/1.0; +community calendar for Atlanta Jewish organizations)";
const FETCH_TIMEOUT_MS = 25_000;
const CONCURRENCY = 8;

async function fetchWithTimeout(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

async function runSpec(source: Source, spec: FetchSpec, from: string, to: string): Promise<RawEvent[]> {
  switch (spec.type) {
    case "hebcal":
      return fetchHebcal(from, to);
    case "ical": {
      const text = await (await fetchWithTimeout(spec.url.replace(/^webcal:/, "https:"))).text();
      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("not an ICS feed");
      return parseIcs(text, from, to);
    }
    case "pdf": {
      const buf = new Uint8Array(await (await fetchWithTimeout(spec.url)).arrayBuffer());
      return extractFromPdf(buf, spec.url, source.name, source.category, from, to);
    }
    case "webpage": {
      const res = await fetchWithTimeout(spec.url);
      if (res.headers.get("content-type")?.includes("pdf")) {
        const buf = new Uint8Array(await res.arrayBuffer());
        return extractFromPdf(buf, spec.url, source.name, source.category, from, to);
      }
      return extractFromPage(await res.text(), spec.url, source.name, source.category, from, to);
    }
    case "sheet":
      return collectSheet(spec.url);
  }
}

async function collectSheet(url: string): Promise<RawEvent[]> {
  const id = url.match(/\/d\/([\w-]+)/)?.[1];
  if (!id) throw new Error("bad sheet url");
  const csv = await (await fetchWithTimeout(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`)).text();
  const rows = parseSheetCsv(csv);
  const viewUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  const today = new Date().toISOString().slice(0, 10);
  const out: RawEvent[] = [];
  const unparsed: typeof rows = [];
  for (const row of rows) {
    const d = parseDatePhrase(row.when, row.submitted ?? today);
    if (d) out.push(rowToRaw(row, d, viewUrl));
    else unparsed.push(row);
  }
  if (unparsed.length) {
    const ai = await parseDatePhrases(
      unparsed.map((r) => ({ index: r.index, text: r.when, submitted: r.submitted })),
    );
    for (const a of ai) {
      const row = unparsed.find((r) => r.index === a.index);
      if (row && a.startDate) {
        out.push(rowToRaw(row, { ...a, endDate: a.endDate || a.startDate, confidence: Math.min(a.confidence, 0.75) }, viewUrl));
      }
    }
  }
  return out;
}

async function collectSource(
  source: Source,
  h: { start: string; end: string },
): Promise<{ events: CalEvent[]; status: SourceStatus }> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  for (const spec of source.fetch) {
    try {
      const raws = await runSpec(source, spec, h.start, h.end);
      const events = normalize(source, raws, h);
      // An empty result from a page is suspicious; try the next spec if there is one.
      if (events.length === 0 && spec !== source.fetch.at(-1)) {
        errors.push(`${spec.type}: 0 events`);
        continue;
      }
      return {
        events,
        status: { sourceId: source.id, lastAttempt: now, lastSuccess: now, eventCount: events.length, fetchedVia: spec.type },
      };
    } catch (e) {
      errors.push(`${spec.type}: ${(e as Error).message}`.slice(0, 200));
    }
  }
  return {
    events: [],
    status: { sourceId: source.id, lastAttempt: now, eventCount: 0, error: errors.join(" | ") || "no fetch URL configured" },
  };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx]);
      }
    }),
  );
  return results;
}

/**
 * Collect all (or some) sources and merge into the previous dataset.
 * A source that fails keeps its previous events, so one broken site never empties the calendar.
 */
export async function collectAll(previous: Dataset, only?: string[]): Promise<Dataset> {
  const h = horizon();
  const targets = only?.length ? SOURCES.filter((s) => only.includes(s.id)) : SOURCES.filter((s) => s.fetch.length);
  const results = await pool(targets, CONCURRENCY, (s) => collectSource(s, h));

  const touched = new Map(targets.map((s, i) => [s.id, results[i]]));
  const events: CalEvent[] = previous.events.filter((e) => {
    const r = touched.get(e.sourceId);
    return !r || !r.status.lastSuccess; // keep old events for untouched or failed sources
  });
  const prevStatus = new Map(previous.status.map((s) => [s.sourceId, s]));
  for (const [id, r] of touched) {
    if (r.status.lastSuccess) events.push(...r.events);
    else {
      const prev = prevStatus.get(id);
      r.status.lastSuccess = prev?.lastSuccess;
      r.status.eventCount = previous.events.filter((e) => e.sourceId === id).length;
    }
    prevStatus.set(id, r.status);
  }
  // drop sources that were removed from the registry
  const known = new Set(SOURCES.map((s) => s.id));
  return {
    generatedAt: new Date().toISOString(),
    events: events.filter((e) => known.has(e.sourceId)).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    status: [...prevStatus.values()].filter((s) => known.has(s.sourceId)),
  };
}
