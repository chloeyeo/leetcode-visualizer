# AI Technical Interview Coach — Plan & Architecture

Status: **planning** (no app code yet). Decisions locked: build a **stub interviewer first** (no real LLM), and **plan before building**. This document is the blueprint to build against.

---

## 1. Vision

Turn the existing study tool into a **live mock-interview simulator** that trains the thing candidates actually fail on: *communication under a FAANG-style collaborative loop*. The candidate talks through their approach out loud, moves from brute force to optimal, justifies Big-O at each step, fields realistic interviewer follow-ups, and gets a graded scorecard.

This is the **premium/monetizable** surface of the product. The visualizers and playground are the free funnel; the coach is what people would pay for (cf. interviewing.io at hundreds of dollars per human mock).

### Non-negotiable principle
The interviewer "brain" is an **LLM behind a swappable interface**. Everything else (recording, transcription, flow, timer, scoring UI) is independent of which brain is plugged in. We ship a **scripted stub** first; a real model drops in later with zero UI changes.

---

## 2. Scope: what it is / isn't (v1)

**Is:**
- Turn-based spoken interview on a real LeetCode problem.
- A guided phase journey with a visible checklist and timer.
- Live transcription of the candidate's speech.
- A stub "interviewer" that asks phase-appropriate, mostly-scripted questions.
- A post-session scorecard (stubbed heuristics first, LLM-graded later).
- Reuses the existing **Pyodide engine** so the candidate's code actually runs mid-session.

**Isn't (deferred):**
- **Real-time barge-in / interruption.** True mid-sentence interruption needs streaming STT + low-latency streaming LLM + interrupt logic — laggy and fragile. v1 is **turn-based**: candidate speaks → "Done" → interviewer responds.
- High-fidelity neural voice (ElevenLabs). v1 uses the browser's built-in `SpeechSynthesis`.
- Accounts, payments, leaderboards.

---

## 3. Architecture overview

```
                 ┌───────────────────────────────────────────────┐
                 │                /interview (route)             │
                 │                                               │
   mic ─────────▶│  Recorder        Phase Machine     Scorecard  │
  (MediaRecorder)│  + live STT      (Clarify→…→Code)   (report)   │
                 │  (Web Speech)         │                        │
                 │        │              ▼                        │
                 │        │       Interviewer Brain (interface)   │
                 │        │        ├─ StubBrain   (v1, no cost)   │
                 │        │        ├─ BYOKBrain   (browser→LLM)   │
                 │        │        └─ HostedBrain (serverless)    │
                 │        ▼              │                        │
                 │  Transcript ◀─────────┘   Code runner          │
                 │  (events log)             (existing Pyodide)   │
                 └───────────────────────────────────────────────┘
```

All client-side except the optional `HostedBrain`. With Stub or BYOK the app stays a **static export** (current hosting model). Only HostedBrain adds a serverless function — and that's the paid tier.

### Key web APIs (all free, client-side)
| Capability | API | Notes |
|---|---|---|
| Record audio | `MediaRecorder` | optional save/replay of the session |
| Live transcription | `SpeechRecognition` (Web Speech) | **Chrome/Edge only** — Firefox/Safari lack it. Strong reason to favor the **Chrome extension** distribution. |
| Interviewer voice | `SpeechSynthesis` | built-in TTS; pick a stable voice |
| Run candidate code | existing `trace-worker.js` (Pyodide) | already built |
| Persist session | `localStorage` / IndexedDB | transcripts, scorecards, settings |

---

## 4. The interview flow (state machine)

A finite set of phases, each with an **objective**, a **checklist** the candidate must satisfy, and **stub prompts** the interviewer can draw from. The phase machine is the backbone and is 100% LLM-free.

| # | Phase | Candidate objective | Checklist (auto/heuristic-tracked) | Stub interviewer line |
|---|---|---|---|---|
| 0 | **Intro** | Read problem, restate it | Restated problem in own words | "Take a moment, then tell me how you understand the problem." |
| 1 | **Clarify** | Ask about inputs, constraints, edge cases | Asked ≥1 clarifying question; identified an edge case | "Good question — assume the array can be empty. What else?" |
| 2 | **Brute force** | Propose a correct naive approach | Described an approach end-to-end | "Okay, would that work? Walk me through why." |
| 3 | **Complexity (brute)** | State + justify time/space Big-O | Stated a time **and** space complexity | "What's the time complexity of that? And space?" |
| 4 | **Optimize** | Improve it; explain the insight | Named a better approach + the key idea | "Can we do better? What's the bottleneck?" |
| 5 | **Complexity (optimal)** | State + justify improved Big-O | Stated improved complexity + why it's better | "And the complexity now? Convince me it's better." |
| 6 | **Code** | Implement the optimal solution | Code runs; passes a sample | "Go ahead and code it up. Think out loud." |
| 7 | **Wrap** | Test, handle edge cases, reflect | Ran on an edge case | "Walk me through this input: []. Any bugs?" |

**Heuristic trackers (no LLM):** detect Big-O mentions via regex (`O(n)`, `O(log n)`, `O(n^2)`, "linear", "constant"…); detect "brute force"/"optimal" keywords; detect a clarifying question (utterance ends with "?" during Clarify); detect code run + sample pass via the Pyodide engine. These power the checklist and a baseline grade even before any LLM exists.

---

## 5. The Interviewer Brain interface (stub-first, swappable)

One TypeScript/JS interface; three implementations. UI only ever talks to the interface.

```ts
type Turn = { role: 'interviewer' | 'candidate'; text: string; phase: Phase; t: number };

interface InterviewerBrain {
  // Given the running transcript + phase + the problem + candidate's current code,
  // return the interviewer's next utterance and whether to advance the phase.
  respond(ctx: {
    problem: Problem;
    phase: Phase;
    transcript: Turn[];
    code: string;
    lastRunResult?: RunResult;     // from the Pyodide engine
    checklist: ChecklistState;
  }): Promise<{ say: string; advance?: boolean; flags?: string[] }>;

  // End-of-session evaluation against the rubric.
  grade(ctx: { problem: Problem; transcript: Turn[]; code: string; checklist: ChecklistState })
    : Promise<Scorecard>;
}
```

- **StubBrain (v1):** picks phase-appropriate lines from a small scripted bank + the heuristic trackers; `advance` when the phase checklist is satisfied. `grade()` computes a scorecard from checklist completion + timing. Zero cost, fully offline, surprisingly convincing for the flow.
- **BYOKBrain:** same interface; `respond`/`grade` call the user's LLM (key in `localStorage`) with a system prompt that encodes the interviewer persona + rubric. App stays static.
- **HostedBrain:** identical, but calls our serverless proxy (auth + rate limit + our key). The paid tier.

Because grading and questioning are the same interface, **swapping the brain is a one-line config change**.

---

## 6. Grading rubric (the real IP)

The scorecard is only as good as the rubric. Design it explicitly; it's reused by the stub (heuristics) and the LLM (prompt).

| Dimension | Weight | What "good" looks like |
|---|---|---|
| **Communication** | 25% | Restated problem, thought out loud, structured narration, no long silent stretches |
| **Clarifying / ambiguity** | 15% | Asked about constraints, edge cases, input shape before coding |
| **Problem-solving progression** | 20% | Brute force → optimal, articulated the bottleneck and the insight |
| **Complexity accountability** | 20% | Stated *and justified* time + space Big-O for each approach; correct |
| **Correctness / coding** | 20% | Working code, handled edge cases, tested |

Output: per-dimension score (0–4) + evidence quotes from the transcript + an overall letter/number grade + 3 concrete "next time" actions. Keep the format identical for stub and LLM so the UI doesn't branch.

---

## 7. Data model

```ts
Session {
  id, problemSlug, startedAt, endedAt,
  brain: 'stub' | 'byok' | 'hosted',
  transcript: Turn[],
  codeFinal: string,
  runs: RunResult[],
  checklist: ChecklistState,
  scorecard?: Scorecard,
  audioBlobRef?: string        // optional MediaRecorder capture
}
Scorecard { dimensions: {name, score0to4, evidence[]}[], overall, actions: string[] }
```
Persist to IndexedDB (audio can be large); settings + API key to `localStorage`.

---

## 8. UI / routes

- **`/interview`** — problem picker (reuse the catalog) → session.
- **Session screen:** left = problem + code editor (reuse Pyodide runner); right = interviewer panel (current question, voice toggle), live transcript, the phase rail with checklist + timer, and a big **"Done speaking"** turn button.
- **`/interview/[sessionId]`** — the scorecard report (shareable; screenshots sell the product).
- Settings: brain selector, API key field (BYOK), voice on/off, mic device.

Reuse existing design tokens, `useStepPlayer`-style patterns, and the Pyodide worker. New components only for: Recorder, PhaseRail, InterviewerPanel, TranscriptView, Scorecard.

---

## 9. Free vs paid / monetization

| Tier | Brain | Cost to host | Gate |
|---|---|---|---|
| Free / open | Stub | $0 | always on; great funnel + demo |
| Pro (BYOK) | BYOK | $0 to host (user pays their key) | optional "unlock" UX |
| Premium | Hosted | per-session LLM + STT | paywall + auth; the revenue tier |

Cost drivers when real: multiple LLM turns/session + (optional) Whisper STT if not using the free Web Speech API. Keeping STT on the browser API and using a cheap model for `respond()` (reserve the strong model for `grade()`) keeps per-session cost low. This asymmetry is why it monetizes.

---

## 10. Risks & honest caveats

1. **Web Speech API is Chrome/Edge-centric** → either accept that, add a "type instead of talk" fallback, or lean into the **Chrome extension** distribution (which also lets it overlay real LeetCode).
2. **Turn-based ≠ the real-time fantasy.** Set expectations; real-time interruption is a later, hard upgrade.
3. **Latency** of LLM turns can break flow — stream responses + speak as they arrive; show a "thinking" state.
4. **Grading trust** — users will reject a scorecard that feels arbitrary. Always cite transcript evidence; let users see *why* they were marked down.
5. **Privacy** — recording voice + sending transcripts to an LLM needs a clear consent + data policy, especially for the hosted tier.
6. **Cost runaway** on the hosted tier — hard per-session token caps + rate limits from day one.
7. **Scope** — this is a Phase-5 product surface, not a tweak. Build the free slice first to validate the *flow* before paying for intelligence.

---

## 11. Phased roadmap

- **Phase A — Free flow scaffold (no LLM).** `/interview` route, problem picker, mic recorder + live transcript (Web Speech), phase rail + checklist + timer, heuristic trackers (Big-O regex, brute/optimal keywords, code-run detection), StubBrain scripted questions, heuristic scorecard. *Ships a useful, $0, offline-capable coach and de-risks the whole concept.*
- **Phase B — Real interviewer (BYOK).** Implement `BYOKBrain` against the same interface; system prompt for persona + rubric; streaming + TTS; LLM-graded scorecard. Still static hosting.
- **Phase C — Premium (Hosted).** Serverless proxy, auth, paywall, per-session caps, polished voice (optional ElevenLabs). The revenue tier.
- **Phase D — Chrome extension.** Overlay the coach on real leetcode.com problems; reuse the same brain interface and components.

---

## 12. Open decisions (revisit before Phase B)

- Which LLM/provider(s) for BYOK + hosted (cost vs quality for `respond` vs `grade`).
- STT: stick with free Web Speech API, or add Whisper for accuracy/cross-browser.
- Voice: browser `SpeechSynthesis` vs paid neural TTS for the premium feel.
- Distribution: native `/interview` route first, or go straight to the extension.
- Pricing model for the hosted tier (per-session credits vs subscription).

---

*Build order recommendation: Phase A in full first (it's free, useful alone, and proves the flow), then decide BYOK vs hosted based on how the stubbed experience lands with real users.*
