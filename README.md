# LeetCode Visualizer

A free, static web app that lets you browse **every LeetCode problem**, search and filter
the catalog, and open each problem with a one-click link to LeetCode plus a YouTube video
hint (shown as a clickable thumbnail card). No backend, no database, no paid services.

This is the **MVP** (full catalog + video cards). Interactive pattern visualizers are a
planned later phase — each problem page already has a placeholder slot for them.

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

- **Phase 1 (this MVP):** full catalog browse + per-problem video card with safe fallback.
- **Phase 2:** real curated video IDs for the popular ~500 problems.
- **Phase 3:** interactive **pattern visualizers** (~12 families: two-pointer, sliding
  window, binary search, BST/graph traversal, DP grid, backtracking, etc.), shown in the
  placeholder slot on each problem page based on its primary tag.
- **Phase 4 (optional):** in-browser code playground, progress tracking.

---

*Independent study tool. Not affiliated with or endorsed by LeetCode. Problem text and
trademarks belong to LeetCode; this app only links to it.*
