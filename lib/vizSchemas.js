/**
 * Input contracts for every pattern visualizer — the single source of truth.
 * Used by: the problem page (sanitize explicit viz fields), lib/vizInput.js
 * (derivation must emit valid shapes), scripts/gen-solutions.mjs (prompt spec +
 * ingest filter) and scripts/validate-viz.mjs / viz-coverage.mjs.
 *
 * Pure data + functions — no React, safe in both client components and Node.
 * Size caps are layout limits: bigger inputs overflow the SVG/track layouts.
 * See docs/viz-phase-plan.md for the human-readable table.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);

function numArray(v, min, max, { sorted = false, intOnly = false, nonNeg = false } = {}) {
  if (!Array.isArray(v)) return 'not an array';
  if (v.length < min || v.length > max) return `length ${v.length} outside ${min}..${max}`;
  if (!v.every(isNum)) return 'has non-numeric elements';
  if (intOnly && !v.every(isInt)) return 'has non-integer elements';
  if (nonNeg && v.some((x) => x < 0)) return 'has negative elements';
  if (sorted && v.some((x, i) => i > 0 && x < v[i - 1])) return 'not sorted ascending';
  return null;
}

/**
 * Each entry: { modes?, validate(input) -> string[] errors, normalize?(input) -> input }.
 * `spec` is the one-line shape description shown to the LLM in gen-solutions.
 */
const SCHEMAS = {
  'two-pointers': {
    spec:
      '{"mode":"two-pointers","array":[sorted numbers, 2-16],"target":number} | ' +
      '{"mode":"window","array":[numbers, 2-16],"k":int within array length} | ' +
      '{"mode":"palindrome","string":"1-48 chars"}',
    validate(input) {
      const errs = [];
      if (input.mode === 'palindrome') {
        if (typeof input.string !== 'string' || input.string.length < 1 || input.string.length > 48) {
          errs.push('palindrome: string must be 1..48 chars');
        }
      } else if (input.mode === 'window') {
        const e = numArray(input.array, 2, 16);
        if (e) errs.push(`window: array ${e}`);
        if (!isInt(input.k) || input.k < 1 || (Array.isArray(input.array) && input.k > input.array.length)) {
          errs.push('window: k must be an int in 1..array.length');
        }
      } else if (input.mode === 'two-pointers') {
        const e = numArray(input.array, 2, 16, { sorted: true });
        if (e) errs.push(`two-pointers: array ${e}`);
        if (!isNum(input.target)) errs.push('two-pointers: target must be a number');
      } else {
        errs.push(`unknown mode "${input.mode}" (two-pointers|window|palindrome)`);
      }
      return errs;
    },
  },

  'binary-search': {
    spec: '{"array":[sorted numbers, 2-16],"target":number}',
    validate(input) {
      const errs = [];
      const e = numArray(input.array, 2, 16, { sorted: true });
      if (e) errs.push(`array ${e}`);
      if (!isNum(input.target)) errs.push('target must be a number');
      if (input.targets !== undefined) {
        const t = numArray(input.targets, 1, 6);
        if (t) errs.push(`targets ${t}`);
      }
      return errs;
    },
  },

  'hash-map': {
    spec: '{"array":[numbers, 2-12],"target":number}',
    validate(input) {
      const errs = [];
      const e = numArray(input.array, 2, 12);
      if (e) errs.push(`array ${e}`);
      if (!isNum(input.target)) errs.push('target must be a number');
      return errs;
    },
  },

  // Linear Scan — the catch-all pattern every problem falls back to.
  scan: {
    spec: '{"array":[numbers, 2-14, each |n| < 100000]}',
    validate(input) {
      const e = numArray(input.array, 2, 14);
      if (e) return [`array ${e}`];
      if (input.array.some((n) => Math.abs(n) >= 100000)) return ['array values must stay below 100000 to stay readable'];
      return [];
    },
  },

  stack: {
    spec:
      '{"mode":"brackets","string":"1-24 chars incl. ()[]{}"} | ' +
      '{"mode":"monotonic","array":[numbers, 2-12]} | ' +
      '{"mode":"intervals","intervals":[[lo,hi] pairs, 2-8, lo<=hi]}',
    validate(input) {
      const errs = [];
      if (input.mode === 'brackets') {
        if (typeof input.string !== 'string' || input.string.length < 1 || input.string.length > 24) {
          errs.push('brackets: string must be 1..24 chars');
        } else if (![...input.string].some((c) => '()[]{}'.includes(c))) {
          errs.push('brackets: string contains no brackets');
        }
      } else if (input.mode === 'monotonic') {
        const e = numArray(input.array, 2, 12);
        if (e) errs.push(`monotonic: array ${e}`);
      } else if (input.mode === 'intervals') {
        if (!Array.isArray(input.intervals) || input.intervals.length < 2 || input.intervals.length > 8) {
          errs.push('intervals: need 2..8 [lo,hi] pairs');
        } else if (!input.intervals.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]) && p[0] <= p[1])) {
          errs.push('intervals: every pair must be [lo,hi] numbers with lo <= hi');
        }
      } else {
        errs.push(`unknown mode "${input.mode}" (brackets|monotonic|intervals)`);
      }
      return errs;
    },
  },

  'linked-list': {
    spec:
      '{"values":[numbers, 1-10]} | ' +
      '{"mode":"merge","listA":[sorted numbers, 0-8],"listB":[sorted numbers, 0-8]}',
    validate(input) {
      const errs = [];
      if (input.mode === 'merge') {
        const a = numArray(input.listA, 0, 8, { sorted: true });
        const b = numArray(input.listB, 0, 8, { sorted: true });
        if (a) errs.push(`merge: listA ${a}`);
        if (b) errs.push(`merge: listB ${b}`);
        if (Array.isArray(input.listA) && Array.isArray(input.listB) && !input.listA.length && !input.listB.length) {
          errs.push('merge: both lists empty');
        }
      } else {
        const e = numArray(input.values, 1, 10);
        if (e) errs.push(`values ${e}`);
      }
      return errs;
    },
  },

  graph: {
    spec: '{"mode":"islands","grid":[rows of "0"/"1" strings, 1-8 rows x 1-12 cols]}',
    validate(input) {
      const errs = [];
      const g = input.grid;
      if (!Array.isArray(g) || g.length < 1 || g.length > 8) {
        errs.push('grid must have 1..8 rows');
      } else if (!g.every((row) => Array.isArray(row) && row.length === g[0].length && row.length >= 1 && row.length <= 12)) {
        errs.push('grid rows must be equal length, 1..12 cols');
      } else if (!g.every((row) => row.every((c) => c === '0' || c === '1' || c === 0 || c === 1))) {
        errs.push('grid cells must be "0"/"1" (or 0/1)');
      }
      return errs;
    },
    normalize(input) {
      return { ...input, grid: input.grid.map((row) => row.map((c) => String(c))) };
    },
  },

  'tree-traversal': {
    spec:
      '{"mode":"traverse","tree":[level-order numbers/null, 1-15, root not null],"order":"preorder"|"inorder"|"postorder"|"level"} | ' +
      '{"mode":"invert","tree":[same]}',
    validate(input) {
      const errs = [];
      if (input.mode !== 'traverse' && input.mode !== 'invert') {
        errs.push(`unknown mode "${input.mode}" (traverse|invert)`);
        return errs;
      }
      const t = input.tree;
      if (!Array.isArray(t) || t.length < 1 || t.length > 15) errs.push('tree must be a level-order array of 1..15 entries');
      else {
        if (!t.every((v) => v === null || isNum(v))) errs.push('tree entries must be numbers or null');
        if (t[0] === null || t[0] === undefined) errs.push('tree root must not be null');
      }
      if (input.mode === 'traverse' && input.order !== undefined &&
          !['preorder', 'inorder', 'postorder', 'level'].includes(input.order)) {
        errs.push('order must be preorder|inorder|postorder|level');
      }
      return errs;
    },
  },

  'dp-grid': {
    spec:
      '{"mode":"unique-paths","rows":int 2-8,"cols":int 2-10} | ' +
      '{"mode":"min-path-sum","grid":[non-negative number rows, 2-6 rows x 2-8 cols]}',
    validate(input) {
      const errs = [];
      if (input.mode === 'unique-paths') {
        if (!isInt(input.rows) || input.rows < 2 || input.rows > 8) errs.push('unique-paths: rows must be int 2..8');
        if (!isInt(input.cols) || input.cols < 2 || input.cols > 10) errs.push('unique-paths: cols must be int 2..10');
      } else if (input.mode === 'min-path-sum') {
        const g = input.grid;
        if (!Array.isArray(g) || g.length < 2 || g.length > 6) errs.push('min-path-sum: grid must have 2..6 rows');
        else if (!g.every((row) => Array.isArray(row) && row.length === g[0].length && row.length >= 2 && row.length <= 8)) {
          errs.push('min-path-sum: rows must be equal length, 2..8 cols');
        } else if (!g.every((row) => !numArray(row, 2, 8, { nonNeg: true }))) {
          errs.push('min-path-sum: cells must be non-negative numbers');
        }
      } else {
        errs.push(`unknown mode "${input.mode}" (unique-paths|min-path-sum)`);
      }
      return errs;
    },
  },

  heap: {
    spec: '{"inserts":[numbers, 2-15]}',
    validate(input) {
      const e = numArray(input.inserts, 2, 15);
      return e ? [`inserts ${e}`] : [];
    },
  },

  backtracking: {
    spec: '{"elems":[1-4 numbers or short strings (<=3 chars)]}',
    validate(input) {
      const v = input.elems;
      if (!Array.isArray(v) || v.length < 1 || v.length > 4) return ['elems must have 1..4 entries'];
      if (!v.every((x) => isNum(x) || (typeof x === 'string' && x.length >= 1 && x.length <= 3))) {
        return ['elems entries must be numbers or 1..3-char strings'];
      }
      return [];
    },
  },

  trie: {
    spec: '{"words":[2-6 lowercase words, each 1-8 letters a-z, <=30 letters total]}',
    validate(input) {
      const v = input.words;
      if (!Array.isArray(v) || v.length < 2 || v.length > 6) return ['words must have 2..6 entries'];
      if (!v.every((w) => typeof w === 'string' && /^[a-z]{1,8}$/.test(w))) {
        return ['every word must match /^[a-z]{1,8}$/'];
      }
      if (v.reduce((n, w) => n + w.length, 0) > 30) return ['words total more than 30 letters'];
      return [];
    },
  },
};

export const VIZ_KEYS = Object.keys(SCHEMAS);

/**
 * Validate (and normalize) a `viz: {key, input}` field.
 * @returns {{ok: boolean, errors: string[], viz: object|null}} — `viz` is the
 * normalized copy when ok, null otherwise.
 */
export function validateViz(viz) {
  if (!viz || typeof viz !== 'object' || Array.isArray(viz)) {
    return { ok: false, errors: ['viz must be an object {key, input}'], viz: null };
  }
  const schema = SCHEMAS[viz.key];
  if (!schema) return { ok: false, errors: [`unknown key "${viz.key}"`], viz: null };
  if (!viz.input || typeof viz.input !== 'object' || Array.isArray(viz.input)) {
    return { ok: false, errors: ['input must be an object'], viz: null };
  }
  const errors = schema.validate(viz.input);
  if (errors.length) return { ok: false, errors, viz: null };
  const input = schema.normalize ? schema.normalize(viz.input) : viz.input;
  return { ok: true, errors: [], viz: { key: viz.key, input } };
}

/** Spec block for the gen-solutions prompt — kept in lockstep with the validators. */
export function vizPromptSpec() {
  return VIZ_KEYS.map((k) => `  "${k}": ${SCHEMAS[k].spec}`).join('\n');
}
