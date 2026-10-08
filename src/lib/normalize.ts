import { createHash } from "node:crypto";
import type { RawEvent } from "./collect/raw";
import { isValidDate } from "./dates";
import { inHorizon } from "./horizon";
import type { CalEvent, Source } from "./types";

const TIME = /^\d{2}:\d{2}$/;
const REGULAR_HINTS = /\b(minyan|shacharit|mincha|maariv|kabbalat shabbat service|shabbat morning service|torah study|daf yomi|board meeting|committee|office closed|mah jongg|yoga|staff)\b/i;

export function normalize(
  source: Source,
  raws: RawEvent[],
  h: { start: string; end: string },
): CalEvent[] {
  const seen = new Set<string>();
  const closureSpans = new Set<string>();
  const isSchool = source.category === "public-school" || source.category === "day-school";
  const out: CalEvent[] = [];
  for (const r of raws) {
    const title = r.title?.replace(/\s+/g, " ").trim();
    if (!title || !isValidDate(r.startDate)) continue;
    const endDate = isValidDate(r.endDate) && r.endDate >= r.startDate ? r.endDate : r.startDate;
    if (!inHorizon(r.startDate, endDate, h)) continue;
    const startTime = r.startTime && TIME.test(r.startTime) ? r.startTime : undefined;
    const endTime = startTime && r.endTime && TIME.test(r.endTime) ? r.endTime : undefined;

    const key = `${source.id}|${title.toLowerCase()}|${r.startDate}|${startTime ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Only schools can be "closed"; the same break often appears in both a feed and a PDF.
    const tags = cleanTags(isSchool ? r.tags : { ...r.tags, schoolClosure: undefined });
    if (tags?.schoolClosure) {
      const span = `${r.startDate}|${endDate}`;
      if (closureSpans.has(span)) continue;
      closureSpans.add(span);
    }

    out.push({
      id: createHash("sha1").update(key).digest("hex").slice(0, 12),
      sourceId: source.id,
      title,
      startDate: r.startDate,
      endDate,
      startTime,
      endTime,
      allDay: !startTime,
      location: r.location?.slice(0, 200),
      url: r.url,
      description: r.description,
      importance: r.importance ?? defaultImportance(source, title),
      confidence: r.confidence,
      tags,
    });
  }
  return out;
}

function defaultImportance(source: Source, title: string): CalEvent["importance"] {
  if (source.category === "public-school" || source.category === "community-sheet") return "major";
  return REGULAR_HINTS.test(title) ? "regular" : "major";
}

function cleanTags(tags: RawEvent["tags"]) {
  if (!tags) return undefined;
  const t = Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== undefined && v !== false));
  return Object.keys(t).length ? (t as CalEvent["tags"]) : undefined;
}
