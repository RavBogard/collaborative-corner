/**
 * Refresh the calendar data: `npm run collect` (all sources) or `npm run collect -- id1,id2`.
 * Saves to Vercel Blob when BLOB_READ_WRITE_TOKEN is set (from .env.local), else .data/events.json.
 */
import { collectAll } from "../src/lib/collect";
import { loadDataset, saveDataset } from "../src/lib/store";

const only = process.argv[2]?.split(",").filter(Boolean);
const t0 = Date.now();
const mark = (ok: boolean, partial: boolean) => (!ok ? "✗" : partial ? "~" : "✓");

const next = await collectAll(await loadDataset(), only, (s, done, total) =>
  console.log(`[${done}/${total}] ${mark(Boolean(s.lastSuccess), Boolean(s.error))} ${s.sourceId} (${s.eventCount})`),
);
await saveDataset(next);

console.log("\nSummary:");
for (const s of next.status.sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
  const ok = Boolean(s.lastSuccess) && s.lastAttempt === s.lastSuccess;
  console.log(`${mark(ok, Boolean(s.error))} ${s.sourceId.padEnd(36)} ${String(s.eventCount).padStart(4)} ${s.fetchedVia ?? ""} ${s.error ?? ""}`);
}
console.log(`\n${next.events.length} events in ${((Date.now() - t0) / 1000).toFixed(0)}s. ✓ ok  ~ partial  ✗ failed (previous events kept)`);
console.log("The live site picks up new data within an hour.");
