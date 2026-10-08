import { generateText, Output } from "ai";
import * as cheerio from "cheerio";
import { z } from "zod";
import type { Category } from "../types";
import type { RawEvent } from "./raw";

const PAGE_MODEL = process.env.AI_PAGE_MODEL ?? "anthropic/claude-haiku-5.5";
const PDF_MODEL = process.env.AI_PDF_MODEL ?? "anthropic/claude-sonnet-5.5";
const MAX_PAGE_CHARS = 60_000;

const ExtractedEvent = z.object({
  title: z.string(),
  startDate: z.string().describe("YYYY-MM-DD"),
  endDate: z.string().describe("YYYY-MM-DD inclusive; same as startDate for single-day").optional(),
  startTime: z.string().describe("HH:mm 24h local Atlanta time; omit if all-day/unknown").optional(),
  endTime: z.string().describe("HH:mm 24h").optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  importance: z
    .enum(["major", "regular"])
    .describe(
      "major = galas, community-wide programs, notable speakers, holiday celebrations, school breaks/closures, first/last day of school, graduations. regular = recurring classes, weekly services, minyanim, committee meetings, small groups.",
    ),
  schoolClosure: z.boolean().describe("true if schools are closed / on break / early release").optional(),
  confidence: z
    .number()
    .describe("0..1 how sure you are the date and title are right (lower if the year was inferred or the text was ambiguous)"),
});

const Extraction = z.object({ events: z.array(ExtractedEvent) });

function instructions(sourceName: string, category: Category, from: string, to: string) {
  const today = new Date().toISOString().slice(0, 10);
  const schoolHint =
    category === "public-school" || category === "day-school"
      ? "This is a school calendar. Extract ONLY days that matter to families' schedules: first/last day of school, holidays, breaks (list multi-day breaks as ONE event with start and end date), teacher workdays/student holidays, early-release days, graduation. Mark them schoolClosure=true where students are out, importance=major."
      : "Extract every dated event listed.";
  return `You extract calendar events for "${sourceName}" in Atlanta, Georgia. Today is ${today}.
${schoolHint}
Only include events dated between ${from} and ${to}. When a year is not stated, infer the nearest plausible year and lower confidence slightly.
Never invent events. If nothing is found, return an empty list. Times are local Eastern time.`;
}

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, header nav, footer").remove();
  // keep link targets that look like event detail pages
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (href && /event|calendar/i.test(href)) $(a).append(` [${href}]`);
  });
  return $("body").text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export async function extractFromPage(
  html: string,
  pageUrl: string,
  sourceName: string,
  category: Category,
  from: string,
  to: string,
): Promise<RawEvent[]> {
  const text = htmlToText(html).slice(0, MAX_PAGE_CHARS);
  if (text.length < 50) return [];
  const { output } = await generateText({
    model: PAGE_MODEL,
    output: Output.object({ schema: Extraction }),
    system: instructions(sourceName, category, from, to),
    prompt: `Page URL: ${pageUrl}\n\n${text}`,
  });
  return toRaw(output.events, pageUrl);
}

export async function extractFromPdf(
  pdf: Uint8Array,
  pdfUrl: string,
  sourceName: string,
  category: Category,
  from: string,
  to: string,
): Promise<RawEvent[]> {
  const { output } = await generateText({
    model: PDF_MODEL,
    output: Output.object({ schema: Extraction }),
    system: instructions(sourceName, category, from, to),
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data: pdf, mediaType: "application/pdf" },
          { type: "text", text: `Extract the events from this calendar PDF (${pdfUrl}).` },
        ],
      },
    ],
  });
  return toRaw(output.events, pdfUrl);
}

function toRaw(events: z.infer<typeof ExtractedEvent>[], fallbackUrl: string): RawEvent[] {
  return events.map((e) => ({
    title: e.title.trim(),
    startDate: e.startDate,
    endDate: e.endDate,
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: !e.startTime,
    location: e.location,
    url: e.url?.startsWith("http") ? e.url : fallbackUrl,
    importance: e.importance,
    confidence: Math.max(0, Math.min(1, e.confidence)),
    tags: e.schoolClosure ? { schoolClosure: true } : undefined,
  }));
}

/** Free-text date phrases from the community sheet → structured dates. */
const SheetDates = z.object({
  rows: z.array(
    z.object({
      index: z.number(),
      startDate: z.string().describe("YYYY-MM-DD, empty if unparseable"),
      endDate: z.string().optional(),
      startTime: z.string().describe("HH:mm 24h").optional(),
      endTime: z.string().optional(),
      confidence: z.number(),
    }),
  ),
});

export async function parseDatePhrases(
  phrases: { index: number; text: string; submitted?: string }[],
): Promise<z.infer<typeof SheetDates>["rows"]> {
  if (phrases.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { output } = await generateText({
    model: PAGE_MODEL,
    output: Output.object({ schema: SheetDates }),
    system: `Convert free-text event date/time phrases into structured dates. Today is ${today}. When the year is missing, pick the next occurrence on/after the submission date. Lower confidence for approximate phrases ("early November", "TBD").`,
    prompt: JSON.stringify(phrases),
  });
  return output.rows;
}
