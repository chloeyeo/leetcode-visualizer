/**
 * L2 — deterministic viz-input derivation. Parses a problem's OWN first sample
 * input out of its solutions.json entry (examples text, falling back to the
 * starterCode sample call) and, when it can do so honestly, returns a
 * schema-valid `{key, input}` for the matching pattern visualizer.
 *
 * Philosophy: when in doubt, return null. A generic pattern demo is fine; an
 * animation that claims to run "this problem's own input" but shows the wrong
 * algorithm is worse than nothing. Every emitted shape passes validateViz().
 *
 * Pure Node/browser-safe module — used by the problem page at build time and
 * by scripts/viz-coverage.mjs.
 */

import { pickPattern } from './patterns.js';
import { validateViz } from './vizSchemas.js';

/* ---------------- parsing ---------------- */

/**
 * Balanced top-level [...] groups in a string. Quote-aware at depth 0 so
 * bracket characters inside a quoted literal (e.g. s = "()[]{}") are never
 * mistaken for array syntax — but quotes inside a group stay part of it
 * (word arrays like ["flow", "flight"]).
 */
function bracketGroups(text) {
  const groups = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (depth === 0 && (c === '"' || c === "'")) {
      const close = text.indexOf(c, i + 1);
      if (close !== -1) {
        i = close;
        continue;
      }
    }
    if (c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        groups.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return groups;
}

/** Tolerant JSON-ish array parse: single quotes, Python None. */
function parseArray(text) {
  try {
    const json = text
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false');
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function classify(arr) {
  if (!arr.length) return null;
  if (arr.every(isNum)) return { kind: 'flat-num', value: arr };
  if (arr.every((v) => v === null || isNum(v)) && arr[0] !== null) return { kind: 'level-order', value: arr };
  if (arr.every((v) => typeof v === 'string')) {
    if (arr.every((v) => v === '0' || v === '1')) return { kind: 'binary-row', value: arr };
    return { kind: 'str-array', value: arr };
  }
  if (arr.every((row) => Array.isArray(row) && row.length === arr[0].length && row.length >= 1)) {
    const cells = arr.flat();
    if (cells.every((c) => c === '0' || c === '1' || c === 0 || c === 1)) return { kind: 'grid-binary', value: arr };
    if (cells.every(isNum)) {
      if (arr[0].length === 2 && arr.length >= 2) return { kind: 'pairs', value: arr };
      return { kind: 'grid-num', value: arr };
    }
    if (cells.every((c) => typeof c === 'string')) return { kind: 'grid-str', value: arr };
  }
  return null;
}

/** The first example's INPUT portion — outputs/explanations cut off. */
function inputSegment(examples) {
  const cases = String(examples).split(/(?=Input\s*:)/i).filter((s) => s.trim());
  const seg = cases[0] || '';
  return seg.split(/Output\s*:|Explanation\s*:|Result\s*:|→|->|=>|\breturns?\b|\bbecause\b/i)[0];
}

/** The argument text of the starterCode's sample print() call. */
function starterCallSegment(starterCode) {
  const line = String(starterCode || '')
    .split('\n')
    .find((l) => l.includes('print('));
  if (!line) return '';
  return line.slice(line.indexOf('print(') + 'print('.length).replace(/#.*$/, '');
}

/** Extract typed values (arrays, quoted strings, named/bare scalars) from a segment. */
function extractValues(seg) {
  const arrays = bracketGroups(seg)
    .map(parseArray)
    .filter(Boolean)
    .map(classify)
    .filter(Boolean);

  // strings + scalars live OUTSIDE the bracket groups
  let rest = seg;
  for (const g of bracketGroups(seg)) rest = rest.replace(g, ' ');

  const strings = [];
  const strRe = /"([^"\n]{1,60})"|'([^'\n]{1,60})'/g;
  let m;
  while ((m = strRe.exec(rest))) strings.push(m[1] ?? m[2]);

  const scalars = {};
  const scRe = /\b(target|k|n|m)\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  while ((m = scRe.exec(rest))) scalars[m[1].toLowerCase()] = Number(m[2]);

  const bare = (rest.replace(strRe, ' ').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

  return { arrays, strings, scalars, bare };
}

function parseFirstExample(sol) {
  const exSeg = inputSegment(sol.examples || '');
  const fromExamples = extractValues(exSeg);
  if (fromExamples.arrays.length || fromExamples.strings.length) return { ...fromExamples, seg: exSeg, source: 'examples' };
  const stSeg = starterCallSegment(sol.starterCode);
  const fromStarter = extractValues(stSeg);
  if (fromStarter.arrays.length || fromStarter.strings.length || fromStarter.bare.length) {
    return { ...fromStarter, seg: stSeg, source: 'starter' };
  }
  return { ...fromExamples, seg: exSeg, source: 'none' };
}

/* ---------------- derivation ---------------- */

const sortedAsc = (a) => a.every((x, i) => i === 0 || x >= a[i - 1]);
const TRIE_COMMANDS = new Set(['trie', 'insert', 'search', 'startswith', 'worddictionary', 'addword', 'magicdictionary', 'buildict']);

/** Validate-or-null wrapper: only schema-clean shapes leave this module. */
function ok(key, input) {
  const r = validateViz({ key, input });
  return r.ok ? r.viz : null;
}

/**
 * Derive a `{key, input}` viz from a problem + its solutions.json entry.
 * Returns null whenever the sample input can't be mapped honestly.
 */
export function deriveViz(problem, sol) {
  if (!sol || typeof sol !== 'object') return null;
  const text = `${problem?.title || ''} ${sol.goal || sol.aiSummary || ''}`.toLowerCase();
  const { arrays, strings, scalars, bare, seg, source } = parseFirstExample(sol);

  const first = (kind) => arrays.find((a) => a.kind === kind)?.value;
  const flat = first('flat-num');
  const str = strings[0];
  // in starterCode calls scalars are positional; only trust a single bare number
  const scalar = (name) => (scalars[name] !== undefined ? scalars[name] : source === 'starter' && bare.length === 1 ? bare[0] : undefined);

  // Interval problems ride the stack/intervals mode even though their tags
  // (Array, Sorting) match no pattern — check before the tag dispatch.
  const pairs = first('pairs');
  if (pairs && /\binterval/.test(text)) {
    // insert-interval style: fold the separate [lo,hi] being inserted into the set
    const extra = /insert/.test(text) && flat && flat.length === 2 && flat[0] <= flat[1] ? [flat] : [];
    return ok('stack', { mode: 'intervals', intervals: [...pairs, ...extra] });
  }

  const pat = pickPattern(problem?.tags || []);
  if (!pat) return null;

  switch (pat.key) {
    case 'hash-map': {
      const target = scalar('target');
      if (flat && target !== undefined) return ok('hash-map', { array: flat, target });
      return null;
    }

    // Linear Scan is the catch-all fallback pattern — any readable flat
    // numeric sample can honestly ride its one-pass walk, PROVIDED the array
    // really is the input (starter call args, an "Input:" segment, or a
    // `name = [...]` binding) and not an enumerated answer list.
    case 'scan': {
      const isInput = source === 'starter' || /input\s*:/i.test(seg) || /\w+\s*=\s*\[/.test(seg);
      if (flat && isInput) return ok('scan', { array: flat });
      return null;
    }

    case 'two-pointers': {
      // whole-string palindrome CHECKS only — not longest-substring/count
      // variants (title-based: goals often use these words incidentally)
      if (str && /palindrome/.test(text) && !/longest|substring|partition|count/.test((problem?.title || '').toLowerCase())) {
        return ok('two-pointers', { mode: 'palindrome', string: str });
      }
      const target = scalar('target');
      // the pair walk answers "which TWO values sum to target" — triplet/other
      // variants only borrow the technique, so don't claim their input
      if (flat && target !== undefined && sortedAsc(flat) && /pair|two (numbers|values|elements|integers)|sum of two/.test(text)) {
        return ok('two-pointers', { mode: 'two-pointers', array: flat, target });
      }
      if (flat && scalars.k !== undefined && /window|subarray|substring|consecutive/.test(text)) {
        return ok('two-pointers', { mode: 'window', array: flat, k: scalars.k });
      }
      return null;
    }

    case 'binary-search': {
      const target = scalar('target');
      if (flat && target !== undefined && sortedAsc(flat)) return ok('binary-search', { array: flat, target });
      return null;
    }

    case 'stack': {
      if (str && [...str].every((c) => '()[]{}'.includes(c))) return ok('stack', { mode: 'brackets', string: str });
      // the monotonic walk resolves NEXT-GREATER questions — don't claim it for
      // next-smaller/histogram-style stack problems
      if (flat && /greater|warmer|temperature|next larger/.test(text)) {
        return ok('stack', { mode: 'monotonic', array: flat });
      }
      return null;
    }

    case 'linked-list': {
      const flats = arrays.filter((a) => a.kind === 'flat-num').map((a) => a.value);
      if (flats.length >= 2 && /merge/.test(text) && sortedAsc(flats[0]) && sortedAsc(flats[1])) {
        return ok('linked-list', { mode: 'merge', listA: flats[0], listB: flats[1] });
      }
      // the default animation IS a reversal — only claim it when the TITLE says
      // reversal (goals like add-two-numbers' "stored in reverse order" don't count)
      if (flat && /revers/.test((problem?.title || '').toLowerCase())) {
        return ok('linked-list', { values: flat });
      }
      return null;
    }

    case 'graph': {
      const grid = first('grid-binary');
      if (grid && /island|region|province|land/.test(text)) return ok('graph', { mode: 'islands', grid });
      return null;
    }

    case 'tree-traversal': {
      // Only treat an array as a tree when it's unambiguously the INPUT tree:
      // the example names it (`root = [...]`, "For root [...]"), it's a
      // level-order array (has nulls) in an explicit "Input:" segment, or it
      // came from the starterCode call with level-order nulls. This keeps
      // sorted-array inputs, preorder/inorder construction pairs, and
      // output-side tree lists out.
      const named = /\broot\b\s*[=:]?\s*\[/.test(seg);
      const tree = named
        ? first('level-order') || flat
        : /input\s*:/i.test(seg) || source === 'starter' ? first('level-order') : null;
      if (!tree) return null;
      if (/invert|mirror/.test(text)) return ok('tree-traversal', { mode: 'invert', tree });
      const order = /level[ -]?order/.test(text) ? 'level'
        : /in-?order/.test(text) ? 'inorder'
          : /post-?order/.test(text) ? 'postorder'
            : 'preorder';
      return ok('tree-traversal', { mode: 'traverse', tree, order });
    }

    case 'heap': {
      if (flat) return ok('heap', { inserts: flat });
      return null;
    }

    case 'backtracking': {
      if (flat && /subset/.test(text)) return ok('backtracking', { elems: flat });
      return null;
    }

    case 'trie': {
      const raw = first('str-array');
      if (!raw) return null;
      const words = [...new Set(raw.filter((w) => /^[a-z]{1,8}$/.test(w) && !TRIE_COMMANDS.has(w)))].slice(0, 6);
      if (words.length >= 2) return ok('trie', { words });
      return null;
    }

    case 'dp-grid': {
      // the table fills with the right/down recurrence — only problems that
      // actually walk top-left → bottom-right may claim it
      const walk = /min(imum)? path sum|unique paths?/.test(text) || (/top.?left/.test(text) && /bottom.?right/.test(text));
      if (!walk) return null;
      const grid = first('grid-num');
      if (grid) return ok('dp-grid', { mode: 'min-path-sum', grid });
      if (scalars.m !== undefined && scalars.n !== undefined) {
        return ok('dp-grid', { mode: 'unique-paths', rows: scalars.m, cols: scalars.n });
      }
      // starter calls pass dims positionally: uniquePaths(3, 2)
      if (source === 'starter' && bare.length === 2 && bare.every(Number.isInteger)) {
        return ok('dp-grid', { mode: 'unique-paths', rows: bare[0], cols: bare[1] });
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * The viz a problem page should render: explicit (schema-valid) viz field
 * first, derived sample-input replay second, null (⇒ tag-generic demo) last.
 */
export function resolveViz(problem, sol) {
  if (sol?.viz) {
    const r = validateViz(sol.viz);
    if (r.ok) return r.viz;
  }
  return deriveViz(problem, sol);
}
