/**
 * Interviewer "brain" — swappable. StubBrain (scripted, free) plus three BYOK
 * LLM backends that share one prompt/parse pipeline:
 *   - Claude (Anthropic)  — browser-direct via the browser-access header
 *   - Gemini (Google)     — free tier, browser-callable
 *   - Custom OpenAI-compatible (OpenRouter / HF router / local / etc.)
 * All expose the same async respond()/grade() so the session UI never branches.
 * Note: many providers block direct browser calls (CORS); Anthropic + Gemini
 * work in-browser, OpenRouter usually does, others may need a proxy.
 */
import { PHASES, evaluateTurn, computeScorecard } from './interview';

export function createBrain(s) {
  if (!s) return stubBrain();
  if (s.mode === 'claude' && s.key) {
    return makeLlmBrain('claude', (sys, u, max, kind) =>
      callClaude(s.key, kind === 'grade' ? (s.model2 || 'claude-sonnet-4-6') : (s.model || 'claude-haiku-4-5-20251001'), sys, u, max));
  }
  if (s.mode === 'gemini' && s.key) {
    return makeLlmBrain('gemini', (sys, u, max) => callGemini(s.key, s.model || 'gemini-2.5-flash', sys, u, max));
  }
  if (s.mode === 'custom' && s.key && s.baseUrl && s.model) {
    return makeLlmBrain('custom', (sys, u, max) => callOpenAICompat(s.baseUrl, s.key, s.model, sys, u, max));
  }
  return stubBrain();
}

function stubBrain() {
  return {
    mode: 'stub',
    async respond(ctx) {
      const res = evaluateTurn(ctx.phaseIndex, { text: ctx.candidateAll, code: ctx.code, ran: ctx.ran });
      if (res.complete && ctx.phaseIndex < PHASES.length - 1) return { say: res.ack + ' ' + PHASES[ctx.phaseIndex + 1].enter, advance: true };
      if (res.complete) return { say: res.ack + " That's a good place to stop — end the session to see your scorecard.", advance: true };
      return { say: res.nudge, advance: false };
    },
    async grade(ctx) { return computeScorecard(ctx); },
  };
}

/** Build a brain from a single `complete(system, user, maxTokens, kind)` function. */
function makeLlmBrain(mode, complete) {
  return {
    mode,
    async respond(ctx) {
      const txt = await complete(respondSystem(ctx), respondUser(ctx), 320, 'respond');
      const j = extractJson(txt);
      if (j && typeof j.say === 'string') return { say: j.say, advance: !!j.advance };
      return { say: (txt || '').trim().slice(0, 400) || '(no response)', advance: false };
    },
    async grade(ctx) {
      const txt = await complete(GRADE_SYSTEM, gradeUser(ctx), 1300, 'grade');
      const j = extractJson(txt);
      if (j && Array.isArray(j.dims)) return normalizeScorecard(j, ctx);
      return computeScorecard(ctx);
    },
  };
}

/* ---------------- provider adapters ---------------- */

// POST JSON with a timeout (so a hung request can't spin forever) and retries
// on transient overload (429/503).
async function postJson(label, url, headers, body, { retries = 2, timeoutMs = 30000 } = {}) {
  let attempt = 0;
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error(`${label} timed out — try again or pick a less busy model.`);
      throw new Error(`${label} network error: ${e.message || e}. (Often a CORS block from the provider.)`);
    }
    clearTimeout(timer);
    if ((res.status === 503 || res.status === 429) && attempt < retries) {
      attempt += 1;
      await new Promise((r) => setTimeout(r, 900 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${label} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
    return res.json();
  }
}

async function callClaude(key, model, system, user, maxTokens) {
  const data = await postJson('Claude', 'https://api.anthropic.com/v1/messages', {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }, { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
  return (data.content && data.content[0] && data.content[0].text) || '';
}

async function callGemini(key, model, system, user, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const data = await postJson('Gemini', url, { 'content-type': 'application/json' }, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: Math.max(maxTokens, 800),
      temperature: 0.6,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }, // don't let 2.5 "thinking" eat the answer
    },
  });
  const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return (parts && parts[0] && parts[0].text) || '';
}

async function callOpenAICompat(baseUrl, key, model, system, user, maxTokens) {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const data = await postJson('API', url, { 'content-type': 'application/json', authorization: `Bearer ${key}` }, {
    model, max_tokens: maxTokens, temperature: 0.6,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

/* ---------------- shared prompts + parsing ---------------- */

function respondSystem(ctx) {
  const phase = PHASES[ctx.phaseIndex];
  return `You are a senior staff engineer running a collaborative, FAANG-style technical interview. Be concise (1–3 sentences), realistic, warm but probing, and Socratic — ask ONE follow-up at a time. The interview moves through phases: restate → clarify → brute force → state Big-O → optimize → state Big-O → code → test. The candidate is in the "${phase.label}" phase; its goal is: ${phase.objective}. Decide whether they've satisfied this phase well enough to advance. Never write the solution for them — nudge instead. If they ask you to confirm an assumption, give a brief realistic answer. Reply ONLY as compact JSON: {"say": string, "advance": boolean}.`;
}

function respondUser(ctx) {
  const phase = PHASES[ctx.phaseIndex];
  const checklist = (ctx.checklist || []).map((c) => `${c.done ? '[x]' : '[ ]'} ${c.label}`).join('; ');
  const run = ctx.ran ? (ctx.ran.ok ? `OK; output: ${(ctx.ran.stdout || '').slice(0, 200)}` : `ERROR: ${ctx.ran.error}`) : 'not run yet';
  const transcript = (ctx.transcript || []).map((t) => `${t.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${t.text}`).join('\n');
  return `Problem: ${ctx.problem.id}. ${ctx.problem.title} (${ctx.problem.difficulty}). Tags: ${(ctx.problem.tags || []).join(', ')}.
Current phase: ${phase.label} — ${phase.objective}
Checklist: ${checklist}
Candidate's current code:
${ctx.code}
Last run: ${run}
Transcript so far:
${transcript}

Give your next interviewer turn as JSON.`;
}

const GRADE_SYSTEM = `You are grading a mock technical interview transcript. Score these 5 dimensions 0–4 each: "Communication", "Clarifying / ambiguity", "Problem-solving progression", "Complexity accountability", "Correctness / coding". For each, give a one-sentence "evidence" note (quote the candidate where possible) and a one-sentence "tip". Compute "overall" 0–100 using weights communication .25, clarifying .15, progression .20, complexity .20, correctness .20. "grade" letter: A≥85, B≥70, C≥55, D≥40, else F. List the top 3 "actions" to improve. Reply ONLY as JSON: {"dims":[{"name":string,"score":number,"evidence":string,"tip":string}],"overall":number,"grade":string,"actions":[string,string,string]}.`;

function gradeUser(ctx) {
  const transcript = (ctx.turns || []).map((t) => `${t.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${t.text}`).join('\n');
  const run = ctx.ran ? (ctx.ran.ok ? `OK; output: ${(ctx.ran.stdout || '').slice(0, 200)}` : `ERROR: ${ctx.ran.error}`) : 'not run';
  return `Problem: ${ctx.problem.id}. ${ctx.problem.title} (${ctx.problem.difficulty}).
Final code:
${ctx.code}
Final run: ${run}
Full transcript:
${transcript}

Grade it as JSON.`;
}

function extractJson(txt) {
  if (!txt) return null;
  let s = txt.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) { return null; }
}

function normalizeScorecard(j, ctx) {
  const dims = (j.dims || []).map((d) => ({
    name: d.name,
    score: Math.max(0, Math.min(4, Number(d.score) || 0)),
    evidence: d.evidence || null,
    tip: d.tip || '',
  }));
  let overall = Number(j.overall);
  if (!Number.isFinite(overall)) overall = Math.round((dims.reduce((s, d) => s + d.score, 0) / (dims.length * 4 || 1)) * 100);
  overall = Math.max(0, Math.min(100, Math.round(overall)));
  const grade = j.grade || (overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F');
  const actions = Array.isArray(j.actions) && j.actions.length ? j.actions.slice(0, 3) : computeScorecard(ctx).actions;
  return { dims, overall, grade, actions, durationTurns: (ctx.turns || []).filter((t) => t.role === 'candidate').length };
}
