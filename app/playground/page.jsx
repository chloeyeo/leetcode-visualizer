'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useStepPlayer } from '../../components/useStepPlayer';
import { useTraceWorker } from '../../components/useTraceWorker';
import VizControls from '../../components/VizControls';
import { CodeView, DataStructures } from '../../components/TraceViews';
import TraceMode from '../../components/TraceMode';
import { analyzeComplexity } from '../../lib/analyzeComplexity';

// CodeMirror is client-only — load it after mount so the static export stays clean.
const CodeEditor = dynamic(() => import('../../components/CodeEditor'), {
  ssr: false,
  loading: () => <div className="pg-code-input pg-code-loading">Loading editor…</div>,
});

const BRUTE = `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]

print(two_sum([8, 3, 5, 7, 6, 2, 9, 1, 4, 11, 15], 26))
`;

const OPTIMAL = `def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([8, 3, 5, 7, 6, 2, 9, 1, 4, 11, 15], 26))
`;

export default function Playground() {
  const [mode, setMode] = useState('trace');
  return (
    <div>
      <Link className="back-link" href="/">&#8592; All problems</Link>
      <section className="hero">
        <h1>Code Playground <span className="beta-tag">prototype</span></h1>
        <p>
          Write Python, run it in a sandboxed Web Worker, and watch the real execution —
          arrays, trees, linked lists, graphs, local variables, and the call stack at every
          line. Runs fully in your browser via Pyodide.
        </p>
      </section>

      <div className="seg pg-modes" role="group" aria-label="Playground mode">
        <button className={mode === 'trace' ? 'active' : ''} onClick={() => setMode('trace')}>Trace &amp; inspect</button>
        <button className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>Compare two solutions</button>
        <button className={mode === 'scale' ? 'active' : ''} onClick={() => setMode('scale')}>Scale &amp; Big-O</button>
      </div>

      {mode === 'trace' && <TraceMode autoLoadFromUrl />}
      {mode === 'compare' && <CompareMode />}
      {mode === 'scale' && <ScaleMode />}

      <p className="viz-disclaimer pg-foot">
        Prototype · Python only · 4,000-step budget (infinite loops stop safely). Arrays,
        dicts, linked lists, binary trees and adjacency graphs of primitives render live;
        complex objects show as text.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Scale & Big-O mode */
const SCALE_NS = [10, 25, 50, 100, 250, 500];

// Count logical operations for the two Two Sum solutions on a worst-case input
// (the only matching pair sits at the very end, so brute force scans almost everything).
function twoSumSteps(n) {
  const nums = Array.from({ length: n }, (_, i) => i);
  const target = 2 * n - 3; // = (n-2) + (n-1): unique pair at the end
  let brute = 0;
  let bdone = false;
  for (let i = 0; i < n && !bdone; i++) {
    for (let j = i + 1; j < n; j++) { brute++; if (nums[i] + nums[j] === target) { bdone = true; break; } }
  }
  let opt = 0;
  const seen = new Set();
  for (let i = 0; i < n; i++) { opt++; if (seen.has(target - nums[i])) break; seen.add(nums[i]); }
  return { brute, opt };
}

function ScaleMode() {
  const rows = SCALE_NS.map((n) => ({ n, ...twoSumSteps(n) }));
  const max = Math.max(...rows.map((r) => r.brute));
  const last = rows[rows.length - 1];
  return (
    <div className="scale">
      <p className="section-note">
        Steps measure logical operations — the thing Big-O actually predicts (and what an interviewer grades),
        unlike milliseconds. Here&apos;s how the two Two&nbsp;Sum solutions grow as the input <b>N</b> increases,
        on a worst-case input where the matching pair sits at the end.
      </p>

      <div className="scale-badges">
        <span className="bigo-badge hard">Brute force · O(N²) time · O(1) space</span>
        <span className="bigo-badge easy">Optimal (hash map) · O(N) time · O(N) space</span>
      </div>

      <table className="scale-table">
        <thead>
          <tr><th>N</th><th>Brute force</th><th>Optimal</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n}>
              <td className="scale-n">{r.n}</td>
              <td>
                <div className="scale-bar"><div className="scale-fill hard" style={{ width: `${(r.brute / max) * 100}%` }} /></div>
                <span className="scale-num">{r.brute.toLocaleString()}</span>
              </td>
              <td>
                <div className="scale-bar"><div className="scale-fill easy" style={{ width: `${Math.max((r.opt / max) * 100, 0.5)}%` }} /></div>
                <span className="scale-num">{r.opt.toLocaleString()}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="viz-disclaimer">
        At N={last.n} the brute force already does <b>{last.brute.toLocaleString()}</b> steps versus just{' '}
        <b>{last.opt}</b> for the optimal — and the gap keeps widening quadratically. That&apos;s why O(N) beats O(N²).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Compare mode */
function CompareMode() {
  const [a, setA] = useState(BRUTE);
  const [b, setB] = useState(OPTIMAL);
  const [ranA, setRanA] = useState(BRUTE);
  const [ranB, setRanB] = useState(OPTIMAL);
  const [res, setRes] = useState({});
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [editing, setEditing] = useState(true);

  const worker = useTraceWorker((d) => {
    if (d.type === 'status') setStatusMsg(d.msg);
    else if (d.type === 'result') {
      setRes((r) => ({ ...r, [d.id]: { trace: d.trace || [], error: d.error, stdout: d.stdout } }));
    } else if (d.type === 'error') {
      setRes((r) => ({ ...r, [d.id || 'A']: { trace: [], error: d.message } }));
    }
  });

  const done = res.A && res.B;
  useEffect(() => {
    if (busy && done) { setBusy(false); setEditing(false); setStatusMsg(''); }
    // eslint-disable-next-line
  }, [res, busy]);

  const lenA = done ? res.A.trace.length : 0;
  const lenB = done ? res.B.trace.length : 0;
  const player = useStepPlayer(Math.max(lenA, lenB, 1));
  useEffect(() => { player.setStep(0); player.setPlaying(false); /* eslint-disable-next-line */ }, [lenA, lenB]);

  const maxSteps = done ? Math.max(lenA, lenB, 1) : 1;
  const fewer = done && lenA && lenB
    ? (lenA > lenB ? { winner: 'Optimal', ratio: lenA / lenB } : { winner: 'Brute force', ratio: lenB / lenA })
    : null;
  const frameA = !editing && lenA ? res.A.trace[Math.min(player.step, lenA - 1)] : null;
  const frameB = !editing && lenB ? res.B.trace[Math.min(player.step, lenB - 1)] : null;
  const linesA = useMemo(() => ranA.replace(/\n$/, '').split('\n'), [ranA]);
  const linesB = useMemo(() => ranB.replace(/\n$/, '').split('\n'), [ranB]);

  function run() {
    if (!worker.current) return;
    setBusy(true); setStatusMsg('Running both…'); setRes({});
    setRanA(a); setRanB(b);
    worker.current.postMessage({ type: 'run', id: 'A', code: a });
    worker.current.postMessage({ type: 'run', id: 'B', code: b });
  }

  return (
    <div>
      {editing && (
        <p className="section-note">
          Run two solutions on the same input and step through both at once — the same two
          panels turn into a synchronized, line-by-line walkthrough.
        </p>
      )}

      <div className="cmp-editors">
        <ComparePane title="Brute force" editing={editing} code={a} onChange={setA}
          lines={linesA} frame={frameA} />
        <ComparePane title="Optimal" editing={editing} code={b} onChange={setB}
          lines={linesB} frame={frameB} />
      </div>

      <div className="cmp-actions">
        {editing ? (
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? (statusMsg || 'Running…') : '▶ Run comparison'}
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => setEditing(true)}>✎ Edit code</button>
        )}
      </div>

      {!editing && done && (
        <div className="cmp-results">
          <CmpBar label="Brute force" len={lenA} err={res.A.error} max={maxSteps} tone="hard" />
          <CmpBar label="Optimal" len={lenB} err={res.B.error} max={maxSteps} tone="easy" />
          {fewer && (
            <p className="cmp-verdict">
              <b>{fewer.winner}</b> ran in <b>{fewer.ratio.toFixed(1)}×</b> fewer steps on this input.
            </p>
          )}
          <div className="cmp-step"><VizControls player={player} /></div>
        </div>
      )}

      {!editing && done && (
        <ComplexityBreakdown
          isDefaultPair={ranA === BRUTE && ranB === OPTIMAL}
          lenA={lenA} lenB={lenB} ranA={ranA} ranB={ranB}
        />
      )}
    </div>
  );
}

/**
 * The "so what" under the race: time AND space complexity, in words. Precise
 * for the built-in Two Sum pair; heuristic (measured steps + the hidden-
 * complexity detector) for user-pasted code.
 */
function ComplexityBreakdown({ isDefaultPair, lenA, lenB, ranA, ranB }) {
  const ratio = lenA && lenB ? (Math.max(lenA, lenB) / Math.min(lenA, lenB)).toFixed(1) : null;
  if (isDefaultPair) {
    return (
      <div className="cmp-explain">
        <h3>Why the optimal wins — time &amp; space, in detail</h3>
        <div className="cmp-explain-grid">
          <div>
            <h4>⏱ Time complexity</h4>
            <p>
              <span className="bigo-badge hard">Brute force · O(N²)</span> Nested loops: for every
              element it re-scans the rest of the array looking for a partner — about N²/2 pair
              checks in the worst case. That&apos;s why it needed <b>{lenA}</b> traced steps on this
              small input.
            </p>
            <p>
              <span className="bigo-badge easy">Optimal · O(N)</span> One pass. Each element does a
              single O(1) hash-map lookup (&quot;have I already seen <code className="inline-code">target − x</code>?&quot;)
              and a single O(1) insert. Same answer in <b>{lenB}</b> steps — {ratio}× fewer, and the
              gap widens quadratically as N grows (see the <b>Scale &amp; Big-O</b> tab).
            </p>
          </div>
          <div>
            <h4>💾 Space complexity</h4>
            <p>
              <span className="bigo-badge easy">Brute force · O(1)</span> Just two loop indices — no
              extra storage at all.
            </p>
            <p>
              <span className="bigo-badge hard">Optimal · O(N)</span> The hash map can grow to hold
              all N elements.
            </p>
            <p className="cmp-explain-note">
              That&apos;s the trade: the optimal <b>spends O(N) memory to buy O(1) lookups</b>,
              collapsing the inner O(N) scan entirely. Turning O(N²) time into O(N) for the price of
              O(N) space is almost always the right trade in an interview — and saying that trade
              out loud is exactly what earns the points.
            </p>
          </div>
        </div>
      </div>
    );
  }
  const warnA = analyzeComplexity(ranA);
  const warnB = analyzeComplexity(ranB);
  return (
    <div className="cmp-explain">
      <h3>Reading the result — time &amp; space</h3>
      <div className="cmp-explain-grid">
        <div>
          <h4>⏱ Time</h4>
          <p>
            On this input the left solution took <b>{lenA}</b> steps and the right took{' '}
            <b>{lenB}</b>{ratio ? <> — a <b>{ratio}×</b> gap</> : null}. A step gap on one input is a
            hint, not a proof: to see the real complexity, grow the input and watch how the gap
            grows — linear work doubles when N doubles, quadratic work quadruples.
          </p>
          {warnA.length > 0 && (
            <p>⚠ Brute-force side: line {warnA[0].line} does an O(N) list scan inside a loop — the classic hidden-O(N²) signature.</p>
          )}
          {warnB.length > 0 && (
            <p>⚠ Optimal side: line {warnB[0].line} does an O(N) list scan inside a loop — convert that list to a set/dict for O(1) lookups.</p>
          )}
        </div>
        <div>
          <h4>💾 Space</h4>
          <p>
            Extra dicts, sets, or arrays cost O(N) memory — but they usually <b>buy a lower time
            complexity</b> by replacing repeated O(N) scans with O(1) lookups. When you compare your
            two versions, name that trade explicitly: &quot;I&apos;m spending O(N) space to get the
            time from O(N²) down to O(N).&quot;
          </p>
        </div>
      </div>
    </div>
  );
}

function ComparePane({ title, editing, code, onChange, lines, frame }) {
  return (
    <div className="cmp-col">
      <div className="cmp-col-head">
        <span>{title}</span>
        {!editing && <small>{frame ? `line ${frame.line}` : 'finished'}</small>}
      </div>
      {editing ? (
        <CodeEditor value={code} onChange={onChange} ariaLabel={`${title} code`} minHeight="240px" />
      ) : (
        <>
          <CodeView lines={lines} active={frame ? frame.line : -1} />
          {frame && <DataStructures locals={frame.locals} prevLocals={null} />}
        </>
      )}
    </div>
  );
}

function CmpBar({ label, len, err, max, tone }) {
  const pct = err ? 0 : Math.max(4, (len / max) * 100);
  return (
    <div className="cmp-bar-row">
      <span className="cmp-bar-label">{label}</span>
      <div className="cmp-bar-track"><div className={`cmp-bar-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
      <span className="cmp-bar-val">{err ? 'error' : `${len} steps`}</span>
    </div>
  );
}
