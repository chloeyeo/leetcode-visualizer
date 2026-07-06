# Guided Thought-Process Coach ("solve-it-with-me") — Phase R research spec

> Output of the Phase R research phase (see `docs/roadmap.md`). Answers the six research
> questions, finalizes the step schema, and points at the hand-authored pilot
> (`guide` field on **two-sum** in `public/solutions.json`, schema-checked by
> `scripts/validate-guide.mjs`, check programs proven end-to-end by
> `scripts/test-guide-pilot.py`). The build gets its own sprint plan — this doc is the
> contract it builds against.

**The mechanic (one sentence):** a docked guide strip on the problem page's "Code it right
here" block that teaches the *thought process* one step at a time — prompt → user writes
code → clicks **OK** → the guide machine-checks what they wrote and advances or nudges —
hints steer reasoning, never reveal the answer.

---

## Q1 — Where step content comes from: layered, like the coach brains

| Layer | Source | Cost | When |
|---|---|---|---|
| v1 | Hand-authored `guide` field per problem in `solutions.json` (same pattern as `viz`) | $0 | pilot: 2–3 Top-20 problems |
| v1.5 | Per-pattern generic guide keyed off `lib/patterns.js` `pickPattern` (like the L1 visualizer fallback) | $0 | after pilot validates the mechanic |
| v2 | LLM-generated per-problem guides via the existing `scripts/gen-solutions.mjs` pipeline, human-reviewed on diff, schema-gated by `validate-guide` | one-time batch | the "backfill ~130" job |
| v3 | Adaptive: a `coach(ctx)` method on the brain interface (`lib/interviewBrain.js`) — stub = scripted escalation from the authored hints; BYOK LLM = reads the user's actual code and phrases the nudge | per-turn tokens (BYOK) | Sprint 2+ |

Key call: **the authored guide is the spine even in v3.** The LLM never invents the step
list at runtime; it only rephrases/adapts *within* the current authored step. That keeps the
free tier fully functional (stub walks the same spine) and caps LLM cost and hallucination
risk.

## Q2 — What clicking OK validates: a three-rung ladder, zero worker changes

Research finding (the big one): **the existing Pyodide worker already supports everything we
need.** `public/trace-worker.js` accepts `{type:'run', id, code}`, runs an arbitrary Python
program with the full stdlib (including `ast`), echoes the `id` back, and returns
`stdout`/`error`. So a step check is *just another program we send to the worker*:

1. **`ok`** — no machine check; OK advances. For pure-thinking steps (restate the goal).
2. **`ast`** — we send a small check program that `ast.parse`s the user's code (embedded as
   a string literal) and evaluates declarative rules (below), printing a one-line JSON
   verdict to stdout. Catches *structure*: "you have a dict before the loop", "there's a
   membership test", "no nested loops left". Instant, offline, free, tolerant of
   half-finished code (no execution).
3. **`run`** — we send the user's code + an appended test harness that calls their function
   and compares results (with `eq` or order-insensitive `sorted` comparison), printing the
   same JSON verdict shape. Catches *behavior*. Bounded by the worker's existing 4000-step
   budget.

`llm` is reserved in the schema as a fourth check type but is **not** part of v1 (BYOK-only,
v3, routed through `coach()`).

**"Wrong but interesting":** AST rules carry a `level`: `"require"` (must hold to pass) or
`"prefer"` (advisory). If `run` tests pass but a `prefer` rule fails, the step **passes with
a note** ("you solved it another way — compare with the intended path") instead of blocking.
Never hard-block a working solution because it isn't the canonical one.

**Failure path:** each failed OK increments `tries` and escalates the hint tier
(`hints[0]` → `hints[1]` → offer `reveal`). Reveal is always user-initiated (a button after
`tries >= 3`), never automatic — the product's whole promise is "we don't blurt the answer."

**Build-phase integration note (load-bearing):** `useTraceWorker` binds a single `onMessage`
at mount and `TraceMode` currently routes on `d.type` only, ignoring `d.id`
(`components/TraceMode.jsx`). Guide checks share the same worker, so the handler **must
route on `d.id`** (`trace` vs `guide:<slug>:<stepId>`) or a step check will clobber the
trace UI state. This is the one real wiring change the build needs.

Second worker-fidelity constraint (found while proving the pilot): the worker's 4000-step
budget only counts frames whose filename is `'<user>'`, so the `run` harness **must compile
the student's code with filename `'<user>'`** (`exec(compile(__USER, '<user>', 'exec'), …)`)
— under any other name an infinite student loop would dodge the budget and hang the tab.
`scripts/test-guide-pilot.py` is the reference implementation of both generators.

## Q3 — UX shape: a docked strip inside the editor region, not an overlay

The one-region rule is the hardest constraint, and the verdict is: **no floating overlay, no
spotlight tour, no third pane.**

- The guide renders as a **docked strip inside `.pg-editor`** (the left column of
  `pg-grid`), between the editor head and the CodeMirror pane: one step at a time, ~3 lines
  tall — step title, prompt, and a button row `[Hint] [OK →] [Skip step] [✕ End guide]`.
  It is part of the editor region, so the rule holds; the code is never covered, and the
  user can type while reading the prompt (the exact interaction tours can't do — see Q5).
- **Collapsed state:** a single chip ("💡 Guide · step 3/6") on the editor head; click to
  re-expand. Dismissing ends the guide (progress kept).
- Checking state: OK becomes a small "checking…" spinner (worker round-trip is <1s warm);
  pass flashes the strip green and swaps the prompt; fail shows the current hint tier inline.
- 375 px: the strip is full-width above the editor — same DOM, no reflow tricks.
- Transient anchored highlights (driver.js-style flash of e.g. the Run button or the
  complexity lint) are allowed **only** as one-shot step-transition effects, never
  persistent chrome.

## Q4 — Step schema (final, versioned)

Lives on a solutions.json entry as `guide`, sibling of `viz`. Validated by
`scripts/validate-guide.mjs` (same role as `validate-viz`).

```jsonc
"guide": {
  "version": 1,
  "steps": [
    {
      "id": "hash-idea",                  // stable slug, unique within the guide
      "title": "Trade space for time",    // strip header, ≤ 60 chars
      "prompt": "…one reasoning instruction, ends in something to DO…",
      "hints": ["gentle nudge", "bigger hint"],   // escalation tiers, 0–3 entries
      "reveal": "seen = {}\nfor i, x in enumerate(nums):",  // optional; offered after 3 tries
      "check": {
        "type": "ok" | "ast" | "run" | "llm",
        // type "ast":
        "rules": [
          { "kind": "defines", "name": "two_sum" },              // function def exists
          { "kind": "has", "node": "Dict", "level": "require" }, // ast node type present
          { "kind": "lacks", "node": "While" },                  // ast node type absent
          { "kind": "calls", "name": "enumerate", "level": "prefer" } // call by name
        ],
        // type "run" (may ALSO carry "rules" — evaluated first as a cheap fail-fast
        // structure gate before executing anything):
        "tests": [
          { "call": "two_sum([2, 7, 11, 15], 9)", "expect": [0, 1], "compare": "sorted" }
          // compare: "eq" (default) | "sorted" (order-insensitive)
        ]
      }
    }
  ]
}
```

Semantics: `rules` are AND-ed; `level` defaults to `"require"`; `lacks`/`defines` are always
require. `has`/`lacks` take an optional `count` (default 1): `has` means *at least* `count`
occurrences, `lacks` means *fewer than* `count` (so `lacks For count 2` = "no second loop").
`run` tests are AND-ed, executed in one worker round-trip. The verdict line is printed to
stdout with a `__GUIDE__` prefix so the UI can find it even when the user's code prints. Progress persists in
`localStorage` under `guide:<slug>` as `{ step, tries, done, dismissed }`.

The four `ast` rule kinds are deliberately the whole DSL — enough to express "brute force
written" (`has For` ×2 via `{ "kind": "has", "node": "For", "count": 2 }`), "dict before
loop" (`has Dict`), "membership test" (`has In`), "returns something" (`has Return`) — while
staying trivially LLM-generatable and schema-checkable for v2. If a guide needs more, that's
a `run` test's job.

## Q5 — Prior art: what to steal, what to avoid

- **driver.js / Shepherd / Intro.js** (onboarding tours): steal the *single-step focus*,
  progress dots, and advance-on-event idea. Avoid the core mechanic — their modal
  backdrop/spotlight **blocks interaction with the page**, and our user must type code
  *while* guided. That's the concrete reason Q3 lands on a docked strip, not a tour.
- **Khan Academy** (their own writeup: khanacademy.org "how we teach coding on KA"): steal
  tiny steps + immediate feedback + hint escalation that reveals progressively, with gentle
  friction before each reveal so hints aren't spammed. Our `tries >= 3` gate is that
  friction.
- **Brilliant**: steal one-concept-per-screen pacing and "why that's wrong" feedback on the
  specific mistake (our fail path shows the hint tier matched to the failed rule, not a
  generic "try again").
- **Codecademy checkpoints**: closest existing mechanic to our `run` rung — per-step tests
  with instant validation. Their lesson: checkpoint tests must be *forgiving on style*
  (hence `prefer` rules and order-insensitive compare), or users rage-quit on false
  negatives.
- **Exercism mentoring**: the "wrong but interesting" tier exists and is valuable, but it's
  human/LLM-priced — confirms parking `llm` checks to v3 rather than blocking v1 on them.
- **Parsons problems** (CS-ed research): reordering scaffolds as a low-floor step type —
  noted for later, deliberately not in the v1 schema.

## Q6 — Pilot

Hand-authored 6-step guide on **two-sum** (`public/solutions.json` → `guide`), chosen
because it exercises every check type and the app's existing furniture:

1. **restate** (`ok`) — say what the function must return, as a comment.
2. **brute-force** (`ast`: `has For ×2` require + `run`: sample passes) — write the obvious
   nested loop *first*; it works.
3. **feel-the-cost** (`ok`, points at the existing complexity lint under the editor —
   `analyzeComplexity` already flags the O(N²)) — realize why it won't scale.
4. **hash-idea** (`ast`: `has Dict`, `lacks` nested `For` via `count`) — one pass, remember
   what you've seen.
5. **check-then-insert** (`ast`: `has In`, `has Return` + `run`: sample) — membership test
   before insert, return both indices.
6. **edge-duplicates** (`run`: `two_sum([3,3],6) → [0,1]`) — the test that catches
   insert-before-check ordering bugs.

Proof: `scripts/validate-guide.mjs` (schema conformance) and `scripts/test-guide-pilot.py`
(runs each step's actual generated check program against wrong-then-right sample user code —
the same programs the worker would run).

## Build-phase plan sketch (NOT this phase — input to its sprint planning)

1. `GuideCoach` component (strip UI + state machine + localStorage) inside `TraceMode`;
   worker message routing on `d.id` (the Q2 wiring note).
2. Check-program generators (`lib/guideChecks.js`): `rules → ast check program`,
   `tests → run harness` — port of the generators proven in `test-guide-pilot.py`.
3. Author guides for 2 more pilot problems (valid-palindrome, reverse-linked-list) —
   confirms the schema fits a string/two-pointer and a data-structure problem.
4. `validate-guide` into CI/`npm run` alongside `validate-viz`; then the v1.5
   pattern-generic fallback; then v2 gen-solutions emission.

**DoD for the build:** on two-sum, a user who has never seen hash maps can go blank-starter
→ working O(N) solution guided end to end, offline, $0, without the guide ever showing the
answer unprompted; dismiss/resume works; trace UI never glitches during a check.

**Cut (build v1):** LLM adaptivity (`llm` checks, `coach()`), multi-language, voice, Parsons
steps, per-pattern generic guides.
