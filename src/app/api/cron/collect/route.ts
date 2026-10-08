import { revalidateTag } from "next/cache";
import { collectAll } from "@/lib/collect";
import { DATASET_TAG } from "@/lib/data";
import { loadDataset, saveDataset } from "@/lib/store";

export const maxDuration = 300;

/** Weekly collection (Vercel Cron). `?only=id1,id2` re-collects specific sources. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const only = new URL(request.url).searchParams.get("only")?.split(",").filter(Boolean);
  const previous = await loadDataset();
  const next = await collectAll(previous, only);
  await saveDataset(next);
  revalidateTag(DATASET_TAG, "max");
  const failed = next.status.filter((s) => s.error).map((s) => s.sourceId);
  return Response.json({ events: next.events.length, sources: next.status.length, failed });
}
