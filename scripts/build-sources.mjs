// One-off: convert data/sources.research.json → data/sources.json (curated registry).
import { readFileSync, writeFileSync } from "node:fs";
const research = JSON.parse(readFileSync("data/sources.research.json", "utf8"));
const out = research.map((s) => {
  let fetch = (s.fetch ?? []).map((f) => {
    let type = f.type, url = f.url;
    if (type === "csv") { type = "shulcloud"; url = url.replace(/date_end_x=\d+/, "date_end_x=12"); }
    if (type === "json") type = "squarespace";
    if (type === "webpage" && url.includes("/wp-json/tribe/events/")) type = "tribe";
    return { type, url, ...(f.note ? { note: f.note } : {}) };
  });
  // drop redundant duplicates of the same school year
  fetch = fetch.filter((f) => !/graphical|student grid/i.test(f.note ?? ""));
  // MJCCA's REST feed is ~4,600 events/month of fitness classes; use its ICS (next ~30) instead
  if (s.id === "marcus-jcc-atlanta") fetch = fetch.filter((f) => f.type !== "tribe");
  // prefer the full REST feed over the 30-event ICS where both exist
  if (fetch.some((f) => f.type === "tribe")) fetch = fetch.filter((f) => f.type !== "ical");
  const notes = s.id === "marcus-jcc-atlanta"
    ? "MJCCA's feed lists thousands of fitness classes, so only its next ~30 upcoming events are read."
    : s.notes;
  return { id: s.id, name: s.name, category: s.category, area: s.area, website: s.website, fetch, ...(s.id === "marcus-jcc-atlanta" ? { notes } : s.notes ? { devNotes: s.notes } : {}) };
});
writeFileSync("data/sources.json", JSON.stringify(out, null, 2) + "\n");
console.log(out.length, "sources;", out.filter((s) => s.fetch.length).length, "with fetch specs");
