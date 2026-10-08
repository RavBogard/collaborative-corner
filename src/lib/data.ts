import { cacheLife, cacheTag } from "next/cache";
import { loadDataset } from "./store";

export const DATASET_TAG = "dataset";

/** Cached read of the collected dataset; the weekly cron revalidates the tag. */
export async function getDataset() {
  "use cache";
  cacheTag(DATASET_TAG);
  cacheLife("days");
  return loadDataset();
}
