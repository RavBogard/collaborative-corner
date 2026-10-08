/** Prints a comma-separated list of sources whose last run failed or was partial: `npm run collect -- $(npx tsx scripts/failed-ids.mts)` */
import { loadDataset } from "../src/lib/store";
const d = await loadDataset();
console.log(d.status.filter((s) => s.error && !/^partial: (classify|webpage: 0 events)/.test(s.error)).map((s) => s.sourceId).join(","));
