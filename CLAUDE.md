@AGENTS.md

# Collaborative Corner

Public conflict calendar for Atlanta Jewish professionals. Next.js 16 (Cache Components) on Vercel;
data is a single JSON dataset in private Vercel Blob (`dataset/events.json`).

## "Refresh the data"
Data refresh is manual by design (Daniel, 2026-10-08: no automated refresh for now).
1. `vercel env pull .env.local --yes` if `.env.local` is missing.
2. `npm run collect` (all sources, ~15–25 min on the free AI tier) or
   `npm run collect -- $(npx tsx --env-file=.env.local scripts/failed-ids.mts)` to retry problem sources.
3. Report the ✓/~/✗ summary. The site picks up new data within an hour (`cacheLife("hours")`).

## Rules
- All dates/times are America/New_York. Events store local `startDate`/`startTime` strings; the UI never converts timezones.
- Never store or display contact names/emails from the Collaborative Corner sheet.
- A failing source must keep its previous events (see `collectAll`).
- Sources live in `data/sources.json`. `data/sources.research.json` is the original research notes.
