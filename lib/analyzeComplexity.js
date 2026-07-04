/**
 * Hidden-complexity detector — heuristic static check that flags O(N)
 * operations hiding inside loops, the classic "secretly O(N²)" trap
 * (e.g. `x in some_list`, `.index()`, `.count()` on a list). Lookups on
 * sets/dicts are O(1) and are NOT flagged. Python-oriented, best-effort.
 * Pure function — shared by the Trace editor lint and the Compare breakdown.
 */
export function analyzeComplexity(code) {
  const lines = (code || '').replace(/\r/g, '').split('\n').map((l) => l.split('#')[0]);
  const kind = {}; // name -> 'list' | 'dict' | 'set'

  // 1) Explicit assignments decide kind first (so O(1) structures are never flagged).
  for (const ln of lines) {
    const m = ln.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const name = m[1];
    const rhs = m[2];
    if (/^set\s*\(/.test(rhs)) kind[name] = 'set';
    else if (/^dict\s*\(/.test(rhs)) kind[name] = 'dict';
    else if (/^\{/.test(rhs)) kind[name] = (/:/.test(rhs) || /^\{\s*\}$/.test(rhs)) ? 'dict' : 'set';
    else if (/^\[/.test(rhs) || /^list\s*\(/.test(rhs)) kind[name] = 'list';
  }
  // 2) Infer list-like for still-unknown names from usage (indexing / len / list methods).
  const text = lines.join('\n');
  const infer = (re) => { for (const m of text.matchAll(re)) if (!kind[m[1]]) kind[m[1]] = 'list'; };
  infer(/\b([A-Za-z_]\w*)\s*\[/g);
  infer(/\blen\s*\(\s*([A-Za-z_]\w*)\s*\)/g);
  infer(/\b([A-Za-z_]\w*)\.(?:append|sort|insert|extend|index|count)\b/g);

  // 3) Walk lines; flag O(N) ops that sit inside a loop body.
  const warnings = [];
  const loopIndents = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    while (loopIndents.length && indent <= loopIndents[loopIndents.length - 1]) loopIndents.pop();
    const inLoop = loopIndents.length > 0;
    const isForHeader = /^\s*for\b/.test(raw);
    const isLoopHeader = /^\s*(for|while)\b/.test(raw);

    if (inLoop && !isForHeader) {
      for (const m of raw.matchAll(/(?:\bnot\s+)?\bin\s+([A-Za-z_]\w*)\b/g)) {
        if (kind[m[1]] === 'list') {
          warnings.push({ line: i + 1, code: raw.trim(), msg: `\`in ${m[1]}\` scans the whole list (O(N)). Inside this loop that's ~O(N²) — convert ${m[1]} to a set/dict for O(1) lookups.` });
        }
      }
      const dot = raw.match(/\b([A-Za-z_]\w*)\.(index|count)\s*\(/);
      if (dot && kind[dot[1]] === 'list') {
        warnings.push({ line: i + 1, code: raw.trim(), msg: `\`${dot[1]}.${dot[2]}(…)\` is O(N). Inside this loop that's ~O(N²).` });
      }
    }
    if (isLoopHeader) loopIndents.push(indent);
  }
  return warnings;
}
