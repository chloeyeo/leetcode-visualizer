# Phase plan: problem-specific visualizers for all 3,973 problems

## Where we are

| Layer | Status | Coverage |
|---|---|---|
| L1 — Every problem has a pattern visualizer | ✅ shipped | 100% (12 patterns; `pickPattern` falls back to Linear Scan) |
| L2 — Visualizer replays the problem's own sample input | ✅ shipped | grows automatically with solutions.json — parses examples text AND the starter sample call; flat arrays, strings, trees, grids, intervals, words, DP dims |
| L3 — Structured inputs emitted by the generator | ✅ tooling shipped | `viz {key, input}` prompt + ingest validation live; backfill rides the daily scheduled `gen-solutions` runs |

Resolution order on the problem page (`resolveViz` in `lib/vizInput.js`):
**explicit `viz` (if schema-valid) → derived from the entry's own example →
tag-generic demo (Linear Scan catch-all guarantees one).**

## Input contracts (single source of truth: `lib/vizSchemas.js`)

Every visualizer component accepts an optional `input` prop. Omitted ⇒ the
generic demo, pixel-identical to before this phase. All shapes are enforced by
`validateViz()`; size caps exist so LLM-emitted inputs can't break layouts.

| key | mode | input shape (caps) |
| --- | --- | --- |
| `two-pointers` | `two-pointers` | `{array: num[2..16] sorted, target: num}` |
| | `window` | `{array: num[2..16], k: int 1..len}` |
| | `palindrome` | `{string: 1..48 chars}` |
| `binary-search` | — | `{array: num[2..16] non-decreasing, target: num, targets?: num[1..6]}` |
| `hash-map` | — | `{array: num[2..12], target: num}` |
| `scan` | — | `{array: num[2..14], each \|n\| < 100000}` |
| `stack` | `brackets` | `{string: 1..24 chars, at least one of ()[]{}}` |
| | `monotonic` | `{array: num[2..12]}` — next-greater-element walk |
| | `intervals` | `{intervals: [lo,hi][2..8], lo ≤ hi}` — sort + merge via output stack |
| `linked-list` | *(default)* | `{values: num[1..10]}` — in-place reversal |
| | `merge` | `{listA: num[0..8] sorted, listB: num[0..8] sorted, not both empty}` |
| `graph` | `islands` | `{grid: ('0'\|'1')[1..8][1..12]}` (numbers 0/1 normalized) |
| `tree-traversal` | `traverse` | `{tree: (num\|null)[1..15] level-order, root non-null, order?: preorder\|inorder\|postorder\|level}` |
| | `invert` | `{tree: same as above}` |
| `dp-grid` | `unique-paths` | `{rows: int 2..8, cols: int 2..10}` |
| | `min-path-sum` | `{grid: num[2..6][2..8], non-negative}` |
| `heap` | — | `{inserts: num[2..15]}` — min-heap build |
| `backtracking` | — | `{elems: (num \| ≤3-char str)[1..4]}` — subsets decision tree |
| `trie` | — | `{words: /^[a-z]{1,8}$/[2..6], ≤30 letters total}` |

## Deterministic derivation rules (`lib/vizInput.js`)

Parse the **first example** (from `sol.examples`, falling back to the sample
call in `sol.starterCode`) into typed values: flat numeric arrays, `[lo,hi]`
pair arrays, binary grids, numeric grids, level-order arrays (with nulls),
string arrays, quoted strings, and named scalars (`target`, `k`, `m`, `n`).
Then map by the problem's matched pattern key. **When in doubt, emit nothing**
— a wrong "this problem's own input" animation is worse than the generic demo.
Guards that keep it honest:

- `two-pointers` + string ⇒ palindrome mode **only if** it's a whole-string
  palindrome check (title mentions palindrome, not longest/substring/count).
- pointer/binary-search array modes require the array to actually be sorted,
  and the pair walk requires a "two values summing to target" problem.
- `stack` + string ⇒ brackets mode only if the string is entirely brackets;
  monotonic mode only for next-greater/warmer problems.
- interval problems (title contains "interval" + pair array) ⇒ `stack/intervals`
  even though their tags (Array, Sorting) match no specific pattern;
  insert-interval folds the inserted pair into the set.
- trees require unambiguous input naming (`root = [...]` / "For root [...]"),
  or level-order nulls inside an explicit `Input:` segment or starter call —
  this keeps sorted-array inputs and preorder/inorder construction pairs out.
- `linked-list` reversal requires a reversal **title** (goals like
  add-two-numbers' "stored in reverse order" don't count).
- `backtracking` ⇒ only subset-style problems. `dp-grid` ⇒ only real
  top-left → bottom-right walks (min-path-sum, unique-paths).
- `trie` ⇒ array-of-words filtered to real words (command vocab like
  `insert`/`search` is dropped), ≥2 words required.

## Generator + validation + reporting

- `scripts/gen-solutions.mjs` — prompt asks for an **optional** `viz` field per
  problem, embedding the schema table above (from `vizPromptSpec()`); invalid
  emissions are dropped at ingest with a log line. Hand-authored `viz` fields
  are never clobbered. The daily scheduled backfill task picks this up
  automatically — no manual runs needed.
- `scripts/validate-viz.mjs` (`npm run validate-viz`) — schema-checks every
  `viz` in `public/solutions.json`; `--fix` strips invalid / normalizes legacy
  shapes; exits non-zero on failures so it can gate CI/backfills.
- `scripts/viz-coverage.mjs` (`npm run viz-coverage`) — per-layer coverage
  report over the full catalog: L3/L2/L1 counts, per-pattern-key table, and
  how many problems only reach the Linear Scan catch-all.

## Definition of done

1. ✅ Every component in `components/*Viz.jsx` documents + validates an `input`
   contract (previously missing: tree-traversal, dp-grid, heap, backtracking,
   trie, stack/monotonic, stack/intervals).
2. ✅ `npm run validate-viz` passes on `public/solutions.json`.
3. ✅ `npm run build` (static export of all 3,973 problem pages) passes.
4. ✅ Headless sweep of random problem pages: no console errors; explicit-viz,
   derived-viz, generic and catch-all pages all render a visualizer.
5. ⏳ ≥80% of non-Database problems with a problem-specific input — reached by
   letting the daily backfill re-run with the extended prompt (`FORCE=0`;
   entries that predate the viz field can be refreshed with
   `ONLY=<slugs> FORCE=1` batches once quota allows).

## Out of scope (cut)

New visualizer layouts beyond the intervals mode (e.g. k-way merge, union-find
forests, char-frequency windows), editing generated summaries, multi-example
replay (first example only).
