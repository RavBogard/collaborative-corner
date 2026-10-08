# Collaborative Corner

A community calendar for Atlanta Jewish professionals: check a date against major Jewish
organizations, synagogues, Jewish day schools, metro public school calendars, Jewish holidays,
and the community "Collaborative Corner" Google Sheet, all in one place. All times are Eastern (Atlanta).

## Refreshing the data (manual)

Data is gathered by a script on your computer and saved to the site's storage (Vercel Blob).
The live site picks it up within an hour. No redeploy needed.

```bash
npm run collect
```

- Takes ~15–25 minutes on the free AI tier (it's throttled to 5 AI requests/minute).
- Prints a line per source: `✓` ok, `~` partial, `✗` failed (that source keeps its previous events).
- Retry only the problem sources:

```bash
npm run collect -- $(npx tsx --env-file=.env.local scripts/failed-ids.mts)
```

- Or specific ones: `npm run collect -- the-temple,weber-school`

Or just ask Claude Code: *"refresh the Collaborative Corner calendar data."*

First-time setup on a new machine: `npm install`, `vercel link`, `vercel env pull .env.local`.

## Adding or fixing a source

Edit [`data/sources.json`](data/sources.json). Each source has a `category` and an ordered list of
`fetch` specs:

| type | what it reads |
|---|---|
| `ical` | an iCal/ICS feed (best) |
| `shulcloud` | ShulCloud calendar CSV export (most Atlanta synagogues) |
| `tribe` | WordPress "The Events Calendar" REST API |
| `squarespace` | Squarespace events `?format=json` |
| `pdf` | a PDF calendar, read by AI (school district calendars) |
| `webpage` | an events web page, read by AI; used only if nothing above worked |

All structured specs are combined (e.g. a district's 2026-27 *and* 2027-28 PDFs). Then run
`npm run collect -- <source-id>` and commit.

## AI models

`.env` sets the models. The Vercel AI Gateway free tier only allows Gemini at 5 requests/minute.
After adding AI Gateway credits, switch to Claude (better at reading school PDFs) and delete `AI_RPM`.

## Develop

```bash
npm run dev      # http://localhost:3000 (reads the same Blob data)
npm test
```

Pushing to `main` on GitHub deploys to Vercel automatically.
