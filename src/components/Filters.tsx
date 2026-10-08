"use client";

import { useState } from "react";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/sources";
import type { Category } from "@/lib/types";
import type { SourceMeta } from "./CalendarApp";

export interface FilterState {
  categories: Set<Category>;
  hiddenSources: Set<string>;
  majorOnly: boolean;
  showUnverified: boolean;
}

export function Filters({
  state,
  onChange,
  sources,
}: {
  state: FilterState;
  onChange: (s: FilterState) => void;
  sources: SourceMeta[];
}) {
  const [open, setOpen] = useState(false);
  const toggleCat = (c: Category) => {
    const next = new Set(state.categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...state, categories: next });
  };
  const toggleSource = (id: string) => {
    const next = new Set(state.hiddenSources);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...state, hiddenSources: next });
  };

  return (
    <div className="rounded-2xl border border-line bg-card/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_ORDER.map((c) => {
          const on = state.categories.has(c);
          return (
            <button
              key={c}
              onClick={() => toggleCat(c)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                on ? "border-transparent text-white" : "border-line text-ink-soft bg-transparent hover:bg-paper-2"
              }`}
              style={on ? { background: `var(--c-${c})` } : undefined}
            >
              {!on && <span className="h-2 w-2 rounded-full" style={{ background: `var(--c-${c})` }} />}
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Toggle
          checked={state.majorOnly}
          onChange={(v) => onChange({ ...state, majorOnly: v })}
          label="Major events only"
          hint="Hides weekly services, classes, and meetings"
        />
        <Toggle
          checked={state.showUnverified}
          onChange={(v) => onChange({ ...state, showUnverified: v })}
          label="Include unverified"
          hint="Events our reader wasn't sure about"
        />
        <button onClick={() => setOpen(!open)} className="ml-auto text-ink-soft underline-offset-2 hover:underline">
          {open ? "Hide" : "Choose"} individual sources
          {state.hiddenSources.size > 0 && ` (${state.hiddenSources.size} hidden)`}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 border-t border-line pt-3">
          {CATEGORY_ORDER.map((c) => {
            const list = sources.filter((s) => s.category === c);
            if (!list.length) return null;
            return (
              <fieldset key={c}>
                <legend className="text-xs font-semibold uppercase tracking-wider" style={{ color: `var(--c-${c})` }}>
                  {CATEGORY_LABEL[c]}
                </legend>
                <div className="mt-1 space-y-0.5">
                  {list.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!state.hiddenSources.has(s.id)}
                        onChange={() => toggleSource(s.id)}
                        className="accent-[var(--pomegranate)]"
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer" title={hint}>
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), onChange(!checked))}
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${checked ? "bg-pomegranate" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}
