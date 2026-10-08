"use client";

import { addDays } from "@/lib/dates";
import { schoolsOut, type Heat } from "@/lib/analysis";
import type { CalEvent } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Shabbat"];

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function gridDays(month: string): string[] {
  const first = `${month}-01`;
  const dow = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = addDays(first, -dow);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function MonthGrid({
  month,
  onMonth,
  today,
  days,
  heat,
  selection,
  onSelect,
  categoryOf,
}: {
  month: string;
  onMonth: (m: string) => void;
  today: string;
  days: Map<string, CalEvent[]>;
  heat: Map<string, Heat>;
  selection: { start: string; end: string };
  onSelect: (s: { start: string; end: string }) => void;
  categoryOf: (e: CalEvent) => string;
}) {
  const cells = gridDays(month);
  // drop a trailing week entirely outside the month
  const visibleCells = cells.slice(35).every((d) => !d.startsWith(month)) ? cells.slice(0, 35) : cells;

  return (
    <div className="rounded-2xl border border-line bg-card shadow-[0_1px_0_rgba(80,50,20,0.04),0_12px_32px_-18px_rgba(80,50,20,0.25)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <h2 className="font-display text-2xl font-semibold mr-auto">{monthLabel(month)}</h2>
        <button
          onClick={() => {
            onMonth(today.slice(0, 7));
            onSelect({ start: today, end: today });
          }}
          className="rounded-full border border-line px-3 py-1 text-sm hover:bg-paper-2"
        >
          Today
        </button>
        <NavButton label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}>‹</NavButton>
        <NavButton label="Next month" onClick={() => onMonth(shiftMonth(month, 1))}>›</NavButton>
      </div>

      <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-ink-soft border-b border-line">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`px-2 py-1.5 ${i === 6 ? "text-gold font-semibold" : ""}`}>
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w === "Shabbat" ? "Sh" : w.slice(0, 2)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {visibleCells.map((d) => {
          const inMonth = d.startsWith(month);
          const list = days.get(d) ?? [];
          const level = heat.get(d) ?? 0;
          const selected = d >= selection.start && d <= selection.end;
          const holiday = list.find((e) => categoryOf(e) === "holiday" && e.importance === "major");
          const closures = schoolsOut(list);
          const others = list.filter((e) => categoryOf(e) !== "holiday" && !e.tags?.schoolClosure);
          return (
            <button
              key={d}
              onClick={(ev) =>
                onSelect(
                  ev.shiftKey && d > selection.start ? { start: selection.start, end: d } : { start: d, end: d },
                )
              }
              aria-label={`${d}: ${list.length} events`}
              aria-pressed={selected}
              className={`relative text-left border-b border-r border-line/70 min-h-[64px] sm:min-h-[104px] p-1.5 sm:p-2 transition-[box-shadow,transform] hover:z-10 hover:shadow-[inset_0_0_0_2px_var(--gold)] ${
                inMonth ? "" : "opacity-45"
              } ${selected ? "z-10 shadow-[inset_0_0_0_2px_var(--pomegranate)]" : ""}`}
              style={{ background: `var(--heat-${level})` }}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={`text-xs sm:text-sm tabular-nums ${
                    d === today ? "rounded-full bg-pomegranate text-white px-1.5 font-semibold" : "font-medium"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                {list.length > 0 && (
                  <span className="text-[10px] sm:text-xs text-ink-soft tabular-nums">{list.length}</span>
                )}
              </div>
              {holiday && (
                <div className="mt-0.5 truncate text-[10px] sm:text-xs font-semibold text-[color:var(--c-holiday)]">
                  {holiday.title}
                </div>
              )}
              {closures > 0 && (
                <div className="mt-0.5 truncate text-[10px] sm:text-xs text-[color:var(--c-public-school)]">
                  <span className="sm:hidden">🏫 {closures}</span>
                  <span className="hidden sm:inline">🏫 {closures} school{closures > 1 ? "s" : ""} off/early</span>
                </div>
              )}
              <div className="mt-1 hidden sm:flex flex-col gap-0.5">
                {others.slice(0, 2).map((e) => (
                  <span key={e.id} className="flex items-center gap-1 text-[11px] leading-tight text-ink/85">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--c-${categoryOf(e)})` }} />
                    <span className="truncate">{e.title}</span>
                  </span>
                ))}
                {others.length > 2 && <span className="text-[11px] text-ink-soft">+{others.length - 2} more</span>}
              </div>
              <div className="mt-1 flex sm:hidden flex-wrap gap-0.5">
                {others.slice(0, 6).map((e) => (
                  <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--c-${categoryOf(e)})` }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="h-8 w-8 rounded-full border border-line text-lg leading-none hover:bg-paper-2"
    >
      {children}
    </button>
  );
}
