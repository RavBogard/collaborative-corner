# Collaborative Corner — Design Spec

**Date:** 2026-10-08 · **Status:** Approved by Daniel (in-chat, 2026-10-08)

## Purpose
A free, public website where Atlanta Jewish professionals check calendar overlaps and
conflicts across the community before scheduling: major Jewish organizations, synagogues,
Jewish day schools, Jewish holidays, and metro-Atlanta public school calendars.
Success = a planner can pick a date (or browse a month) and immediately see everything
competing for that date, without anyone maintaining the data by hand.

## Decisions (from Daniel)
| Topic | Decision |
|---|---|
| Core job | Both: browsable unified calendar AND date/range conflict checker |
| Extra feature | Conflict "heat" view — days colored by how busy they are |
| Districts | All metro: APS, Fulton, DeKalb, City Schools of Decatur, Cobb, Gwinnett, Marietta City |
| Org types | Institutions, synagogues, day schools, Jewish holidays |
| Audience | Open public website, no login |
| Collection | Fully automatic: ICS feeds + AI extraction (Claude via Vercel AI Gateway) for web pages/PDFs |
| Event scope | Everything, filterable (importance tag: major / regular) |
| Refresh | ~~Weekly cron~~ → **manual** `npm run collect` (Daniel, 2026-10-08: "don't stress the auto update stuff") |
| Review | Auto-publish; low-confidence events get a "verify" badge linking to source |
| Hosting | Vercel, free `*.vercel.app` subdomain |
| Existing sheet | "Collaborative Corner" Google Sheet is both a seed and a live source |
| Sheet contacts | Hide names/emails; show org only |
| Sheet extras | Featured guest + "open to collaboration" shown as tags on events |
| Name | Collaborative Corner |
| Design | Warm community brand |
| Horizon | Current school year + next (through summer 2028) |
| AI cost | ~$1–5/mo on AI Gateway approved; running on free-tier Gemini until credits are added |

## Architecture
```
sources.ts (registry) ──► weekly Vercel Cron ──► collectors ──► normalize ──► Vercel Blob (events.json)
   ical | sheet | webpage | pdf | hebcal          per-source, isolated failures          │
                                                                                       ▼
                                                            Next.js site (ISR reads Blob)
```

### Units
- **Source registry** (`src/lib/sources.ts`): typed list of sources `{id, name, category, area, fetch[]}`.
- **Collectors** (`src/lib/collect/*`): one per fetch type, each `(source, window) => RawEvent[]`.
  - `ical` — parse ICS, expand recurrences within the horizon.
  - `sheet` — Google Sheet public CSV export; parse free-text dates with AI fallback.
  - `webpage` / `pdf` — fetch, reduce to text, Claude `generateObject` with a Zod schema returning
    events + confidence + importance.
  - `hebcal` — Hebcal REST API for holidays (major, minor, fasts, Rosh Chodesh).
- **Normalizer**: canonical `Event {id, sourceId, title, start, end, allDay, location, url,
  category, importance, confidence, tags{featuredGuest?, collaboration?}}`; dedupe by source+title+date.
- **Store** (`src/lib/store.ts`): reads/writes `events.json` + `status.json` (per-source last
  success, count, error) in Vercel Blob. A failing source keeps its previous events (marked stale).
- **Cron route** (`/api/cron/collect`): runs collectors with bounded concurrency; protected by
  `CRON_SECRET`. Weekly schedule.
- **UI**: month calendar with heat coloring, day/range conflict panel, filters
  (category, area/district, importance, show low-confidence), sources & freshness page.

## Privacy
Contact names and emails from the sheet are never stored in `events.json`.

## Error handling
Per-source try/catch; errors recorded in `status.json` and visible on the Sources page.
AI output validated with Zod; invalid events dropped. Events outside the horizon dropped.

## Testing
Unit tests (Vitest) for ICS parsing, sheet date parsing, normalization/dedupe, heat scoring,
and conflict lookup. Live smoke run of the collector against real sources before deploy.

## Out of scope (v1)
Accounts, event submission form, subscribe-able feeds, email alerts, custom domain.
