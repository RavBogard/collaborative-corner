import type { Metadata } from "next";
import { getDataset } from "@/lib/data";
import { CATEGORY_LABEL, CATEGORY_ORDER, SOURCES } from "@/lib/sources";
import type { FetchSpec, SourceStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Sources · Collaborative Corner" };

const fmtDay = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "never";

/** Plain-language label for what a fetch spec reads. */
function feedLabel(f: FetchSpec): string {
  const year = f.note?.match(/20\d\d[-–]\d\d/)?.[0];
  switch (f.type) {
    case "ical":
      return "Calendar feed";
    case "shulcloud":
      return "Synagogue calendar export";
    case "tribe":
    case "squarespace":
      return "Website events feed";
    case "pdf":
      return year ? `${year} calendar (PDF)` : "Calendar (PDF)";
    case "webpage":
      return "Events page";
    case "sheet":
      return "Google Sheet";
    case "hebcal":
      return "Hebcal.com";
  }
}

type State = "ok" | "stale" | "failing" | "pending" | "manual";

function stateOf(hasFetch: boolean, st?: SourceStatus): State {
  if (!hasFetch) return "manual";
  if (!st) return "pending";
  if (st.lastSuccess && st.lastAttempt === st.lastSuccess) return "ok";
  return st.lastSuccess ? "stale" : "failing";
}

export default async function SourcesPage() {
  const data = await getDataset();
  const status = new Map(data.status.map((s) => [s.sourceId, s]));
  const withData = SOURCES.filter((s) => (status.get(s.id)?.eventCount ?? 0) > 0).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Where the dates come from</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Collaborative Corner reads each organization&apos;s <em>public</em> calendar: calendar feeds where they exist,
        and otherwise their events pages or PDF school calendars, which AI reads. Nobody types anything in by
        hand. If a calendar can&apos;t be read, its previous events stay up until the next successful read.
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        {SOURCES.length} sources · {withData} with events · {data.events.length.toLocaleString()} events total · last
        gathered {fmtDay(data.generatedAt)}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Missing your organization, or see something wrong? Let the Collaborative Corner organizers know. A public
        calendar link (Google Calendar, iCal, or a web page) is all we need.
      </p>

      <div className="mt-8 space-y-8">
        {CATEGORY_ORDER.map((c) => {
          const list = SOURCES.filter((s) => s.category === c).sort((a, b) => a.name.localeCompare(b.name));
          if (!list.length) return null;
          return (
            <section key={c}>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold" style={{ color: `var(--c-${c})` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--c-${c})` }} />
                {CATEGORY_LABEL[c]} <span className="text-sm font-normal text-ink-soft">({list.length})</span>
              </h2>
              <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
                {list.map((s) => {
                  const st = status.get(s.id);
                  const state = stateOf(s.fetch.length > 0, st);
                  return (
                    <div key={s.id} className="flex flex-col gap-2 border-b border-line/70 p-3 last:border-0 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <a href={s.website ?? s.fetch[0]?.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {s.name}
                        </a>
                        <span className="text-xs text-ink-soft"> · {s.area}</span>
                        {s.fetch.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            <span className="text-ink-soft">Reads:</span>
                            {s.fetch.map((f) => (
                              <a
                                key={f.url}
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-pomegranate-ink underline decoration-line underline-offset-2 hover:decoration-pomegranate"
                              >
                                {feedLabel(f)}
                              </a>
                            ))}
                          </div>
                        )}
                        {s.notes && <div className="mt-1 text-xs text-ink-soft">{s.notes}</div>}
                        {state === "manual" && (
                          <div className="mt-1 text-xs text-ink-soft">
                            We couldn&apos;t find a public calendar for this organization (it may be behind a login).
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 sm:text-right" title={st?.error}>
                        <StatePill state={state} />
                        <div className="mt-1 text-xs text-ink-soft tabular-nums">
                          {st && state !== "failing" && `${st.eventCount} events · ${fmtDay(st.lastSuccess)}`}
                          {state === "failing" && "Their calendar couldn't be read"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatePill({ state }: { state: State }) {
  const map = {
    ok: ["Up to date", "var(--c-day-school)"],
    stale: ["Showing last good read", "var(--gold)"],
    failing: ["Not available", "var(--pomegranate)"],
    pending: ["Not yet gathered", "var(--ink-soft)"],
    manual: ["No public calendar", "var(--ink-soft)"],
  } as const;
  const [label, color] = map[state];
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {label}
    </span>
  );
}
