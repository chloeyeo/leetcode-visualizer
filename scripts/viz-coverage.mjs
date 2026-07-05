/**
 * Visualizer coverage report across the whole catalog.
 *
 * Levels (best wins):
 *   L3  explicit schema-valid `viz` in solutions.json (hand-authored or generated)
 *   L2  derived — lib/vizInput.js can replay the problem's own sample input
 *   L1  generic — tags match a pattern, so the generic demo shows
 *   L0  nothing — the placeholder renders
 *
 * Run: npm run viz-coverage
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATTERNS, pickPattern } from '../lib/patterns.js';
import { validateViz } from '../lib/vizSchemas.js';
import { deriveViz } from '../lib/vizInput.js';

const ROOT = process.cwd();
const problems = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'problems.json'), 'utf8'));
const solutions = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'solutions.json'), 'utf8'));

// pickPattern falls back to Linear Scan, so every problem lands at L1+. L0
// here means "reached the demo only through that catch-all" (tags matched
// nothing, e.g. Database/Shell) — the honest bottom of the coverage ladder.
const scanTags = new Set(PATTERNS.find((p) => p.key === 'scan').tags);
const counts = { L3: 0, L2: 0, L1: 0, L0: 0 };
const perKey = {};
const l0Tags = {};
let withSolutions = 0;
const solCounts = { L3: 0, L2: 0, L1: 0, L0: 0 };

for (const p of problems) {
  const sol = solutions[p.slug];
  let level = 'L0';
  let key = null;

  const explicit = sol?.viz && validateViz(sol.viz);
  if (explicit?.ok) {
    level = 'L3';
    key = explicit.viz.key;
  } else {
    const derived = sol ? deriveViz(p, sol) : null;
    if (derived) {
      level = 'L2';
      key = derived.key;
    } else {
      const pat = pickPattern(p.tags || []);
      key = pat.key;
      const viaFallback = pat.key === 'scan' && !(p.tags || []).some((t) => scanTags.has(t));
      level = viaFallback ? 'L0' : 'L1';
    }
  }

  counts[level]++;
  if (sol) {
    withSolutions++;
    solCounts[level]++;
  }
  perKey[key] = perKey[key] || { L3: 0, L2: 0, L1: 0, L0: 0 };
  perKey[key][level]++;
  if (level === 'L0') {
    for (const t of p.tags || []) l0Tags[t] = (l0Tags[t] || 0) + 1;
  }
}

const pct = (n, d) => ((100 * n) / d).toFixed(1).padStart(5) + '%';
const T = problems.length;

console.log(`Catalog: ${T} problems (${withSolutions} with a solutions.json entry)\n`);
console.log('Level  What the user sees                        All catalog      With solution');
console.log(`  L3   explicit viz (own input, curated/LLM)   ${String(counts.L3).padStart(5)} ${pct(counts.L3, T)}   ${String(solCounts.L3).padStart(5)} ${pct(solCounts.L3, withSolutions)}`);
console.log(`  L2   derived viz (own input, parsed)         ${String(counts.L2).padStart(5)} ${pct(counts.L2, T)}   ${String(solCounts.L2).padStart(5)} ${pct(solCounts.L2, withSolutions)}`);
console.log(`  L1   generic pattern demo (tag match)        ${String(counts.L1).padStart(5)} ${pct(counts.L1, T)}   ${String(solCounts.L1).padStart(5)} ${pct(solCounts.L1, withSolutions)}`);
console.log(`  L0   Linear Scan catch-all only (no tag)     ${String(counts.L0).padStart(5)} ${pct(counts.L0, T)}   ${String(solCounts.L0).padStart(5)} ${pct(solCounts.L0, withSolutions)}`);

console.log('\nPer pattern key (L3 explicit / L2 derived / L1 generic):');
for (const [key, c] of Object.entries(perKey).sort((a, b) => (b[1].L3 + b[1].L2) - (a[1].L3 + a[1].L2))) {
  console.log(`  ${key.padEnd(16)} ${String(c.L3).padStart(4)} / ${String(c.L2).padStart(4)} / ${String(c.L1 + c.L0).padStart(5)}`);
}

const topL0 = Object.entries(l0Tags).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('\nBiggest catch-all-only (L0) tag groups:');
for (const [tag, n] of topL0) console.log(`  ${tag.padEnd(28)} ${n}`);
