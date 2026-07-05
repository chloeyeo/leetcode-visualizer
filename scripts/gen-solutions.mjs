/**
 * Backfill public/solutions.json with AI-generated, ORIGINAL problem summaries
 * (goal / constraints / examples) + a runnable Python blueprint for each problem.
 *
 * Uses Google's free Gemini API. Wording is generated fresh (never copied from
 * LeetCode), so it's legally safe — algorithmic concepts aren't copyrightable.
 *
 * Efficiency: it asks for MANY problems per request (BATCH) and can ROTATE across
 * several models (each free model has its own quota), so you cover far more per day.
 *
 * Run:
 *   set GEMINI_API_KEY=AIza...        (Windows)   /   export GEMINI_API_KEY=...  (mac/linux)
 *   set MODELS=gemini-2.5-flash-lite,gemini-2.0-flash-lite,gemini-2.5-flash
 *   set LIMIT=3973
 *   npm run gen-solutions
 *
 * Env vars:
 *   GEMINI_API_KEY  (required)  free key from aistudio.google.com
 *   LIMIT   (default 400)  how many NEW problems to generate this run
 *   BATCH   (default 8)    problems requested per API call (fewer calls = more/quota)
 *   MODELS  (default gemini-2.5-flash-lite) comma-separated models to rotate through
 *   MODEL   (fallback if MODELS unset)
 *   DELAY_MS (default 4500) pause between calls (free tier ≈ 15 req/min)
 *   FORCE   (default 0) set 1 to regenerate entries that already exist
 *   ONLY    comma-separated slugs to (re)generate just those
 *
 * Saves after every batch, so it's safe to Ctrl+C and re-run — it skips slugs
 * already present unless FORCE=1. Run it again the next day to keep going.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateViz, vizPromptSpec } from '../lib/vizSchemas.js';

const ROOT = process.cwd();
const PROBLEMS = path.join(ROOT, 'public', 'problems.json');
const OUT = path.join(ROOT, 'public', 'solutions.json');

const KEY = process.env.GEMINI_API_KEY;
const MODELS = (process.env.MODELS || process.env.MODEL || 'gemini-2.5-flash-lite')
  .split(',').map((s) => s.trim()).filter(Boolean);
const LIMIT = Number(process.env.LIMIT || 400);
const BATCH = Math.max(1, Number(process.env.BATCH || 8));
const DELAY_MS = Number(process.env.DELAY_MS || 4500);
const FORCE = process.env.FORCE === '1';
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!KEY) {
  console.error('Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/app/apikey');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };

const problems = readJson(PROBLEMS, []);
const solutions = readJson(OUT, {});

function prompt(chunk) {
  const list = chunk.map((p) => `- ${p.slug} | ${p.title} (#${p.id}) | tags: ${(p.tags || []).join(', ') || 'none'}`).join('\n');
  return `You are writing study material for a coding-interview app. For EACH LeetCode problem below, rewrite it in your OWN original words (do NOT copy LeetCode's phrasing). Keep the meaning, constraints, and a worked example accurate.

Return ONLY a minified JSON object (no markdown, no backticks) whose keys are the EXACT slugs given, and whose values are objects with keys:
- "goal": 1-2 sentences: what to compute and return.
- "constraints": one line of the key constraints, using " · " as a separator.
- "examples": one or two short worked examples as a single string.
- "starterCode": runnable Python — a function with a clear signature, a "# Your code here" body with pass, then a sample call wrapped in print() with an "# expected: ..." comment. Use \\n for newlines.
- "viz" (OPTIONAL — include only when you are confident): {"key": <kind>, "input": <shape>} describing THIS problem's own primary example input so our site can animate it. The input values MUST be the same sample you used in "examples". "key" must be one of the kinds below and "input" must match that kind's shape exactly — the listed sizes are hard limits. Only emit "viz" when the problem's core technique IS what that visualizer shows (e.g. don't give a "brackets" viz to a problem that merely contains strings); when unsure, OMIT the field entirely.
Allowed "viz" kinds and input shapes:
${vizPromptSpec()}

Problems:
${list}`;
}

let callCount = 0;
async function callModel(text, attempt = 0) {
  const model = MODELS[(callCount + attempt) % MODELS.length];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const body = { contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if ((res.status === 429 || res.status === 503) && attempt < MODELS.length + 2) {
    const wait = 15000 * (attempt + 1);
    process.stdout.write(`[${model} ${res.status}; retry in ${wait / 1000}s] `);
    await sleep(wait);
    return callModel(text, attempt + 1);
  }
  callCount += 1;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`);
  return res.json();
}

async function generateBatch(chunk) {
  const data = await callModel(prompt(chunk));
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const obj = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  const out = {};
  for (const p of chunk) {
    const e = obj[p.slug];
    if (e && e.goal && e.starterCode) {
      out[p.slug] = { draft: true, generated: true, goal: e.goal, constraints: e.constraints || '', examples: e.examples || '', starterCode: e.starterCode };
      if (e.viz) {
        const r = validateViz(e.viz);
        if (r.ok) out[p.slug].viz = r.viz;
        else process.stdout.write(`[viz rejected ${p.slug}: ${r.errors.join('; ')}] `);
      }
    }
  }
  return out;
}

const targets = (ONLY.length ? problems.filter((p) => ONLY.includes(p.slug)) : problems)
  .filter((p) => p.slug && (FORCE || ONLY.length || !solutions[p.slug]));

const have = () => Object.keys(solutions).filter((k) => k !== '_note').length;
console.log(`Catalog: ${problems.length} · have: ${have()} · to do: ${targets.length} · this run: up to ${LIMIT} (batch ${BATCH}, models: ${MODELS.join(', ')})`);

let done = 0;
let failed = 0;
let failStreak = 0;
const MAX_FAIL_STREAK = Number(process.env.MAX_FAIL_STREAK || 4);
for (let start = 0; start < targets.length && done < LIMIT; start += BATCH) {
  const chunk = targets.slice(start, start + BATCH);
  process.stdout.write(`[${done}/${LIMIT}] ${chunk.length} problems (${chunk[0].slug}…) `);
  try {
    const res = await generateBatch(chunk);
    let n = 0;
    for (const slug of Object.keys(res)) {
      const prev = solutions[slug];
      if (prev && !prev.generated && !FORCE) continue; // never clobber hand-authored
      solutions[slug] = { ...prev, ...res[slug] };
      // hand-authored viz survives even a FORCE regeneration of the prose
      if (prev?.viz && !prev.generated) solutions[slug].viz = prev.viz;
      n += 1;
    }
    fs.writeFileSync(OUT, JSON.stringify(solutions, null, 2) + '\n');
    console.log(`ok (+${n})`);
    done += n;
    failStreak = 0;
  } catch (e) {
    failed += 1;
    failStreak += 1;
    console.log(`FAILED — ${e.message}`);
    if (failStreak >= MAX_FAIL_STREAK) {
      console.log(`\n${failStreak} consecutive batch failures — daily quota is almost certainly exhausted. Stopping; re-run after quota reset to resume.`);
      break;
    }
  }
  await sleep(DELAY_MS);
}

console.log(`\nDone. Added ${done} this run (${failed} batches failed). solutions.json now has ${have()} problems of ${problems.length}.`);
