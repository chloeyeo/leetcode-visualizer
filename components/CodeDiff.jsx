'use client';

import { useMemo } from 'react';

/** Line-aligned LCS diff: rows tagged same / del (only in "yours") / add (only in optimal). */
function lcsDiff(aLines, bLines) {
  const m = aLines.length;
  const n = bLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) { rows.push({ l: aLines[i], r: bLines[j], t: 'same' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ l: aLines[i], r: null, t: 'del' }); i++; }
    else { rows.push({ l: null, r: bLines[j], t: 'add' }); j++; }
  }
  while (i < m) { rows.push({ l: aLines[i], r: null, t: 'del' }); i++; }
  while (j < n) { rows.push({ l: null, r: bLines[j], t: 'add' }); j++; }
  return rows;
}

/**
 * Side-by-side "your code vs. the optimal solution" diff.
 * @param {string} yours   the candidate's code
 * @param {string} optimal the gold-standard solution (from solutions.json `optimal`)
 * @param {string} [note]  caption (e.g. complexity of the optimal)
 */
export default function CodeDiff({ yours, optimal, note }) {
  const rows = useMemo(() => {
    if (!optimal) return [];
    const a = (yours || '').replace(/\n+$/, '').split('\n');
    const b = optimal.replace(/\n+$/, '').split('\n');
    return lcsDiff(a, b);
  }, [yours, optimal]);

  if (!optimal) return null;

  return (
    <div className="diff">
      <div className="diff-head">
        <span>Your code</span>
        <span>⚡ Gold-standard solution</span>
      </div>
      <div className="diff-body">
        {rows.map((row, i) => (
          <div className="diff-row" key={i}>
            <pre className={`diff-cell ${row.t === 'del' ? 'diff-del' : row.t === 'add' ? 'diff-gap' : ''}`}>{row.l ?? ''}</pre>
            <pre className={`diff-cell ${row.t === 'add' ? 'diff-add' : row.t === 'del' ? 'diff-gap' : ''}`}>{row.r ?? ''}</pre>
          </div>
        ))}
      </div>
      {note && <p className="section-note diff-note">{note}</p>}
    </div>
  );
}
