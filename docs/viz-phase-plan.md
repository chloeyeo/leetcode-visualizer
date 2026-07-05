# Phase plan: problem-specific visualizers for all 3,973 problems

## Where we are (shipped 2026-07-05)

| Layer | Status | Coverage |
|---|---|---|
| L1 — Every problem has a pattern visualizer | ✅ shipped | 100% (12 patterns; `pickPattern` falls back to Linear Scan) |
| L2 — Visualizer replays the problem's own sample input | ✅ shipped (flat-array family) | ~96 problems today, grows automatically with solutions.json coverage (~11% of entries qualify) |
| L3 — Structured problem-specific inputs (trees, graphs, DP, strings, intervals) | 📋 this plan | 0 → target ~80% |

L2 works with zero AI cost: `lib/vizInput.js` parses the sample call in each
entry's starter blueprint (`print(two_sum([2, 7, 11, 15], 9))`) and feeds it to
the matched visualizer when the shape honestly fits the pattern's contract
(sorted where the technique narrates sorted, flat numeric arrays only, ≤14
cells). Everything else falls back to the generic demo rather than lying.

## L3 — the real phase (needs research + generator work)

**Goal:** for every problem, `solutions.json` carries a validated
`viz: { key, input }` so the visualizer steps through that problem's example
with the correct semantics — a tree problem animates ITS tree, an interval
problem sweeps ITS intervals.

### Per-pattern input schemas (contracts already in the components)

| Pattern | Input schema | Source |
|---|---|---|
| two-pointers | `{ mode, array, target }` / `{ string }` | TwoPointerViz |
| binary-search | `{ array, target, targets? }` | BinarySearchViz |
| tree-traversal | `{ tree: level-order array }` | needs input support |
| dp-grid | `{ rows, cols, seed }` or `{ grid }` | needs input support |
| backtracking | `{ choices, k }` | needs input support |
| trie | `{ words }` | TrieViz (check) |
| heap | `{ values }` | needs input support |
| stack | `{ string }` / `{ values }` | StackViz partial |
| linked-list | `{ values }` / `{ mode:'merge', listA, listB }` | LinkedListViz |
| graph | `{ nodes, edges, start }` | GraphViz (check) |
| hash-map | `{ array, target }` | HashMapViz ✅ |
| scan | `{ array }` | LinearScanViz ✅ |

### Work items

1. **Component audit** — give every visualizer a complete, validated `input`
   contract (tree-traversal, dp-grid, heap, backtracking are missing one).
   Each must clamp/normalize (length caps, value ranges) and fall back to its
   demo on malformed input.
2. **Generator extension** — `scripts/gen-solutions.mjs` prompt asks for a
   `viz` object per problem: the model picks the matching pattern key and
   emits the example input in that pattern's schema. Cheap: rides along the
   existing goal/constraints/examples call, no extra requests.
3. **Validator** — `scripts/validate-viz.mjs`: schema-check every `viz` field
   (shape, caps, sortedness where required), strip invalid ones. Run after
   every gen batch and in CI.
4. **Backfill pass** — `FORCE=0 ONLY=<slugs-missing-viz>` re-run over entries
   that predate the viz field. Rate-limit strategy same as the summary
   backfill (model rotation, resume-safe).
5. **Deterministic upgrades where AI isn't needed** — extend
   `lib/vizInput.js`: quoted strings → two-pointers palindrome mode / stack
   brackets mode; `[[a,b],…]` pairs → intervals timeline (new mini-viz);
   level-order arrays with `null` → tree-traversal.
6. **Coverage dashboard** — `npm run viz-coverage` prints per-pattern
   specific/generic counts so regressions are visible.

### Definition of done

- `npm run viz-coverage` reports ≥80% of non-Database problems with a
  problem-specific input, 100% with at least the generic pattern demo.
- Zero visualizer runtime errors across a scripted sweep of 200 random
  problem pages (headless).

### Suggested execution

Run as a proper GSD phase: `/gsd-new-project` (or `/gsd-plan-phase` if
.planning/ exists by then) with this file as the phase brief; the component
audit (item 1) parallelizes cleanly across subagents, and items 2–4 are
sequential on the generator.
