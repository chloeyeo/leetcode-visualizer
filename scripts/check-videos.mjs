#!/usr/bin/env node
/**
 * Health-check the mapped YouTube videos via the free oEmbed endpoint
 * (no API key, no quota). Sets { ok: true|false } on each entry so the site
 * can fall back to a search link when a video has been deleted/made private.
 *
 *   npm run check-videos              # check everything
 *   CHECK_LIMIT=200 npm run check-videos   # rotate through a slice (CI cron)
 *
 * Rotation: pass CHECK_LIMIT to only verify the N least-recently-checked
 * entries; the rest are left untouched. Cheap to run daily.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'public', 'videos.json');
const LIMIT = process.env.CHECK_LIMIT ? Number(process.env.CHECK_LIMIT) : Infinity;
const CONCURRENCY = 6;

async function checkId(id) {
  const url =
    'https://www.youtube.com/oembed?format=json&url=' +
    encodeURIComponent(`https://youtu.be/${id}`);
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, title: data.title };
    }
    // 401/404 => removed, private, or embedding disabled
    return { ok: false };
  } catch {
    return { ok: null }; // network error: leave unchanged
  }
}

async function main() {
  const map = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let entries = Object.entries(map).filter(([, v]) => v && v.id);

  // Rotate: oldest checkedAt first
  entries.sort(
    (a, b) => (a[1].checkedAt || 0) - (b[1].checkedAt || 0)
  );
  if (Number.isFinite(LIMIT)) entries = entries.slice(0, LIMIT);

  console.log(`Checking ${entries.length} video(s)…`);
  let okCount = 0;
  let deadCount = 0;
  const now = Date.now();

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([slug, v]) => {
        const r = await checkId(v.id);
        if (r.ok === null) return; // skip on transient error
        v.ok = r.ok;
        v.checkedAt = now;
        if (r.ok && r.title) v.title = r.title;
        if (r.ok) okCount++;
        else deadCount++;
      })
    );
  }

  fs.writeFileSync(FILE, JSON.stringify(map, null, 2));
  console.log(`Done. ok=${okCount} dead=${deadCount}`);
  if (deadCount > 0) console.log('Dead videos will fall back to a YouTube search link.');
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
