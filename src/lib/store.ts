import { get, put } from "@vercel/blob";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Dataset } from "./types";

const BLOB_PATH = "dataset/events.json";
const LOCAL_PATH = path.join(process.cwd(), ".data", "events.json");
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export const EMPTY: Dataset = { generatedAt: "", events: [], status: [] };

export async function loadDataset(): Promise<Dataset> {
  try {
    if (useBlob()) {
      const res = await get(BLOB_PATH, { access: "private", useCache: false });
      if (!res?.stream) return EMPTY;
      return (await new Response(res.stream).json()) as Dataset;
    }
    return JSON.parse(await readFile(LOCAL_PATH, "utf8")) as Dataset;
  } catch {
    return EMPTY;
  }
}

export async function saveDataset(data: Dataset): Promise<void> {
  const body = JSON.stringify(data);
  if (useBlob()) {
    await put(BLOB_PATH, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await writeFile(LOCAL_PATH, body);
}
