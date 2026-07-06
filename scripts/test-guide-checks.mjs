/**
 * Parity + coverage test for lib/guideChecks.js: generate every guide step's
 * check program with the SAME generator the browser uses, execute it under a
 * real Python interpreter, and assert the verdicts against wrong-then-right
 * sample student code.
 *
 * Two-sum cases mirror scripts/test-guide-pilot.py (the reference
 * implementation) — if the two ever disagree, the port has drifted.
 *
 * Run:  node scripts/test-guide-checks.mjs        (exit 1 on any mismatch)
 * Uses the Windows `py` launcher, falling back to `python`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { genCheckProgram, parseVerdict } from '../lib/guideChecks.js';

const FILE = path.join(process.cwd(), 'public', 'solutions.json');
const solutions = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function runPython(src) {
  for (const exe of ['py', 'python']) {
    const r = spawnSync(exe, ['-'], { input: src, encoding: 'utf8' });
    if (!r.error) {
      if (r.status !== 0) throw new Error(`python exited ${r.status}: ${r.stderr}`);
      return r.stdout;
    }
  }
  throw new Error('no python interpreter found (tried py, python)');
}

/* ---- sample student code ---- */

const TS = {
  starter: solutions['two-sum'].starterCode,
  brute:
    'def two_sum(nums, target):\n' +
    '    for i in range(len(nums)):\n' +
    '        for j in range(i + 1, len(nums)):\n' +
    '            if nums[i] + nums[j] == target:\n' +
    '                return [i, j]\n' +
    '\nprint(two_sum([2, 7, 11, 15], 9))\n',
  mid: 'def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        pass\n',
  midDictCall: 'def two_sum(nums, target):\n    seen = dict()\n    for i, x in enumerate(nums):\n        pass\n',
  insertFirst:
    'def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n' +
    '        seen[x] = i\n        if target - x in seen:\n            return [seen[target - x], i]\n',
  optimal: solutions['two-sum'].optimal,
  syntaxError: 'def two_sum(nums, target)\n    pass\n',
};

const VP = {
  starter: solutions['valid-palindrome'].starterCode,
  optimal: solutions['valid-palindrome'].optimal,
  cleaned: 'def is_palindrome(s):\n    t = [c.lower() for c in s if c.isalnum()]\n',
  alphaBug: 'def is_palindrome(s):\n    t = [c.lower() for c in s if c.isalpha()]\n    return t == t[::-1]\n',
};

const RLL_CORRECT =
  solutions['reverse-linked-list'].starterCode.replace(
    /def reverse_list\(head\):[\s\S]*?pass\n/,
    'def reverse_list(head):\n    prev = None\n    cur = head\n    while cur:\n        nxt = cur.next\n        cur.next = prev\n        prev = cur\n        cur = nxt\n    return prev\n',
  );
const RLL = {
  starter: solutions['reverse-linked-list'].starterCode,
  correct: RLL_CORRECT,
  forLoopVariant: RLL_CORRECT.replace(
    'while cur:\n        nxt = cur.next\n        cur.next = prev\n        prev = cur\n        cur = nxt',
    'for _ in range(10000):\n        if cur is None:\n            break\n        nxt = cur.next\n        cur.next = prev\n        prev = cur\n        cur = nxt',
  ),
};

/* ---- (slug, step id, code, expect ok, expect note) ---- */

const CASES = [
  // two-sum: same 11 verdicts as scripts/test-guide-pilot.py
  ['two-sum', 'brute-force', TS.starter, false, false],
  ['two-sum', 'brute-force', TS.brute, true, false],
  ['two-sum', 'hash-idea', TS.brute, false, true],
  ['two-sum', 'hash-idea', TS.syntaxError, false, true],
  ['two-sum', 'hash-idea', TS.mid, true, false],
  ['two-sum', 'hash-idea', TS.midDictCall, true, true],
  ['two-sum', 'check-then-insert', TS.mid, false, false],
  ['two-sum', 'check-then-insert', TS.insertFirst, true, false],
  ['two-sum', 'check-then-insert', TS.optimal, true, false],
  ['two-sum', 'edge-duplicates', TS.insertFirst, false, true],
  ['two-sum', 'edge-duplicates', TS.optimal, true, false],
  // valid-palindrome
  ['valid-palindrome', 'normalize', VP.starter, true, true], // prefer-only rules: advisory
  ['valid-palindrome', 'normalize', VP.cleaned, true, false],
  ['valid-palindrome', 'implement', VP.starter, false, true],
  ['valid-palindrome', 'implement', VP.optimal, true, false],
  ['valid-palindrome', 'edges', VP.alphaBug, false, true],   // isalpha drops the digit in "0P"
  ['valid-palindrome', 'edges', VP.optimal, true, false],
  // reverse-linked-list
  ['reverse-linked-list', 'setup', RLL.starter, true, true], // defines ok, no While yet
  ['reverse-linked-list', 'rewire', RLL.starter, false, true],
  ['reverse-linked-list', 'rewire', RLL.correct, true, false],
  ['reverse-linked-list', 'edges', RLL.correct, true, false],
  ['reverse-linked-list', 'edges', RLL.forLoopVariant, true, false], // different shape, same behavior
];

const failures = [];
for (const [slug, stepId, code, wantOk, wantNote] of CASES) {
  const step = solutions[slug].guide.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`${slug} has no step "${stepId}"`);
  const program = genCheckProgram(code, step.check);
  const v = parseVerdict(runPython(program));
  if (!v) throw new Error(`${slug}/${stepId}: no verdict parsed`);
  const gotNote = v.notes.length > 0;
  const pass = v.ok === wantOk && gotNote === wantNote;
  if (!pass) failures.push({ slug, stepId, v });
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'}  ${slug}/${stepId}`.padEnd(46) +
    ` ok=${v.ok} note=${gotNote} <- ${code.split('\n')[0].slice(0, 36)}...`,
  );
}

console.log(`\n${CASES.length - failures.length}/${CASES.length} verdicts as expected.`);
if (failures.length) {
  for (const f of failures) console.log(`  unexpected: ${f.slug}/${f.stepId}: ${JSON.stringify(f.v)}`);
  process.exit(1);
}
