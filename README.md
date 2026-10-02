# Job Finder — Control Center

A location-aware job search control center: one dashboard that fans your query out to
**six live job boards in parallel**, keeps every result scoped to the location you typed,
ranks postings against your personal fit profile, and exports tracker-ready CSVs.

> Fixes the classic aggregator problem: search **“Lahore, Pakistan”** and you get
> **Lahore, Punjab, Pakistan** results — not unrelated listings from other countries.

## How the location routing works

1. **Parse** — the location string is resolved to city + ISO-3166 country code
   (handles aliases/demonyms like *UK*, *UAE*, and ~200 major cities, so even
   a bare “Lahore” resolves to `PK`).
2. **Route** — each board is only used when it can honor the scope:
   - Denmark-only boards (Jobindex, Jobnet, Akademikernes Jobbank, Jobdanmark) are
     **skipped with an honest reason** for any non-Danish location.
   - **LinkedIn** geocodes the full location string.
   - **Freehire** is scoped with `--country <ISO2>`.
   - Searching **Remote** keeps the global boards and skips the Danish ones.
   - Explicitly picking a skipped board still works — with a clear warning.
3. **Guard** — as defense-in-depth, any result whose posting location clearly names a
   *different* country/major city is dropped and counted (the UI shows
   `−N off-location` badges), so leaked listings never reach you.

## Features

- **Live parallel search** across 6 portal CLIs (LinkedIn, Freehire + 4 Danish boards)
- **Location routing panel** showing resolved country, skipped boards and reasons
- **Fit ranking** — add skills + deal-breakers, get 0–100 scores with fit-band badges
- **Shortlist tracker** — star postings, move them through stages, export tracker CSV
- **Deadline window filter** (≤7/14/30 days or custom range, persisted per search)
- **Command palette** (⌘K) with recent searches, salary lookups and bare-query fallback
- **CSV / Markdown exports** including stage history and fit legend
- **Environment console** — toolkit status, test suites, LaTeX toolchain, salary data

## Stack

- **Next.js 16 (App Router) + TypeScript** UI, API routes proxy to the CLI toolkit
- **ai-job-search** toolkit (vendored under `ai-job-search/`) — Bun + Python CLIs
- **Tailwind CSS 4 + shadcn/ui** components, light/dark themes
- **Prisma** (SQLite) for persistence hooks

## Run it

```bash
bun install
# one-time: install the 6 portal CLIs
cd ai-job-search && for d in .agents/skills/*/cli; do (cd "$d" && bun install); done
cd ..
bun run dev
```

Open the app, type a query, pick a location chip (or type any city + country) and search.

## Layout

```
src/app/            Next.js app (UI + API routes)
src/components/     job-search console components (shadcn/ui based)
src/lib/job-search/ portal registry, location routing, fit ranker, exports
ai-job-search/      vendored CLI toolkit (6 portals, tests, tools)
prisma/             database schema
```

## Notes

- The Danish boards only list Danish jobs — that is why the router skips them for
  foreign locations instead of showing you wrong-country results.
- LinkedIn is personal-use only (LinkedIn ToS): keep volume low.
- jobbank.dk may respond with a Cloudflare bot-block error from datacenter IPs;
  the CLI reports it honestly and the other boards keep working.
