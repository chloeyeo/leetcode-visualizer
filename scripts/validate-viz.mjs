/**
 * Schema-check every `viz` field in public/solutions.json against
 * lib/vizSchemas.js.
 *
 * Run:
 *   npm run validate-viz          report only; exit 1 if anything is invalid
 *   npm run validate-viz -- --fix strip invalid viz fields and write the file
 *
 * Meant to gate backfills (gen-solutions already filters on ingest, but this
 * catches hand edits and older data) and to normalize legacy shapes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateViz } from '../lib/vizSchemas.js';

const FILE = path.join(process.cwd(), 'public', 'solutions.json');
const FIX = process.argv.includes('--fix');

const solutions = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let total = 0;
let ok = 0;
let normalized = 0;
const bad = [];

for (const [slug, entry] of Object.entries(solutions)) {
  if (slug === '_note' || !entry || typeof entry !== 'object' || !entry.viz) continue;
  total++;
  const r = validateViz(entry.viz);
  if (r.ok) {
    ok++;
    if (JSON.stringify(r.viz) !== JSON.stringify(entry.viz)) {
      normalized++;
      if (FIX) entry.viz = r.viz;
    }
  } else {
    bad.push({ slug, errors: r.errors });
    if (FIX) delete entry.viz;
  }
}

console.log(`viz fields: ${total} · valid: ${ok} · invalid: ${bad.length}${normalized ? ` · normalizable: ${normalized}` : ''}`);
for (const b of bad) {
  console.log(`  ✗ ${b.slug}: ${b.errors.join('; ')}`);
}

if (FIX && (bad.length || normalized)) {
  fs.writeFileSync(FILE, JSON.stringify(solutions, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), FILE)} — stripped ${bad.length}, normalized ${normalized}.`);
}

if (!FIX && bad.length) process.exit(1);
