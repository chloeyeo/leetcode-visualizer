/**
 * Problem-specific visualizer inputs, parsed deterministically from the
 * sample call every starter blueprint ends with, e.g.
 *   print(two_sum([2, 7, 11, 15], 9))  # expected: [0, 1]
 *
 * No AI involved: whatever the entry's own example input is, the matched
 * pattern visualizer replays it. Conservative by design — when the sample
 * doesn't fit the pattern's contract (wrong shape, unsorted where the
 * technique requires sorted, too long to read), we return null and the
 * generic demo runs instead. Structured inputs (trees, graphs, DP tables)
 * are the follow-up phase in docs/viz-phase-plan.md.
 */

const MAX_CELLS = 14;

/** First numeric list literal + first standalone number after it. */
function parseSampleArgs(starterCode) {
  const code = String(starterCode || '');
  // Take the LAST call line (the sample run) to avoid signature defaults.
  const call = code.match(/print\s*\(\s*\w+\s*\(([\s\S]*?)\)\s*\)/g)?.pop();
  if (!call) return null;
  const args = call.slice(call.indexOf('(') + 1);
  // Nested lists (intervals, matrices, adjacency) are structured inputs the
  // flat-array visualizers can't honestly replay — leave those to the
  // generator phase rather than flattening them into nonsense.
  if (/\[\s*\[/.test(args)) return null;
  const listMatch = args.match(/\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*)\s*\]/);
  const array = listMatch ? listMatch[1].split(',').map((s) => Number(s.trim())) : null;
  const after = listMatch ? args.slice(args.indexOf(listMatch[0]) + listMatch[0].length) : args;
  const scalarMatch = after.match(/(?:^|,)\s*(-?\d+(?:\.\d+)?)\s*(?:,|\)|$)/);
  const target = scalarMatch ? Number(scalarMatch[1]) : null;
  const strMatch = args.match(/["']([^"']{1,24})["']/);
  return { array, target, string: strMatch ? strMatch[1] : null };
}

const isSortedAsc = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
const readable = (a) => Array.isArray(a) && a.length >= 2 && a.length <= MAX_CELLS && a.every((n) => Number.isFinite(n) && Math.abs(n) < 100000);

/**
 * Returns a per-pattern `input` object for PatternViz, or null to use the
 * generic demo. Only the numeric-array pattern family is wired here.
 */
export function vizInputFor(patternKey, starterCode) {
  const p = parseSampleArgs(starterCode);
  if (!p) return null;
  const { array, target, string } = p;
  switch (patternKey) {
    case 'hash-map':
      return readable(array) && typeof target === 'number' ? { array, target } : null;
    case 'two-pointers':
      // The converging-pointers walk narrates a sorted array — don't lie about unsorted samples.
      return readable(array) && typeof target === 'number' && isSortedAsc(array) ? { array, target } : null;
    case 'binary-search':
      return readable(array) && typeof target === 'number' && isSortedAsc(array) ? { array, target } : null;
    case 'linked-list':
      return readable(array) && array.length <= 10 ? { values: array } : null;
    case 'scan':
      return readable(array) ? { array } : null;
    case 'stack':
      return string && /^[()[\]{}]+$/.test(string) ? { string } : null;
    default:
      return null;
  }
}
