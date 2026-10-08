import { describe, expect, it } from "vitest";
import { byDay, eventsInRange, fmtTime, heatScale, schoolsOut, timesOverlap } from "../analysis";
import { parseIcs } from "../collect/ical";
import { parseDatePhrase, parseSheetCsv, rowToRaw } from "../collect/sheet";
import { horizon } from "../horizon";
import { normalize } from "../normalize";
import type { CalEvent, Source } from "../types";

describe("parseDatePhrase", () => {
  it("parses explicit year with time range and ET suffix", () => {
    expect(parseDatePhrase("Wed Sep 23, 2026, 12:00pm - 1:00pm ET", "2026-09-16")).toEqual({
      startDate: "2026-09-23", endDate: "2026-09-23", startTime: "12:00", endTime: "13:00", confidence: 0.95,
    });
  });
  it("infers year and shares meridiem across a range", () => {
    expect(parseDatePhrase("Sunday, October 18, 4:00-6:00 PM", "2026-06-01")).toMatchObject({
      startDate: "2026-10-18", startTime: "16:00", endTime: "18:00",
    });
  });
  it("handles multi-day ranges", () => {
    expect(parseDatePhrase("Thursday, November 12-Saturday, November 14", "2026-09-01")).toMatchObject({
      startDate: "2026-11-12", endDate: "2026-11-14",
    });
  });
  it("rolls into next year when the date already passed", () => {
    expect(parseDatePhrase("Jan 13, 7pm", "2026-09-16")?.startDate).toBe("2027-01-13");
  });
  it("handles 11-1 pm as morning start", () => {
    expect(parseDatePhrase("Nov 1, 2026, 11:00-1:00 pm", "2026-09-01")).toMatchObject({ startTime: "11:00", endTime: "13:00" });
  });
  it("returns null without a month", () => {
    expect(parseDatePhrase("sometime in the fall", "2026-09-01")).toBeNull();
  });
});

describe("sheet", () => {
  const csv = `Submission Date,Organization Name,Featured Guest,Approximate or specific date and time,Title/Content (If available),Location Area (Ex. Sandy Springs or Intown),Open to collaboration?,Contact Person Name for the Featured Guest,Contact Person Email
6/1/2026,Ahavath Achim Synagogue,Brendan Murphy: https://example.com/x,"Sunday, October 18, 4:00-6:00 PM",From Teaching to Transformation,AA Synagogue,Yes,Nancy L,nancy@example.com
9/16/2026,The Dupree,Natan Sharansky,"Thu Oct 15, 2026, 6:00pm - 9:00pm ET",Two Struggles,"The Dupree - 6120 Powers Ferry Rd.","Yes - JFGA (YLD), AJC Atlanta",Eliav P,e@example.com`;
  it("drops contact columns and builds tags", () => {
    const rows = parseSheetCsv(csv);
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toMatch(/nancy|Eliav|@example/i);
    const raw = rowToRaw(rows[0], parseDatePhrase(rows[0].when, rows[0].submitted!)!, "u");
    expect(raw.tags).toEqual({ host: "Ahavath Achim Synagogue", featuredGuest: "Brendan Murphy", collaboration: "Open to collaboration" });
    expect(raw.startDate).toBe("2026-10-18");
  });
});

describe("parseIcs", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:1
SUMMARY:Fall Break
DTSTART;VALUE=DATE:20261123
DTEND;VALUE=DATE:20261128
END:VEVENT
BEGIN:VEVENT
UID:2
SUMMARY:Torah Study
DTSTART;TZID=America/New_York:20261015T193000
DTEND;TZID=America/New_York:20261015T210000
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:3
SUMMARY:UTC event
DTSTART:20261201T000000Z
DTEND:20261201T010000Z
END:VEVENT
END:VCALENDAR`;
  const evs = parseIcs(ics, "2026-08-01", "2028-07-31");
  it("converts all-day exclusive end to inclusive", () => {
    expect(evs.find((e) => e.title === "Fall Break")).toMatchObject({ startDate: "2026-11-23", endDate: "2026-11-27", allDay: true });
  });
  it("expands recurrences in Eastern time", () => {
    const ts = evs.filter((e) => e.title === "Torah Study");
    expect(ts.map((e) => e.startDate)).toEqual(["2026-10-15", "2026-10-22", "2026-10-29"]);
    expect(ts[0]).toMatchObject({ startTime: "19:30", endTime: "21:00" });
  });
  it("converts UTC times to Atlanta local (ET)", () => {
    expect(evs.find((e) => e.title === "UTC event")).toMatchObject({ startDate: "2026-11-30", startTime: "19:00" });
  });
});

describe("normalize", () => {
  const src: Source = { id: "s", name: "S", category: "synagogue", area: "x", fetch: [] };
  const h = { start: "2026-08-01", end: "2028-07-31" };
  it("validates, dedupes, filters horizon, and tags importance", () => {
    const out = normalize(
      src,
      [
        { title: "Gala", startDate: "2026-11-01", allDay: true, confidence: 1 },
        { title: "Gala", startDate: "2026-11-01", allDay: true, confidence: 1 },
        { title: "Morning Minyan", startDate: "2026-11-02", startTime: "07:00", allDay: false, confidence: 1 },
        { title: "Old", startDate: "2020-01-01", allDay: true, confidence: 1 },
        { title: "Bad", startDate: "Nov 3", allDay: true, confidence: 1 },
      ],
      h,
    );
    expect(out.map((e) => [e.title, e.importance])).toEqual([["Gala", "major"], ["Morning Minyan", "regular"]]);
  });
});

describe("school closures", () => {
  const h = { start: "2026-08-01", end: "2028-07-31" };
  it("only schools can close, and duplicate breaks merge", () => {
    const camp = normalize({ id: "jcc", name: "J", category: "institution", area: "", fetch: [] },
      [{ title: "School's Out Camp", startDate: "2026-10-08", allDay: true, confidence: 1, tags: { schoolClosure: true } }], h);
    expect(camp[0].tags?.schoolClosure).toBeUndefined();
    const district = normalize({ id: "g", name: "G", category: "public-school", area: "", fetch: [] },
      [
        { title: "Fall Break", startDate: "2026-10-12", endDate: "2026-10-16", allDay: true, confidence: 1, tags: { schoolClosure: true } },
        { title: "Fall Break (School Holiday)", startDate: "2026-10-12", endDate: "2026-10-16", allDay: true, confidence: 1, tags: { schoolClosure: true } },
      ], h);
    expect(district).toHaveLength(1);
  });
});

describe("horizon", () => {
  it("covers current + next school year", () => {
    expect(horizon(new Date("2026-10-08T12:00:00"))).toEqual({ start: "2026-08-01", end: "2028-07-31" });
    expect(horizon(new Date("2027-03-01T12:00:00"))).toEqual({ start: "2026-08-01", end: "2028-07-31" });
  });
});

describe("analysis", () => {
  const ev = (p: Partial<CalEvent>): CalEvent => ({
    id: Math.random().toString(), sourceId: "s", title: "t", startDate: "2026-11-01", endDate: "2026-11-01",
    allDay: true, importance: "major", confidence: 1, ...p,
  });
  it("spreads multi-day events across days", () => {
    const m = byDay([ev({ startDate: "2026-11-23", endDate: "2026-11-27" })]);
    expect([...m.keys()]).toHaveLength(5);
  });
  it("finds range overlaps", () => {
    const list = [ev({ startDate: "2026-11-10", endDate: "2026-11-12" }), ev({ startDate: "2026-12-01", endDate: "2026-12-01" })];
    expect(eventsInRange(list, "2026-11-12", "2026-11-20")).toHaveLength(1);
  });
  it("time overlap", () => {
    const a = ev({ allDay: false, startTime: "19:00", endTime: "21:00" });
    expect(timesOverlap(a, ev({ allDay: false, startTime: "20:00" }))).toBe(true);
    expect(timesOverlap(a, ev({ allDay: false, startTime: "12:00", endTime: "13:00" }))).toBe(false);
  });
  it("heat levels and time format", () => {
    const level = heatScale([1, 1, 2, 2, 3, 3, 4, 5, 6, 10]);
    expect([0, 1, 3, 5, 10].map(level)).toEqual([0, 1, 2, 3, 4]);
    expect(heatScale([])(5)).toBe(0);
    expect(schoolsOut([ev({ sourceId: "a", tags: { schoolClosure: true } }), ev({ sourceId: "a", tags: { schoolClosure: true } }), ev({ sourceId: "b" })])).toBe(1);
    expect(fmtTime("19:30")).toBe("7:30 pm");
    expect(fmtTime("12:00")).toBe("12 pm");
  });
});
