/**
 * Backfill public/solutions.json with AI-generated, ORIGINAL problem summaries
 * (goal / constraints / examples) + a runnable Python blueprint for each problem.
 *
 * Uses Google's free Gemini API. The wording is generated fresh (never copied
 * from LeetCode), so it's legally safe — algorithmic concepts aren't copyrightable.
 *
 * Run:
 *   set GEMINI_API_KEY=AIza...        (Windows)   /   export GEMINI_API_KEY=...  (mac/linux)
 *   npm run gen-solutions
 *
 * Useful env vars:
 *   GEMINI_API_KEY  (required)  your free key from aistudio.google.com
 *   LIMIT           (default 40) how many NEW problems to generate this run
 *   MODEL           (default gemini-2.0-flash)
 *   DELAY_MS        (default 4500) pause between calls (free tier ≈ 15 req/min)
 *   FORCE           (default 0) set 1 to regenerate entries that already exist
 *   ONLY            comma-separated slugs to (re)generate just those
 *
 * It saves after every problem, so it's safe to stop (Ctrl+C) and re-run — it
 * skips slugs already present unless FORCE=1.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PROBLEMS = path.join(ROOT, 'public', 'problems.json');
const OUT = path.join(ROOT, 'public', 'solutions.json');

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL || 'gemini-2.0-flash';
const LIMIT = Number(process.env.LIMIT || 40);
const DELAY_MS = Number(process.env.DELAY_MS || 4500);
const FORCE = process.env.FORCE === '1';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!KEY) {
  console.error('Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/app/apikey');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const problems = readJson(PROBLEMS, []);
const solutions = readJson(OUT, {});

function prompt(p) {
  return `You are writing study material for a coding-interview app. Rewrite the LeetCode problem "${p.title}" (problem #${p.id}) entirely in your OWN original words — do NOT copy LeetCode's phrasing. Keep the meaning, constraints, and a worked example accurate.

Return ONLY a minified JSON object (no markdown, no backticks) with exactly these keys:
- "goal": 1-2 sentences stating what to compute and return.
- "constraints": a single line of the key constraints, using " · " as a separator.
- "examples": one or two short worked examples as a single string.
- "starterCode": runnable Python — a function with a clear signature, a "# Your code here" body with pass, then a sample call wrapped in print() with an "# expected: ..." comment. Use \\n for newlines.

Tags for context: ${(p.tags || []).join(', ') || 'none'}.`;
}

async function callModel(p, attempt = 0) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt(p) }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    const wait = 20000 * (attempt + 1);
    process.stdout.write(`rate-limited (${res.status}); waiting ${wait / 1000}s… `);
    await sleep(wait);
    return callModel(p, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

async function generate(p) {
  const data = await callModel(p);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(clean);
  if (!obj.goal || !obj.starterCode) throw new Error('missing fields in model output');
  return { draft: true, generated: true, goal: obj.goal, constraints: obj.constraints || '', examples: obj.examples || '', starterCode: obj.starterCode };
}

const targets = (ONLY.length ? problems.filter((p) => ONLY.includes(p.slug)) : problems)
  .filter((p) => p.slug && (FORCE || ONLY.length || !solutions[p.slug]));

console.log(`Catalog: ${problems.length} problems · already have: ${Object.keys(solutions).filter((k) => k !== '_note').length} · generating up to ${LIMIT} this run.`);

let done = 0;
let failed = 0;
for (const p of targets) {
  if (done >= LIMIT) break;
  process.stdout.write(`[${done + 1}/${Math.min(LIMIT, targets.length)}] ${p.slug} … `);
  try {
    const entry = await generate(p);
    // Don't clobber hand-tuned (non-generated) entries unless FORCE.
    if (solutions[p.slug] && !solutions[p.slug].generated && !FORCE) { console.log('skip (hand-authored)'); continue; }
    solutions[p.slug] = { ...solutions[p.slug], ...entry };
    fs.writeFileSync(OUT, JSON.stringify(solutions, null, 2) + '\n');
    console.log('ok');
    done += 1;
  } catch (e) {
    failed += 1;
    console.log(`FAILED — ${e.message}`);
  }
  await sleep(DELAY_MS);
}

console.log(`\nDone. Generated ${done}, failed ${failed}. solutions.json now has ${Object.keys(solutions).filter((k) => k !== '_note').length} problems.`);
