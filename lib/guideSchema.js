/**
 * Schema contract for the `guide` field on a solutions.json entry — the
 * step-by-step thought-process coach (docs/guided-coach-plan.md, Q4).
 *
 * Pure data + functions, no React — same role vizSchemas.js plays for `viz`.
 * Used by scripts/validate-guide.mjs; the build phase's check-program
 * generators (lib/guideChecks.js) will assume input that passed this.
 */

const CHECK_TYPES = ['ok', 'ast', 'run', 'llm'];
const RULE_KINDS = ['defines', 'has', 'lacks', 'calls'];
const COMPARES = ['eq', 'sorted'];

// Whitelist of Python ast node names guides may reference — catches typos at
// validate time instead of silently-never-matching at runtime. Grow as needed.
const AST_NODES = new Set([
  'FunctionDef', 'Lambda', 'Return', 'Assign', 'AugAssign',
  'For', 'While', 'If', 'Try', 'Break', 'Continue',
  'Dict', 'Set', 'List', 'Tuple', 'ListComp', 'DictComp', 'SetComp',
  'Call', 'Compare', 'In', 'NotIn', 'BoolOp', 'Not', 'Subscript', 'Slice',
]);

const isStr = (v, max = Infinity) => typeof v === 'string' && v.length > 0 && v.length <= max;

function validateRule(r, i, errs) {
  const at = `rules[${i}]`;
  if (!r || typeof r !== 'object') { errs.push(`${at}: not an object`); return; }
  if (!RULE_KINDS.includes(r.kind)) { errs.push(`${at}: kind must be one of ${RULE_KINDS.join('|')}`); return; }
  if (r.kind === 'defines' || r.kind === 'calls') {
    if (!isStr(r.name, 60)) errs.push(`${at}: ${r.kind} needs a "name" string`);
  } else {
    if (!isStr(r.node) || !AST_NODES.has(r.node)) errs.push(`${at}: "${r.node}" is not a whitelisted ast node`);
    if (r.count !== undefined && (!Number.isInteger(r.count) || r.count < 1 || r.count > 20)) {
      errs.push(`${at}: count must be an int in 1..20`);
    }
  }
  if (r.level !== undefined) {
    if (r.level !== 'require' && r.level !== 'prefer') errs.push(`${at}: level must be require|prefer`);
    // lacks/defines are gates by definition — "prefer" would make them no-ops.
    if (r.level === 'prefer' && (r.kind === 'lacks' || r.kind === 'defines')) {
      errs.push(`${at}: ${r.kind} cannot be level "prefer"`);
    }
  }
}

function validateTest(t, i, errs) {
  const at = `tests[${i}]`;
  if (!t || typeof t !== 'object') { errs.push(`${at}: not an object`); return; }
  if (!isStr(t.call, 200)) errs.push(`${at}: needs a "call" expression string`);
  if (!('expect' in t)) errs.push(`${at}: needs an "expect" value`);
  if (t.compare !== undefined && !COMPARES.includes(t.compare)) errs.push(`${at}: compare must be ${COMPARES.join('|')}`);
}

function validateCheck(check, errs) {
  if (!check || typeof check !== 'object') { errs.push('check: missing or not an object'); return; }
  if (!CHECK_TYPES.includes(check.type)) { errs.push(`check: type must be one of ${CHECK_TYPES.join('|')}`); return; }
  const rules = check.rules;
  const tests = check.tests;
  if (check.type === 'ok' || check.type === 'llm') {
    if (rules || tests) errs.push(`check: type "${check.type}" takes no rules/tests`);
    return;
  }
  if (check.type === 'ast') {
    if (!Array.isArray(rules) || rules.length < 1 || rules.length > 8) errs.push('check: ast needs 1..8 rules');
    else rules.forEach((r, i) => validateRule(r, i, errs));
    if (tests) errs.push('check: ast takes no tests (use type "run" with rules for both)');
    return;
  }
  // type === 'run': tests required, rules optional (fail-fast structure gate).
  if (!Array.isArray(tests) || tests.length < 1 || tests.length > 6) errs.push('check: run needs 1..6 tests');
  else tests.forEach((t, i) => validateTest(t, i, errs));
  if (rules !== undefined) {
    if (!Array.isArray(rules) || rules.length > 8) errs.push('check: run rules must be an array of ≤8');
    else rules.forEach((r, i) => validateRule(r, i, errs));
  }
}

/** Validate a whole guide object. Returns { ok, errors: string[] }. */
export function validateGuide(guide) {
  const errs = [];
  if (!guide || typeof guide !== 'object' || Array.isArray(guide)) {
    return { ok: false, errors: ['guide is not an object'] };
  }
  if (guide.version !== 1) errs.push(`unknown version ${JSON.stringify(guide.version)} (expected 1)`);
  if (!Array.isArray(guide.steps) || guide.steps.length < 1 || guide.steps.length > 12) {
    errs.push('steps must be an array of 1..12');
    return { ok: false, errors: errs };
  }
  const ids = new Set();
  guide.steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!s || typeof s !== 'object') { errs.push(`${at}: not an object`); return; }
    if (!isStr(s.id, 40) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) errs.push(`${at}: id must be a kebab-case slug`);
    else if (ids.has(s.id)) errs.push(`${at}: duplicate id "${s.id}"`);
    else ids.add(s.id);
    if (!isStr(s.title, 60)) errs.push(`${at}: title must be a 1..60 char string`);
    if (!isStr(s.prompt, 500)) errs.push(`${at}: prompt must be a 1..500 char string`);
    if (s.hints !== undefined) {
      if (!Array.isArray(s.hints) || s.hints.length > 3 || !s.hints.every((h) => isStr(h, 300))) {
        errs.push(`${at}: hints must be ≤3 non-empty strings`);
      }
    }
    if (s.reveal !== undefined && !isStr(s.reveal, 2000)) errs.push(`${at}: reveal must be a non-empty string`);
    const cErrs = [];
    validateCheck(s.check, cErrs);
    errs.push(...cErrs.map((e) => `${at}.${e}`));
  });
  return { ok: errs.length === 0, errors: errs };
}
