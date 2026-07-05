# LeetCode Visualizer

**Live:** [lc-visualizer.vercel.app](https://lc-visualizer.vercel.app) — pushes to `main` auto-deploy via the Vercel GitHub integration.

A free, static web app that lets you browse **every LeetCode problem**, search and filter
the catalog, and open each problem with a one-click link to LeetCode plus a YouTube video
hint (shown as a clickable thumbnail card). No backend, no database, no paid services.

Beyond the catalog, it now ships **interactive pattern visualizers** (~12 families), an
in-browser **Pyodide code playground** (trace + compare modes), and an **AI mock-interview
coach** with a swappable interviewer brain (free scripted stub, or bring-your-own-key
Gemini / Claude / OpenAI-compatible), live speech-to-text, and a graded scorecard — all
still a $0 static export. See [`docs/roadmap.md`](docs/roadmap.md) for what's next.

---

## How it works (the $0 architecture)

| Concern | Approach | Cost |
|---|---|---|
| Problem data | One-time script pulls the public LeetCode API into `public/problems.json` | Free |
| Problem text | **Not copied** — each page links out to leetcode.com | n/a (avoids ToS issues) |
| Video hint | Stored `slug → videoId` map; thumbnail from `img.youtube.com/vi/<id>/hqdefault.jpg` | Free, unlimited |
| Finding videos | Optional one-time YouTube API batch (or hand-pick / reuse public mappings) | Free tier |
| Dead-link safety | Daily GitHub Actions cron checks each video via YouTube **oEmbed** (no API key) | Free |
| Hosting | Static export → GitHub Pages / Cloudflare Pages / Vercel | Free |

If a video is missing or has been deleted, the page automatically falls back to a
YouTube **search link** for that problem, so nothing ever looks broken.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The repo ships with a ~77-problem demo dataset so it runs immediately.

### Load the full catalog (~3,500+ problems)

Run this locally, where `leetcode.com` is reachable (no login or key required):

```bash
npm run fetch-problems
```

This overwrites `public/problems.json` with the complete catalog (title, slug,
difficulty, tags, acceptance rate, premium flag).

### Build the static site

```bash
npm run build        # outputs the static site to ./out
```

Deploy the `out/` folder to any static host.

---

## Content coverage (all 3,973 problems)

Every problem page ships **runnable starter code**, in two layers:

1. **Original scaffold (100% coverage, zero cost).** `lib/starter.js` generates a Python
   blueprint from catalog facts only — title, slug, id, tags, difficulty — with a proper
   `snake_case` function name and a link-out to the statement. Nothing is copied from
   LeetCode, so there's no copyright exposure.
2. **AI-rewritten summaries + tailored blueprints (348 so far).** `scripts/gen-solutions.mjs`
   uses the free Gemini API to write goal/constraints/examples **in original words** plus a
   problem-specific starter signature. It's resume-safe and never overwrites hand-authored
   entries. Backfill the rest with:

   ```bash
   set GEMINI_API_KEY=AIza...            # free key from aistudio.google.com
   set MODELS=gemini-2.5-flash-lite,gemini-2.0-flash-lite,gemini-2.5-flash
   set LIMIT=3973
   npm run gen-solutions                 # re-run daily until coverage is full
   ```

Pages without a layer-2 entry fall back to layer 1 automatically — no dead ends.

**Hands-free mode:** the Windows scheduled task `lc-visualizer-backfill` runs
[`scripts/backfill-daily.ps1`](scripts/backfill-daily.ps1) every morning at 09:30 —
pull → generate until the day's quota is exhausted (the generator stops itself
after 4 consecutive failed batches) → commit → push → Vercel auto-deploys.
It reads `GEMINI_API_KEY` from the user environment. Remove with
`Unregister-ScheduledTask lc-visualizer-backfill`.

---

## Adding video hints

`public/videos.json` maps a problem slug to a YouTube video:

```json
{
  "two-sum": { "id": "KLlXCFG5TnA", "title": "Two Sum walkthrough", "ok": true }
}
```

Three free ways to populate it (mix and match):

1. **Reuse a public mapping** — e.g. NeetCode-style lists already pair popular problems
   with specific solution videos. Drop the IDs in.
2. **Batch the YouTube Data API once** — search `"<title> leetcode"`, store the top
   result's ID. `search.list` costs 100 units and the free tier is 10,000/day = 100
   searches/day, so spread a few hundred problems over a few days. You only do this once.
3. **Hand-pick** — paste the `v=...` part of any YouTube URL.

> The three demo IDs in `videos.json` are **examples** — verify or replace them. The daily
> health check (below) will flag any that don't resolve.

### Daily health check

`scripts/check-videos.mjs` verifies each mapped video still exists using YouTube's free
**oEmbed** endpoint (no API key, no quota) and sets `ok: true|false`. The site reads that
flag and falls back to a search link for dead videos.

```bash
npm run check-videos              # check all
CHECK_LIMIT=500 npm run check-videos   # rotate through 500 oldest (used by CI)
```

`.github/workflows/check-videos.yml` runs this every day at 06:00 UTC and commits any
status changes automatically. Enable it by pushing the repo to GitHub (no secrets needed).

---

## Deploying free

**Cloudflare Pages / Vercel / Netlify** — point at the repo, build command `npm run build`,
output dir `out`. Done.

**GitHub Pages (project site)** — set the base path so asset URLs resolve under
`/<repo-name>`:

```bash
NEXT_PUBLIC_BASE_PATH=/your-repo-name npm run build
```

Then publish `out/` (e.g. via a Pages action). `public/.nojekyll` is included so Pages
doesn't strip `_next/` assets. For a user/org site or a custom domain, leave
`NEXT_PUBLIC_BASE_PATH` unset.

---

## Project structure

```
app/
  layout.jsx                 # shell, header/footer
  page.jsx                   # index: search + difficulty/topic filters (client)
  problem/[slug]/page.jsx    # detail: LeetCode link + video card / fallback
  globals.css
lib/data.js                  # reads problems.json / videos.json at build time
public/
  problems.json              # the catalog (demo subset shipped; replace via script)
  videos.json                # slug -> { id, title, ok }
scripts/
  fetch-problems.mjs         # pull full catalog from LeetCode
  check-videos.mjs           # daily oEmbed health check
.github/workflows/
  check-videos.yml           # daily cron
```

---

## Roadmap

**Shipped:**

- ✅ Full catalog browse + per-problem video card with safe fallback.
- ✅ Interactive **pattern visualizers** (~12 families: two-pointer, sliding window, binary
  search, BST/graph traversal, DP grid, backtracking, etc.), chosen per problem by tag.
- ✅ In-browser **code playground** (Pyodide): trace a run line-by-line and compare two
  solutions side-by-side.
- ✅ **AI interview coach**: spoken mock interview, phase rail + checklist, swappable brain
  (free stub / BYOK Gemini / Claude / OpenAI-compatible), graded scorecard.

**Next** (full plan in [`docs/roadmap.md`](docs/roadmap.md)): curated videos for the top
problems, a hosted paid tier (server-held key + paywall), and growth loops. The free
scripted coach and BYOK Gemini free tier stay free.

---

*Independent study tool. Not affiliated with or endorsed by LeetCode. Problem text and
trademarks belong to LeetCode; this app only links to it.*
