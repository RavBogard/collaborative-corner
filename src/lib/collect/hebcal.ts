import type { RawEvent } from "./raw";

interface HebcalItem {
  title: string;
  date: string;
  category: string;
  subcat?: string;
  yomtov?: boolean;
  memo?: string;
  link?: string;
}

/** Hebcal REST API: holidays, fasts, Rosh Chodesh, modern holidays (no Shabbat times). */
export function hebcalUrl(year: number) {
  return `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&ss=off&mf=on&c=off&i=off&year=${year}&month=x&geo=geoname&geonameid=4180439`;
}

export function hebcalToRaw(items: HebcalItem[]): RawEvent[] {
  const out: RawEvent[] = [];
  for (const it of items) {
    if (it.category === "candles" || it.category === "havdalah") continue;
    const major = it.yomtov === true || it.subcat === "major" || /Chanukah|Purim|Erev/.test(it.title);
    out.push({
      title: it.title,
      startDate: it.date.slice(0, 10),
      allDay: true,
      url: it.link,
      description: it.memo,
      importance: major ? "major" : "regular",
      confidence: 1,
    });
  }
  return out;
}

export async function fetchHebcal(from: string, to: string): Promise<RawEvent[]> {
  const years = new Set<number>();
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.add(y);
  const all: RawEvent[] = [];
  for (const y of years) {
    const res = await fetch(hebcalUrl(y));
    if (!res.ok) throw new Error(`Hebcal ${y}: HTTP ${res.status}`);
    const json = (await res.json()) as { items: HebcalItem[] };
    all.push(...hebcalToRaw(json.items));
  }
  return all;
}
