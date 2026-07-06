/**
 * Schema-check every `guide` field in public/solutions.json against
 * lib/guideSchema.js (docs/guided-coach-plan.md, Q4).
 *
 * Run:
 *   npm run validate-guide          report only; exit 1 if anything is invalid
 *
 * Same role validate-viz plays for `viz`: gates hand edits now, LLM backfills
 * later (v2 gen-solutions emission must pass this before ingest).
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateGuide } from '../lib/guideSchema.js';

const FILE = path.join(process.cwd(), 'public', 'solutions.json');
const solutions = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let total = 0;
let ok = 0;
const bad = [];

for (const [slug, entry] of Object.entries(solutions)) {
  if (slug === '_note' || !entry || typeof entry !== 'object' || !entry.guide) continue;
  total++;
  const r = validateGuide(entry.guide);
  if (r.ok) ok++;
  else bad.push({ slug, errors: r.errors });
}

console.log(`guide fields: ${total} · valid: ${ok} · invalid: ${bad.length}`);
for (const b of bad) {
  for (const e of b.errors) console.log(`  ✗ ${b.slug}: ${e}`);
}

if (bad.length) process.exit(1);
