import registry from "../../data/sources.json";
import type { Category, Source } from "./types";

export const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1k3SD6LfLZ9uYBvBRkverHqDm5Oc902fvmXGjrkXIN5k/edit";

const BUILT_IN: Source[] = [
  {
    id: "jewish-holidays",
    name: "Jewish Holidays",
    category: "holiday",
    area: "everywhere",
    website: "https://www.hebcal.com",
    fetch: [{ type: "hebcal", url: "https://www.hebcal.com" }],
  },
  {
    id: "collaborative-corner-sheet",
    name: "Collaborative Corner sheet",
    category: "community-sheet",
    area: "metro",
    website: SHEET_URL,
    fetch: [{ type: "sheet", url: SHEET_URL }],
    notes: "Community-submitted speakers and programs. Contact details are kept in the sheet, not shown here.",
  },
];

/** Curated registry lives in data/sources.json so it can be edited without touching code. */
export const SOURCES: Source[] = [...BUILT_IN, ...(registry as Source[])];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export const CATEGORY_LABEL: Record<Category, string> = {
  holiday: "Jewish holidays",
  "community-sheet": "Collaborative Corner",
  institution: "Organizations",
  synagogue: "Synagogues",
  "day-school": "Jewish day schools",
  "public-school": "Public schools",
};

export const CATEGORY_ORDER: Category[] = [
  "holiday",
  "public-school",
  "day-school",
  "institution",
  "synagogue",
  "community-sheet",
];
