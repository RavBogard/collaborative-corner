import { cacheLife, cacheTag } from "next/cache";
import { loadDataset } from "./store";

export const DATASET_TAG = "dataset";

/** Cached read of the collected dataset; refreshed hourly so a manual `npm run collect` shows up within the hour. */
export async function getDataset() {
  "use cache";
  cacheTag(DATASET_TAG);
  cacheLife("hours");
  return loadDataset();
}
