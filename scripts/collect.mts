/** Local collection run: `npm run collect [-- id1,id2]`. Writes .data/events.json (or Blob if token set). */
import { collectAll } from "../src/lib/collect";
import { loadDataset, saveDataset } from "../src/lib/store";

const only = process.argv[2]?.split(",").filter(Boolean);
const t0 = Date.now();
const next = await collectAll(await loadDataset(), only);
await saveDataset(next);
for (const s of next.status.sort((a, b) => a.sourceId.localeCompare(b.sourceId))) {
  console.log(`${s.error ? "✗" : "✓"} ${s.sourceId.padEnd(36)} ${String(s.eventCount).padStart(4)} ${s.fetchedVia ?? ""} ${s.error ?? ""}`);
}
console.log(`\n${next.events.length} events in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
