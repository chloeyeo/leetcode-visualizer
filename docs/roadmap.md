# LeetCode Visualizer — GSD Roadmap (Build → Sell)

> Get-Shit-Done format: ruthlessly prioritized sprints. Each sprint has a **Goal**, a
> **task list**, a **Definition of Done** (DoD), and an explicit **Cut** list. If it isn't in
> the current sprint, it doesn't get touched.

**The one-line strategy:** the free funnel (visualizers + playground + scripted-stub coach +
BYOK Gemini free tier) costs $0 to host. Revenue is a thin **Hosted** layer (auth +
server-held key + paywall) on top of the already-abstracted brain interface. We're closer to
revenue than it looks.

---

## ✅ Shipped (verified in-repo)

- Full catalog browse + search/filter; per-problem page; YouTube hint card with safe fallback.
- ~12 interactive pattern visualizers; Pyodide playground (trace + compare, in-place editor↔trace).
- AI interview coach: phase rail, checklist, swappable brain (free **stub** / BYOK **Gemini**
  free tier / **Claude** / OpenAI-compatible), live STT, graded scorecard.
- **Sprint 0 cleanup:** shared `useTraceWorker` hook (killed duplicated worker bootstrap);
  fixed stale README + plan docs; code-pane **token sweep** (single `--mono` token);
  responsive pass at 375 / 768 / 1280.

### Shipped this iteration (product-UX pass)

- **Homepage intuitiveness:** E/M/H → full **Easy/Medium/Hard** colored badges; the bare
  `58%` now reads **"58% / acceptance"** with an explanatory tooltip.
- **Homepage copy** rewritten around the three selling points (Think-Out-Loud coach,
  Gold-Standard upgrade, Interview Readiness Score) + pattern visualizers.
- **Problem content (Option 3 — blueprint + our own summary):** new `public/solutions.json`
  (slug → `aiSummary` + runnable `starterCode`), rendered on the problem page and prefilled
  into the Playground & interview. Seeded with **Two Sum** + **Valid Palindrome** (original
  drafts — replace with your ChatGPT/Gemini rewrites; UI reads the file as-is).
- **Interview start gate:** no timer / no interviewer voice / no recording until the user
  presses **Start**. A pre-start screen states exactly what begins, lets you mute the voice
  up front, and makes clear the mic only records on **Speak**. Kills the "0:25 already
  running, is it recording me?" confusion.
- **Removed the standalone `/interview` picker** (and its nav link): interviews are entered
  only from a problem's "Practice interview"; `/interview` without a problem redirects home.

---

## Sprint 1 — Prove the end-to-end flow on the Top 20 FAANG classics (in progress)

**Goal:** *enough surface area to prove the flow and test the UI* — NOT a 150-problem
data-entry marathon. **Scope cut (pivot):** the old "top ~150 problems" target is cut.
Sprint 1 is done at the **Top 20 FAANG classics**; backfilling the remaining ~130 is a later,
*automated* job once the app has traction.

> **Done so far:** `solutions.json` holds the **Top 20** (two-sum, valid-palindrome,
> two-sum-ii, binary-search, valid-anagram, contains-duplicate, best-time-to-buy-and-sell-stock,
> reverse-linked-list, valid-parentheses, merge-two-sorted-lists, number-of-islands,
> merge-intervals, lru-cache, maximum-subarray, climbing-stairs, product-of-array-except-self,
> group-anagrams, 3sum, longest-substring-without-repeating-characters, invert-binary-tree) —
> each with an original summary + runnable blueprint. The problem-specific visualizer
> **mechanism** is live (`viz {key, input}` in `solutions.json` → `PatternViz` → component);
> `TwoPointerViz` (incl. a palindrome mode) + `BinarySearchViz` are input-aware, so
> valid-palindrome, two-sum-ii and binary-search animate their own inputs.

### Tasks

1. ✅ **Seed the Top 20.** Original summaries + runnable blueprints for the 20 above. *(Done.)*
2. **Problem-specific visualizers.** *Done:* two-pointers (palindrome + sum), binary-search,
   plus new **StackViz brackets mode → valid-parentheses**, **GraphViz grid flood-fill →
   number-of-islands**, and **LinkedListViz custom input → reverse-linked-list**. That's 6 of
   the Top 20 with their own animations.
   *Deferred (need genuinely new layouts, not just input):* **invert-binary-tree** (mirror
   animation on the tree) and **merge-two-sorted-lists** (two-list merge layout). Each
   existing component animates one specific algorithm, so these require new modes — queued so
   we don't ship a misleading half-built animation.
3. **Gold-Standard diff (free taste).** On Playground/interview finish, show the user's code
   beside an optimal solution in an in-place diff (reuse the one-region rule — no third pane).
   Pull the optimal from `solutions.json` first; LLM-generate later.
4. **Later (automated, not now):** backfill the remaining ~130 problems via a one-time script
   that calls an LLM to generate summary + blueprint per slug, with human review only on diffs.

### Definition of Done

- **All 20 Top-FAANG-classics** show a real summary + blueprint; opening any into the
  Playground/interview prefills correctly. *(Met — pending the input-aware viz expansion.)*
- At least the wired problems show a problem-specific visualization.
- A user with no API key can: read the summary → practice the interview (stub) → see a
  gold-standard diff → screenshot the scorecard. End to end, $0.

### Cut (not now)

Accounts, payments, hosted brain, in-editor syntax highlighting, multi-language blueprints.

---

## Sprint 2 — Pro via BYOK (still $0 hosting)

**Goal:** prove the LLM interview is worth paying for using the user's own key, before taking
on hosting cost/auth.

### Tasks

1. Harden the BYOK brains (error states, CORS messaging, hard per-session turn/token caps).
2. Asymmetric models: cheap model for `respond()` every turn, strong model for `grade()` once.
3. Streaming + TTS polish so latency doesn't break flow.
4. **Web Speech resilience (known Chrome landmine).** Chrome's `SpeechRecognition` fires a
   `no-speech` error and silently kills the continuous stream when the user pauses ~10–15s to
   think. We must:
   - add an **auto-restart loop** — in `onend`/`onerror`, if the user's turn is still active
     (not manually stopped), immediately call `recognition.start()` again so the stream
     survives long thinking pauses without the user noticing;
   - guard against the restart-storm (debounce; only restart while `listening` is true);
   - show a **pulsing "Mic is listening" indicator** so the user always knows recording state,
     and surface a clear "reconnecting…" blip if a restart happens.
5. Frame BYOK as a real **"Pro (bring your own key)"** tier — conversion rehearsal.

### DoD

Paste a Gemini/Claude/OpenRouter key → full LLM interview with an evidence-cited scorecard;
hard caps enforced; still a pure static export. **A user can stay silent for 20+ seconds
mid-turn and the mic keeps listening (auto-restart works), with the pulsing indicator showing
live state the whole time.** **Cut:** server, auth, billing.

---

## Sprint 3 — Hosted tier (the revenue layer)

**Goal:** the paid product — a thin serverless layer holding the key, gating access, capping cost.

### Tasks

1. Serverless proxy (`/api/interview`) holding the paid key server-side, same brain interface.
2. Auth + Stripe Checkout + a `free | pro | premium` flag (no billing empire).
3. Hard cost controls from day one: per-user/session token + turn caps, rate limits, kill-switch.
4. Tier the features: **Free** (visualizers, playground, stub coach) · **Pro ~$15–25/mo**
   (hosted LLM interviewer, transcript analytics, gold-standard diff) · **Elite ~$49**
   (scorecard deep-dive, shareable verified scorecard, PDF export).

### DoD

A paying user signs in, pays, runs a hosted interview with no key of their own; paid key
provably server-only; per-session caps verified; free users hit a clean paywall.
**Cut:** neural voice, teams/orgs, Chrome extension.

---

## Sprint 4 — Growth loops & distribution

**Primary viral loop — the "LinkedIn Brag Card."** A high-fidelity, shareable export of the
scorecard:
- dark-mode **image (PNG) and/or PDF**, sized for LinkedIn/X, generated client-side
  (e.g. canvas / `html-to-image`);
- foregrounds the **Interview Readiness Score** and standout per-dimension metrics
  (e.g. "Scored 92% on Complexity Accountability"), problem name, and a subtle product
  watermark/link back into the free funnel;
- *design implication for earlier sprints:* build the `Scorecard` component so it has a clean,
  self-contained "card" subtree we can snapshot — don't bury the score in page chrome.

Plus: "unlock one more" weekly free interview with a blurred deep-scorecard teaser · Chrome
extension overlay on real leetcode.com (reuses the same brain interface; also sidesteps the
Chrome-only Web Speech limit). **Audience:** students/new-grads first (volume, viral density,
can't afford $150 human mocks), then upmarket where Elite margins live.

---

## Phase R — Guided Thought-Process Coach ("solve-it-with-me" overlay) — RESEARCH FIRST

> **Status: research DONE (2026-07-06) — build not started.** The spec lives in
> `docs/guided-coach-plan.md`; the finalized step schema is enforced by
> `npm run validate-guide` (`lib/guideSchema.js`); the hand-authored pilot (`guide` on
> **two-sum** in `solutions.json`) is proven end to end by `scripts/test-guide-pilot.py`
> (11/11 verdicts, incl. the duplicate-trap catch and pass-with-note). The build still does
> **not** block Sprints 1–3; its sprint plan should start from the sketch at the end of the
> spec.

**The idea:** on the problem page's **"Code it right here"** block (`TraceMode` on
`app/problem/[slug]/page.jsx`), a step-by-step guide layover — like a new-website onboarding
tour, but teaching the **thought process** of solving, one step at a time. Each step gives a
single reasoning prompt (e.g. *"What does 'same tree' mean at one node? Write just that
base-case check."*); the user writes code and clicks **OK**; the guide looks at what they
wrote and advances (or nudges) to the next thinking step. Hints steer reasoning — never the
full answer.

**Why it can win:** turns the passive summary into active recall; differentiates from
LeetCode's paywalled editorials; natural on-ramp into the interview coach and the
gold-standard diff.

### Research questions (this IS the phase-1 task list)

1. **Step content source.** Hand-authored per-problem scripts (extend `solutions.json` with a
   `guide` array, same pattern as `viz`) vs. per-pattern generic scripts vs. LLM-generated /
   adaptive via the existing swappable brain (`lib/interviewBrain.js`: free stub → BYOK).
   Likely layered, like the coach.
2. **What "OK" actually validates.** Options: run the user's code against a step-level
   assertion in the existing Pyodide worker (`useTraceWorker`); Python `ast` structure checks
   (Pyodide can parse); cheap heuristics; or an LLM judge. Trade off cost/latency/robustness —
   and define what happens when the user's code is *wrong but interesting*.
3. **UX shape.** Layover anchored to the editor vs. inline card above it; must respect the
   **one-region rule** (no third pane); skip/dismiss/resume; never cover the code while the
   user types; works at 375px.
4. **Step schema.** `id`, prompt, success criteria (assertion / AST predicate / rubric), hint
   escalation (nudge → bigger hint → reveal), progress persistence (localStorage).
5. **Prior-art scan.** Onboarding-tour libs (driver.js, Shepherd), Khan Academy / Brilliant
   step mechanics, LeetCode editorial "approach" sections — steal shamelessly, note what fails.
6. **Pilot scope.** Hand-author guides for 2–3 Top-20 problems (e.g. two-sum,
   valid-palindrome) before ANY automation.

### DoD (for the research phase — the build gets its own plan after)

A `docs/guided-coach-plan.md` spec answering questions 1–5, a finalized step schema, and one
hand-authored pilot script proving the schema fits a real problem end to end.

### Cut (v1 of the eventual build)

Full LLM adaptivity, multi-language guides, voice narration of steps.

---

## UX-debt / polish track (run alongside)

- Keep killing duplicate code regions; trace is always an in-place state of the editor.
- Watch the flaky CI/build mount: a full `npm run build` must be run locally to confirm the
  static export each iteration (the sandbox can't read `node_modules` reliably).
- Accessibility: ensure difficulty/acceptance have text equivalents (done on cards), keyboard
  nav for the interview controls, captions for interviewer voice.

---

## The "later / never" pile

Real-time barge-in interruption · multi-language execution · in-editor syntax highlighting ·
leaderboards · teams/enterprise · **self-hosted/custom models** (a 24/7 GPU is ~$576/mo vs.
pennies on a cheap API — do not self-host).

---

## How to use this doc

Top to bottom. Don't start a sprint until the previous DoD is fully green. Tempted by
something shiny? Check the **Cut** list — if it's there, it waits.
