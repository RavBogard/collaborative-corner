"use client";

import { eventsInRange, fmtTime, schoolsOut } from "@/lib/analysis";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/sources";
import type { MergedEvent } from "@/lib/dedupe";
import { LOW_CONFIDENCE } from "@/lib/types";
import type { SourceMeta } from "./CalendarApp";

function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function DayPanel({
  selection,
  onSelection,
  events,
  sourceById,
  generatedAt,
}: {
  selection: { start: string; end: string };
  onSelection: (s: { start: string; end: string }) => void;
  events: MergedEvent[];
  sourceById: Map<string, SourceMeta>;
  generatedAt: string;
}) {
  const list = eventsInRange(events, selection.start, selection.end);
  const single = selection.start === selection.end;
  const grouped = CATEGORY_ORDER.map((c) => ({
    c,
    items: list.filter((e) => sourceById.get(e.sourceId)?.category === c),
  })).filter((g) => g.items.length);
  const closures = schoolsOut(list);

  return (
    <aside className="lg:sticky lg:top-20 self-start rounded-2xl border border-line bg-card shadow-[0_12px_32px_-18px_rgba(80,50,20,0.25)]">
      <div className="p-4 border-b border-line">
        <p className="text-xs uppercase tracking-wider text-ink-soft">Check a date</p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="date"
            value={selection.start}
            onChange={(e) => e.target.value && onSelection({ start: e.target.value, end: e.target.value > selection.end ? e.target.value : selection.end })}
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1.5"
            aria-label="Start date"
          />
          <span className="text-ink-soft">to</span>
          <input
            type="date"
            value={selection.end}
            min={selection.start}
            onChange={(e) => e.target.value && onSelection({ ...selection, end: e.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1.5"
            aria-label="End date"
          />
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">Tip: shift-click a second day on the calendar to select a range.</p>
      </div>

      <div className="p-4">
        <h2 className="font-display text-2xl font-semibold leading-tight">
          {single ? fmtDate(selection.start) : `${fmtDate(selection.start, { month: "short", day: "numeric" })} – ${fmtDate(selection.end, { month: "short", day: "numeric", year: "numeric" })}`}
        </h2>
        <Verdict count={list.filter((e) => e.importance === "major" && !e.tags?.schoolClosure).length} closures={closures} />

        {grouped.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nothing on the community calendars for these filters. 🌿</p>
        ) : (
          <div className="mt-4 space-y-5 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
            {grouped.map(({ c, items }) => (
              <section key={c}>
                <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: `var(--c-${c})` }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: `var(--c-${c})` }} />
                  {CATEGORY_LABEL[c]} · {items.length}
                </h3>
                <ul className="space-y-2">
                  {items.map((e) => (
                    <EventRow
                      key={e.id}
                      e={e}
                      source={sourceById.get(e.sourceId)}
                      showDate={!single}
                      nameOf={(id) => sourceById.get(id)?.name ?? id}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {generatedAt && (
          <p className="mt-5 text-[11px] text-ink-soft">
            Last gathered {new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })} · times in ET
          </p>
        )}
      </div>
    </aside>
  );
}

function Verdict({ count, closures }: { count: number; closures: number }) {
  const tone =
    count === 0 && closures === 0
      ? { t: "Looks wide open", c: "text-[color:var(--c-day-school)]" }
      : count + closures * 1.5 < 3
        ? { t: "Some activity", c: "text-gold" }
        : { t: "Busy: likely conflicts", c: "text-pomegranate" };
  return (
    <p className={`mt-1 text-sm font-medium ${tone.c}`}>
      {tone.t}
      <span className="text-ink-soft font-normal">
        {" "}· {count} major event{count === 1 ? "" : "s"}
        {closures > 0 && ` · ${closures} school${closures === 1 ? "" : "s"} off or early release`}
      </span>
    </p>
  );
}

function EventRow({
  e,
  source,
  showDate,
  nameOf,
}: {
  e: MergedEvent;
  source?: SourceMeta;
  showDate: boolean;
  nameOf: (id: string) => string;
}) {
  const time = e.allDay ? "All day" : `${fmtTime(e.startTime)}${e.endTime ? ` – ${fmtTime(e.endTime)}` : ""} ET`;
  const host = e.tags?.host ?? source?.name;
  const multi = e.endDate !== e.startDate;
  return (
    <li className="rounded-xl border border-line/80 bg-paper/60 p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer" className="hover:text-pomegranate-ink hover:underline underline-offset-2">
                {e.title}
              </a>
            ) : (
              e.title
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {showDate && `${fmtDate(e.startDate, { weekday: "short", month: "short", day: "numeric" })} · `}
            {multi && `${fmtDate(e.startDate, { month: "short", day: "numeric" })}–${fmtDate(e.endDate, { month: "short", day: "numeric" })} · `}
            {time}
            {host && ` · ${host}`}
          </p>
          {e.location && <p className="mt-0.5 text-xs text-ink-soft truncate">📍 {e.location}</p>}
          {e.alsoListedBy?.length ? (
            <p className="mt-0.5 text-xs text-ink-soft">Also listed by {e.alsoListedBy.map(nameOf).join(" · ")}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {e.tags?.schoolClosure && <Badge color="var(--c-public-school)">No school / early release</Badge>}
        {e.tags?.featuredGuest && <Badge color="var(--c-community-sheet)">★ {e.tags.featuredGuest}</Badge>}
        {e.tags?.collaboration && <Badge color="var(--c-day-school)">🤝 Open to collaboration: {e.tags.collaboration}</Badge>}
        {e.confidence < LOW_CONFIDENCE && (
          <Badge color="var(--gold)" title="Read automatically from the organization's website. Please confirm the details with them.">
            ⚠ Verify
          </Badge>
        )}
      </div>
    </li>
  );
}

function Badge({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
