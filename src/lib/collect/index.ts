import { horizon } from "../horizon";
import { normalize } from "../normalize";
import { SOURCES } from "../sources";
import type { CalEvent, Dataset, FetchSpec, Source, SourceStatus } from "../types";
import { classifyImportance, extractFromPage, extractFromPdf, parseDatePhrases } from "./ai-extract";
import { fetchTribe, parseShulCloudCsv, parseSquarespace } from "./feeds";
import { fetchHebcal } from "./hebcal";
import { parseIcs } from "./ical";
import type { RawEvent } from "./raw";
import { parseDatePhrase, parseSheetCsv, rowToRaw } from "./sheet";

// Several org sites (ShulCloud, Cloudflare-fronted WordPress) reject non-browser requests.
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 CollaborativeCorner/1.0",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/calendar,application/json,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};
const FETCH_TIMEOUT_MS = 25_000;
const CONCURRENCY = 8;

/** Some hosts (ShulCloud's WAF) randomly answer 406/429/503; retry those a few times. */
async function fetchWithTimeout(url: string, tries = 6): Promise<Response> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) return res;
    if (i >= tries || ![406, 429, 503].includes(res.status)) throw new Error(`HTTP ${res.status} for ${url}`);
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 750 * i));
  }
}

let chain: Promise<unknown> = Promise.resolve();
function serially<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => new Promise((r) => setTimeout(r, 1500)),
    () => new Promise((r) => setTimeout(r, 1500)),
  );
  return run;
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
    case "shulcloud": {
      // ShulCloud's firewall rejects bursts across its sites, so fetch these one at a time.
      const text = await serially(async () => (await fetchWithTimeout(spec.url, 12)).text());
      if (!/^﻿?Type,Start/.test(text)) throw new Error("not a ShulCloud CSV");
      return parseShulCloudCsv(text);
    }
    case "tribe":
      return fetchTribe(spec.url, from, to, fetchWithTimeout);
    case "squarespace":
      return parseSquarespace(await (await fetchWithTimeout(spec.url)).json(), spec.url);
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

/** Feed types whose events carry no significance signal and get AI-classified. */
const NEEDS_CLASSIFYING = new Set(["ical", "shulcloud", "tribe", "squarespace"]);

/**
 * Every structured spec (feeds, PDFs) is collected and combined, e.g. a district's 2026-27 and
 * 2027-28 PDFs. Plain `webpage` specs are fallbacks, used only when nothing structured worked.
 */
async function collectSource(
  source: Source,
  h: { start: string; end: string },
): Promise<{ events: CalEvent[]; status: SourceStatus }> {
  const now = new Date().toISOString();
  const errors: string[] = [];
  const structured = source.fetch.filter((f) => f.type !== "webpage");
  const fallbacks = source.fetch.filter((f) => f.type === "webpage");
  let raws: RawEvent[] = [];
  const via = new Set<string>();

  const attempt = async (spec: FetchSpec) => {
    try {
      let got = await runSpec(source, spec, h.start, h.end);
      if (NEEDS_CLASSIFYING.has(spec.type) && source.category !== "holiday") {
        // Classification is a nice-to-have: on failure, keep the feed and use keyword heuristics.
        got = await classifyImportance(source.name, source.category, got).catch((e) => {
          errors.push(`classify: ${(e as Error).message}`.slice(0, 120));
          return got;
        });
      }
      if (got.length) {
        raws = raws.concat(got);
        via.add(spec.type);
      } else errors.push(`${spec.type}: 0 events`);
    } catch (e) {
      errors.push(`${spec.type}: ${(e as Error).message}`.slice(0, 200));
    }
  };

  for (const spec of structured) await attempt(spec);
  for (const spec of fallbacks) {
    if (raws.length) break;
    await attempt(spec);
  }

  const events = normalize(source, raws, h);
  if (via.size) {
    return {
      events,
      status: {
        sourceId: source.id,
        lastAttempt: now,
        lastSuccess: now,
        eventCount: events.length,
        fetchedVia: [...via].join("+"),
        error: errors.length ? `partial: ${errors.join(" | ")}` : undefined,
      },
    };
  }
  return {
    events: [],
    status: { sourceId: source.id, lastAttempt: now, eventCount: 0, error: errors.join(" | ") || "no public calendar found" },
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
export async function collectAll(
  previous: Dataset,
  only?: string[],
  onProgress?: (s: SourceStatus, done: number, total: number) => void,
): Promise<Dataset> {
  const h = horizon();
  const targets = only?.length ? SOURCES.filter((s) => only.includes(s.id)) : SOURCES.filter((s) => s.fetch.length);
  let done = 0;
  const results = await pool(targets, CONCURRENCY, async (s) => {
    const r = await collectSource(s, h);
    onProgress?.(r.status, ++done, targets.length);
    return r;
  });

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
