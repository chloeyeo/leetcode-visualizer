/**
 * Interview Coach — pure logic (no React, no LLM). "StubBrain" + heuristics.
 * The phase machine, checklist trackers, scripted interviewer lines, and the
 * heuristic scorecard all live here so the UI stays dumb and a real LLM can
 * later replace evaluateTurn()/computeScorecard() behind the same shapes.
 */

export const PHASES = [
  { id: 'intro', label: 'Intro', objective: 'Restate the problem in your own words.',
    enter: "Let's begin. Take a moment to read the problem, then tell me how you understand it — in your own words.",
    checks: ['restated'],
    nudge: 'Try restating the problem in your own words — what are the inputs and the expected output?' },
  { id: 'clarify', label: 'Clarify', objective: 'Ask about inputs, constraints, and edge cases.',
    enter: 'Good. Before coding — any clarifying questions about inputs, constraints, or edge cases?',
    checks: ['asked'],
    nudge: "Is there anything you'd confirm about the input — size, value range, duplicates, or empty cases?" },
  { id: 'brute', label: 'Brute force', objective: 'Propose a correct first approach.',
    enter: "Great. What's a first approach that would work, even if it isn't optimal?",
    checks: ['approach'],
    nudge: 'Describe a concrete approach end to end, even a simple one. How would you find the answer?' },
  { id: 'brute_big_o', label: 'Big-O (brute)', objective: 'State & justify time and space complexity.',
    enter: "What's the time and space complexity of that approach?",
    checks: ['bigO'],
    nudge: "Put a number on it — what's the time complexity in Big-O notation? And the space?" },
  { id: 'optimize', label: 'Optimize', objective: 'Find a more efficient approach; explain the insight.',
    enter: "Can we do better? What's the bottleneck, and how would you remove it?",
    checks: ['optimal'],
    nudge: 'What part is slow? Is there a data structure that removes the repeated work?' },
  { id: 'opt_big_o', label: 'Big-O (optimal)', objective: "State the improved complexity and why it's better.",
    enter: 'And the complexity of the optimized version? Convince me it beats the brute force.',
    checks: ['bigO2'],
    nudge: 'State the new time and space complexity, and explain why it improves on the brute force.' },
  { id: 'code', label: 'Code', objective: 'Implement the optimal solution; think out loud.',
    enter: "Let's code it up. Talk me through it as you write, then run it.",
    checks: ['coded'],
    nudge: 'Go ahead and write the solution in the editor, then press Run.' },
  { id: 'wrap', label: 'Wrap-up', objective: 'Test an edge case and reflect.',
    enter: "Walk me through an edge case — say, an empty input. Any bugs?",
    checks: ['wrapped'],
    nudge: 'Try it on an empty or edge-case input and tell me what happens.' },
];

const ACKS = ['Got it.', 'Okay, that makes sense.', 'Good.', 'Right, makes sense.', 'Mm-hmm.'];

const BIG_O = /o\s*\(\s*(1|n\s*\^?\s*2|n\s*log\s*n|n\s*\*\s*m|log\s*n|n|m|v\s*\+\s*e)\s*\)/i;
const COMPLEXITY_WORDS = /\b(constant|linear|logarithmic|quadratic|linearithmic|exponential)\b/i;

function words(t) { return (t || '').trim().split(/\s+/).filter(Boolean); }
function hasBigO(t) { return BIG_O.test(t || '') || COMPLEXITY_WORDS.test(t || ''); }
function bigOCount(t) {
  const m = (t || '').match(new RegExp(BIG_O.source, 'gi')) || [];
  const w = (t || '').match(new RegExp(COMPLEXITY_WORDS.source, 'gi')) || [];
  return m.length + w.length;
}

/** Is a single checklist item satisfied, given the running candidate context? */
export function checkItem(id, ctx) {
  const text = (ctx.text || '').toLowerCase();
  const ranOk = !!(ctx.ran && ctx.ran.ok);
  switch (id) {
    case 'restated': return words(ctx.text).length >= 8;
    case 'asked': return /\?/.test(ctx.text) || /\b(assume|can i assume|are there|is it guaranteed|what if|should i)\b/.test(text);
    case 'approach': return /\b(loop|iterate|for each|nested|sort|hash|map|set|array|compare|check every|two pointer|brute|scan|traverse)\b/.test(text);
    case 'bigO': return hasBigO(text);
    case 'optimal': return /\b(optimal|better|more efficient|improve|reduce|hash ?map|set|two pointer|single pass|o\(n\)|linear|memo|cache)\b/.test(text);
    case 'bigO2': return hasBigO(text);
    case 'coded': return ranOk;
    case 'wrapped': return ranOk && /\b(edge|empty|test|null|none|boundary|corner|input)\b/.test(text);
    default: return false;
  }
}

const CHECK_LABELS = {
  restated: 'Restated the problem',
  asked: 'Asked a clarifying question',
  approach: 'Described an approach',
  bigO: 'Stated time/space complexity',
  optimal: 'Proposed an optimization',
  bigO2: 'Stated improved complexity',
  coded: 'Code runs successfully',
  wrapped: 'Tested an edge case',
};

export function checklistFor(phaseIndex, ctx) {
  const phase = PHASES[phaseIndex];
  if (!phase) return [];
  return phase.checks.map((id) => ({ id, label: CHECK_LABELS[id], done: checkItem(id, ctx) }));
}

export function phaseComplete(phaseIndex, ctx) {
  const phase = PHASES[phaseIndex];
  return phase ? phase.checks.every((id) => checkItem(id, ctx)) : false;
}

/** StubBrain.respond — decide the interviewer's reply for a just-finished turn. */
export function evaluateTurn(phaseIndex, ctx) {
  const complete = phaseComplete(phaseIndex, ctx);
  const ack = ACKS[(ctx.text || '').length % ACKS.length];
  return { complete, ack, nudge: PHASES[phaseIndex].nudge };
}

/** StubBrain.grade — heuristic scorecard from the whole session. */
export function computeScorecard({ turns, candidateText, code, ran }) {
  const text = (candidateText || '').toLowerCase();
  const cand = (turns || []).filter((t) => t.role === 'candidate');
  const totalWords = words(candidateText).length;

  const restated = checkItem('restated', { text });
  const asked = checkItem('asked', { text });
  const edge = /\b(edge|empty|boundary|corner)\b/.test(text);
  const optimal = checkItem('optimal', { text });
  const oCount = bigOCount(text);
  const space = /\bspace\b/.test(text);
  const ranOk = !!(ran && ran.ok);

  // each dimension scored 0..4
  const communication = clamp(
    (totalWords >= 120 ? 4 : totalWords >= 80 ? 3 : totalWords >= 40 ? 2 : totalWords >= 12 ? 1 : 0)
    - (cand.length >= 3 ? 0 : 1) + (restated ? 0 : -1), 0, 4
  );
  const clarifying = asked ? (edge ? 4 : 3) : 1;
  const progression = optimal ? (cand.length >= 5 ? 4 : 3) : checkItem('approach', { text }) ? 2 : 1;
  const complexity = oCount >= 2 ? (space ? 4 : 3) : oCount === 1 ? 2 : 0;
  const correctness = ranOk ? (edge ? 4 : 3) : code && code.trim().length > 20 ? 1 : 0;

  const dims = [
    { name: 'Communication', weight: 0.25, score: communication,
      evidence: quote(turns, () => true), tip: 'Narrate continuously and restate the problem before diving in.' },
    { name: 'Clarifying / ambiguity', weight: 0.15, score: clarifying,
      evidence: quote(turns, (t) => /\?/.test(t)), tip: 'Ask about input size, ranges, duplicates and empty cases up front.' },
    { name: 'Problem-solving progression', weight: 0.20, score: progression,
      evidence: quote(turns, (t) => /optimal|better|brute|approach/i.test(t)), tip: 'Always offer a brute force first, then articulate the bottleneck and the optimization.' },
    { name: 'Complexity accountability', weight: 0.20, score: complexity,
      evidence: quote(turns, (t) => BIG_O.test(t) || COMPLEXITY_WORDS.test(t)), tip: 'State AND justify both time and space Big-O for every approach.' },
    { name: 'Correctness / coding', weight: 0.20, score: correctness,
      evidence: ranOk ? 'Code ran successfully.' : 'Code did not run cleanly.', tip: 'Get a working solution running, then test an edge case.' },
  ];

  const overall = Math.round(dims.reduce((s, d) => s + (d.score / 4) * d.weight, 0) * 100);
  const grade = overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F';
  const actions = dims.slice().sort((a, b) => a.score - b.score).slice(0, 3).map((d) => d.tip);

  return { dims, overall, grade, actions, durationTurns: cand.length };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function quote(turns, pred) {
  const t = (turns || []).filter((x) => x.role === 'candidate' && pred(x.text)).pop();
  return t ? `“${t.text.length > 140 ? t.text.slice(0, 140) + '…' : t.text}”` : null;
}

export function starterCode(problem) {
  return `# ${problem.title}${problem.id ? ` (LeetCode #${problem.id})` : ''}\n# Talk through your approach out loud first, then implement here.\n\ndef solution():\n    pass\n\nprint(solution())\n`;
}
