/** Re-apply normalize() rules to the stored dataset without re-fetching anything. */
import { horizon } from "../src/lib/horizon";
import { normalize } from "../src/lib/normalize";
import { SOURCE_BY_ID } from "../src/lib/sources";
import { loadDataset, saveDataset } from "../src/lib/store";

const d = await loadDataset();
const bySource = Object.groupBy(d.events, (e) => e.sourceId);
const events = Object.entries(bySource).flatMap(([id, list]) => {
  const source = SOURCE_BY_ID.get(id);
  return source && list ? normalize(source, list, horizon()) : [];
});
await saveDataset({ ...d, events: events.sort((a, b) => a.startDate.localeCompare(b.startDate)) });
console.log(`${d.events.length} → ${events.length} events`);
