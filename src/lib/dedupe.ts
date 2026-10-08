import type { CalEvent, Category } from "./types";

/** A displayed event: the host's listing, plus other orgs that list the same event. */
export type MergedEvent = CalEvent & { alsoListedBy?: string[] };

/** Only community programming merges; holidays and school calendars stay separate. */
const MERGEABLE: ReadonlySet<Category> = new Set(["institution", "synagogue", "day-school", "community-sheet"]);

/**
 * Words every congregation or school uses for its *own* recurring items ("Morning Minyan",
 * "Candle Lighting", "Simchat Torah Service", "School Resumes"). Matching ignores them, so only
 * distinctive titles (speakers, named programs) can merge across organizations.
 */
const GENERIC = new Set(
  `minyan shacharit mincha maariv arvit ma ariv services service worship shabbat shabbos kabbalat erev havdalah candle lighting
   morning evening afternoon night daily weekly monthly torah study parasha parashat parsha class classes religious school
   hebrew preschool kindergarten pre resumes closed no office holiday break day early release dismissal
   rosh hashanah hashana yom kippur sukkot sukkos simchat simchas shemini atzeret hoshana rabah rabbah chanukah hanukkah
   purim pesach passover seder shavuot tu bishvat lag baomer tisha bav selichot yizkor kol nidre
   celebration party dinner lunch breakfast kiddush oneg meeting committee board club sisterhood mens men women womens
   group open play learn learning teen teens youth kids family families
   chol hamoed hamoed succos rosh chodesh tishrei cheshvan kislev tevet teves shevat adar nisan iyar sivan tammuz av elul`.split(/\s+/),
);

const distinctive = (tokens: Set<string>) => new Set([...tokens].filter((t) => !GENERIC.has(t)));

const STOP = new Set(
  "a an the and or of for with to at in on by from our your us join please come rsvp event events program presents present featuring feat w ft community atlanta jewish".split(
    " ",
  ),
);

export function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
  return new Set(words);
}

/** Overlap coefficient: shared tokens / size of the smaller title. */
export function titleSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function timesCompatible(a: CalEvent, b: CalEvent): boolean {
  if (!a.startTime || !b.startTime) return true;
  return Math.abs(minutes(a.startTime) - minutes(b.startTime)) <= 60;
}

export function isSameEvent(
  a: CalEvent,
  b: CalEvent,
  categoryOf: (e: CalEvent) => Category,
  ta = distinctive(titleTokens(a.title)),
  tb = distinctive(titleTokens(b.title)),
): boolean {
  if (a.sourceId === b.sourceId || a.startDate !== b.startDate || !timesCompatible(a, b)) return false;
  if (a.tags?.schoolClosure || b.tags?.schoolClosure) return false;
  if (categoryOf(a) === "day-school" && categoryOf(b) === "day-school") return false;
  if (a.importance !== "major" && b.importance !== "major") return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared >= 2 && titleSimilarity(ta, tb) >= 0.75;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Choose which listing represents the event:
 * 1. the org named as host on the community sheet, 2. the org whose name appears in the location
 * (the venue's own listing), 3. category priority, 4. most detail.
 */
function pickHost(group: CalEvent[], nameOf: (id: string) => string, categoryOf: (e: CalEvent) => Category): CalEvent {
  const sheetHost = group.find((e) => e.tags?.host)?.tags?.host;
  const matches = (name: string, text?: string) => {
    if (!text) return false;
    const n = norm(name);
    const t = norm(text);
    return t.includes(n) || n.includes(t);
  };
  const byHost = sheetHost && group.find((e) => categoryOf(e) !== "community-sheet" && matches(nameOf(e.sourceId), sheetHost));
  if (byHost) return byHost;
  const byVenue = group.find((e) => e.location && norm(e.location).includes(norm(nameOf(e.sourceId)).split(" ").slice(0, 2).join(" ")));
  if (byVenue) return byVenue;
  const rank: Category[] = ["institution", "synagogue", "day-school", "community-sheet"];
  return [...group].sort(
    (a, b) =>
      rank.indexOf(categoryOf(a)) - rank.indexOf(categoryOf(b)) ||
      Number(Boolean(b.startTime)) - Number(Boolean(a.startTime)) ||
      (b.location?.length ?? 0) - (a.location?.length ?? 0),
  )[0];
}

/**
 * Merge the same community event listed by several organizations into one card.
 * Tags (featured guest, collaboration) are carried over from any listing.
 */
export function mergeDuplicates(
  events: CalEvent[],
  nameOf: (sourceId: string) => string,
  categoryOf: (e: CalEvent) => Category,
): MergedEvent[] {
  const out: MergedEvent[] = [];
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) {
    if (!MERGEABLE.has(categoryOf(e))) {
      out.push(e);
      continue;
    }
    const list = byDate.get(e.startDate);
    if (list) list.push(e);
    else byDate.set(e.startDate, [e]);
  }

  for (const list of byDate.values()) {
    const tokens = list.map((e) => distinctive(titleTokens(e.title)));
    const used = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const group = [list[i]];
      for (let j = i + 1; j < list.length; j++) {
        if (used[j]) continue;
        if (group.some((g) => isSameEvent(g, list[j], categoryOf, tokens[list.indexOf(g)], tokens[j]))) {
          used[j] = true;
          group.push(list[j]);
        }
      }
      if (group.length === 1) {
        out.push(list[i]);
        continue;
      }
      const host = pickHost(group, nameOf, categoryOf);
      const others = [...new Set(group.filter((g) => g !== host).map((g) => g.sourceId))];
      const tags = Object.assign({}, ...group.map((g) => g.tags ?? {}), host.tags ?? {});
      out.push({
        ...host,
        tags: Object.keys(tags).length ? tags : undefined,
        confidence: Math.max(...group.map((g) => g.confidence)),
        importance: group.some((g) => g.importance === "major") ? "major" : host.importance,
        alsoListedBy: others,
      });
    }
  }
  return out;
}
