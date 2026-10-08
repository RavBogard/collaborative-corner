"use client";

import { useEffect, useMemo, useState } from "react";
import { byDay, dayScore, heatScale, type Heat } from "@/lib/analysis";
import { mergeDuplicates } from "@/lib/dedupe";
import type { CalEvent, Category } from "@/lib/types";
import { DayPanel } from "./DayPanel";
import { Filters, type FilterState } from "./Filters";
import { MonthGrid } from "./MonthGrid";

export interface SourceMeta {
  id: string;
  name: string;
  category: Category;
  area: string;
}

function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export function CalendarApp({
  events,
  sources,
  generatedAt,
}: {
  events: CalEvent[];
  sources: SourceMeta[];
  generatedAt: string;
}) {
  // Server render uses the collection date; the browser corrects to "today" in Atlanta on mount.
  const initial = generatedAt ? generatedAt.slice(0, 10) : "2026-10-08";
  const [today, setToday] = useState(initial);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [selection, setSelection] = useState<{ start: string; end: string }>({ start: initial, end: initial });
  useEffect(() => {
    const t = todayET();
    /* eslint-disable react-hooks/set-state-in-effect */
    setToday(t);
    setMonth(t.slice(0, 7));
    setSelection({ start: t, end: t });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const [filters, setFilters] = useState<FilterState>({
    categories: new Set<Category>(["holiday", "public-school", "day-school", "institution", "synagogue", "community-sheet"]),
    hiddenSources: new Set<string>(),
    majorOnly: true,
    showUnverified: true,
  });

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const categoryOf = (e: CalEvent) => sourceById.get(e.sourceId)?.category ?? "institution";

  const visible = useMemo(
    () =>
      events.filter((e) => {
        const s = sourceById.get(e.sourceId);
        if (!s || !filters.categories.has(s.category) || filters.hiddenSources.has(s.id)) return false;
        if (filters.majorOnly && e.importance !== "major") return false;
        if (!filters.showUnverified && e.confidence < 0.7) return false;
        return true;
      }),
    [events, filters, sourceById],
  );

  // The same community event listed by several orgs becomes one card (and counts once).
  const merged = useMemo(
    () => mergeDuplicates(visible, (id) => sourceById.get(id)?.name ?? id, (e) => sourceById.get(e.sourceId)?.category ?? "institution"),
    [visible, sourceById],
  );
  const days = useMemo(() => byDay(merged), [merged]);
  const heat = useMemo(() => {
    const scores = new Map([...days].map(([d, list]) => [d, dayScore(list, categoryOf)]));
    const level = heatScale([...scores.values()]);
    const m = new Map<string, Heat>();
    for (const [d, s] of scores) m.set(d, level(s));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <section className="mb-6 md:mb-8 max-w-3xl">
        <h1 className="font-display text-3xl md:text-5xl font-semibold leading-[1.05] tracking-tight">
          Find the open dates.{" "}
          <span className="text-pomegranate">Spot the conflicts.</span>
        </h1>
        <p className="mt-3 text-ink-soft md:text-lg">
          One calendar for Jewish Atlanta: organizations, synagogues, day schools, public school breaks, and
          holidays, gathered automatically from their public calendars. Warmer days are busier; pick any day to see what&apos;s on it.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Filters state={filters} onChange={setFilters} sources={sources} />
          <MonthGrid
            month={month}
            onMonth={setMonth}
            today={today}
            days={days}
            heat={heat}
            selection={selection}
            onSelect={setSelection}
            categoryOf={categoryOf}
          />
          <HeatLegend />
        </div>
        <DayPanel
          selection={selection}
          onSelection={(s) => {
            setSelection(s);
            setMonth(s.start.slice(0, 7));
          }}
          events={merged}
          sourceById={sourceById}
          generatedAt={generatedAt}
        />
      </div>
    </div>
  );
}

function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
      <span>Open</span>
      <div className="flex overflow-hidden rounded-full border border-line">
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="h-3 w-8" style={{ background: `var(--heat-${l})` }} />
        ))}
      </div>
      <span>Packed</span>
      <span className="ml-2">Relative to a typical day. Counts major events, school days off, and holidays.</span>
    </div>
  );
}
