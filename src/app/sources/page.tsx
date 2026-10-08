import type { Metadata } from "next";
import { getDataset } from "@/lib/data";
import { CATEGORY_LABEL, CATEGORY_ORDER, SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "Sources · Collaborative Corner" };

function ago(iso?: string) {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

export default async function SourcesPage() {
  const data = await getDataset();
  const status = new Map(data.status.map((s) => [s.sourceId, s]));
  const ok = data.status.filter((s) => !s.error).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Where the dates come from</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every week, Collaborative Corner reads each organization&apos;s public calendar: calendar feeds where they
        exist, and their events pages or PDF school calendars otherwise (read by AI). Nobody types anything in by hand. If
        a source can&apos;t be read one week, its previous events stay up until the next successful read.
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        {ok} of {SOURCES.length} sources read successfully · {data.events.length.toLocaleString()} events · last run{" "}
        {ago(data.generatedAt)}
      </p>

      <div className="mt-8 space-y-8">
        {CATEGORY_ORDER.map((c) => {
          const list = SOURCES.filter((s) => s.category === c);
          if (!list.length) return null;
          return (
            <section key={c}>
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold" style={{ color: `var(--c-${c})` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--c-${c})` }} />
                {CATEGORY_LABEL[c]}
              </h2>
              <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((s) => {
                      const st = status.get(s.id);
                      const state = !s.fetch.length ? "manual" : !st ? "pending" : st.error ? (st.lastSuccess ? "stale" : "failing") : "ok";
                      return (
                        <tr key={s.id} className="border-b border-line/70 last:border-0 align-top">
                          <td className="p-3">
                            <a href={s.website ?? s.fetch[0]?.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                              {s.name}
                            </a>
                            <div className="text-xs text-ink-soft">{s.area}</div>
                            {(s.notes || (st?.error && state !== "ok")) && (
                              <div className="mt-1 text-xs text-ink-soft">{state === "manual" ? s.notes : (st?.error ?? s.notes)}</div>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <StatePill state={state} />
                            <div className="mt-1 text-xs text-ink-soft tabular-nums">
                              {st ? `${st.eventCount} events · ${ago(st.lastSuccess)}` : ""}
                              {st?.fetchedVia ? ` · ${st.fetchedVia}` : ""}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatePill({ state }: { state: "ok" | "stale" | "failing" | "pending" | "manual" }) {
  const map = {
    ok: ["Up to date", "var(--c-day-school)"],
    stale: ["Showing last good read", "var(--gold)"],
    failing: ["Couldn't read", "var(--pomegranate)"],
    pending: ["Not yet gathered", "var(--ink-soft)"],
    manual: ["No public calendar found", "var(--ink-soft)"],
  } as const;
  const [label, color] = map[state];
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {label}
    </span>
  );
}
