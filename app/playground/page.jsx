'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useStepPlayer } from '../../components/useStepPlayer';
import { useTraceWorker } from '../../components/useTraceWorker';
import VizControls from '../../components/VizControls';
import { CodeView, DataStructures, VarTable, CallStack } from '../../components/TraceViews';
import ProblemStatement from '../../components/ProblemStatement';
import CodeDiff from '../../components/CodeDiff';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

// CodeMirror is client-only — load it after mount so the static export stays clean.
const CodeEditor = dynamic(() => import('../../components/CodeEditor'), {
  ssr: false,
  loading: () => <div className="pg-code-input pg-code-loading">Loading editor…</div>,
});

function ProblemSummary({ summary }) {
  return (
    <section className="prob-statement pg-prob">
      <div className="prob-statement-head">
        <h2 className="section-title lead">{summary.title}</h2>
        <a className="inline-link" href={`https://leetcode.com/problems/${summary.slug}/`} target="_blank" rel="noreferrer">
          Original on LeetCode ↗
        </a>
      </div>
      <ProblemStatement sol={{ aiSummary: summary.text }} compact />
    </section>
  );
}

const SAMPLE = `def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i

result = two_sum([2, 7, 11, 15], 9)
print("indices:", result)
`;

const BRUTE = `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]

print(two_sum([2, 7, 11, 15, 1, 8], 9))
`;

const OPTIMAL = `def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([2, 7, 11, 15, 1, 8], 9))
`;

function starterFor(title, id, slug) {
  return `# ${title}${id ? ` (LeetCode #${id})` : ''}\n# https://leetcode.com/problems/${slug}/\n\ndef solution():\n    # TODO: implement\n    pass\n\nprint(solution())\n`;
}

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
      </div>

      {mode === 'trace' ? <TraceMode /> : <CompareMode />}

      <p className="viz-disclaimer pg-foot">
        Prototype · Python only · 4,000-step budget (infinite loops stop safely). Arrays,
        dicts, linked lists, binary trees and adjacency graphs of primitives render live;
        complex objects show as text.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Trace mode */
function TraceMode() {
  const [code, setCode] = useState(SAMPLE);
  const [ranCode, setRanCode] = useState(SAMPLE);
  const [trace, setTrace] = useState([]);
  const [status, setStatus] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState(null);
  const [stdout, setStdout] = useState('');
  const [editing, setEditing] = useState(true);
  const [summary, setSummary] = useState(null);
  const [optimal, setOptimal] = useState(null);
  const [showGold, setShowGold] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const slug = p.get('problem');
    if (!slug) return;
    const title = p.get('title') || slug;
    const fallback = starterFor(title, p.get('id'), slug);
    setCode(fallback);
    setRanCode(fallback);
    // Prefer the curated blueprint + our own summary when we have one.
    fetch(`${BASE}/solutions.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const entry = d && d[slug];
        if (!entry) return;
        if (entry.starterCode) { setCode(entry.starterCode); setRanCode(entry.starterCode); }
        if (entry.aiSummary) setSummary({ title, slug, text: entry.aiSummary });
        if (entry.optimal) setOptimal(entry.optimal);
      })
      .catch(() => {});
  }, []);

  const worker = useTraceWorker((d) => {
    if (d.type === 'status') setStatusMsg(d.msg);
    else if (d.type === 'result') {
      setTrace(d.trace || []); setError(d.error || null); setStdout(d.stdout || '');
      setStatus('done'); setStatusMsg(''); setEditing(false);
    } else if (d.type === 'error') { setError(d.message); setStatus('error'); setStatusMsg(''); }
  });

  const player = useStepPlayer(Math.max(trace.length, 1));
  useEffect(() => { player.setStep(0); player.setPlaying(false); /* eslint-disable-next-line */ }, [trace]);

  const frame = trace.length ? trace[Math.min(player.step, trace.length - 1)] : null;
  const prevFrame = trace.length && player.step > 0 ? trace[player.step - 1] : null;
  const codeLines = useMemo(() => ranCode.replace(/\n$/, '').split('\n'), [ranCode]);
  const traced = !editing && status === 'done' && !!frame;

  function run() {
    if (!worker.current) return;
    setStatus('busy'); setStatusMsg('Starting…'); setError(null); setTrace([]); setStdout('');
    setRanCode(code);
    worker.current.postMessage({ type: 'run', id: 'trace', code });
  }

  return (
    <>
      {summary && <ProblemSummary summary={summary} />}
      <div className="pg-grid">
      <div className="pg-editor">
        <div className="pg-editor-head">
          <span>{summary ? 'solution.py' : 'main.py'}{traced ? ` · line ${frame.line}` : ''}</span>
          {traced ? (
            <button className="btn btn-ghost pg-run" onClick={() => setEditing(true)}>✎ Edit</button>
          ) : (
            <button className="btn btn-primary pg-run" onClick={run} disabled={status === 'busy'}>
              {status === 'busy' ? 'Running…' : '▶ Run'}
            </button>
          )}
        </div>
        {traced ? (
          <div className="pg-editor-trace">
            <CodeView lines={codeLines} active={frame.line} />
            <VizControls player={player} />
          </div>
        ) : (
          <CodeEditor value={code} onChange={setCode} ariaLabel="Python code" minHeight="320px" />
        )}
      </div>

      <div className="pg-trace">
        {status === 'busy' && <p className="loading">{statusMsg || 'Working…'}</p>}
        {!traced && status === 'idle' && (
          <div className="pg-hint">Press <b>Run</b> to execute. The code on the left highlights line-by-line; variables, call stack, data structures and output appear here. The first run downloads the Python runtime (a few seconds).</div>
        )}
        {!traced && status === 'done' && editing && (
          <div className="pg-hint">Editing — press <b>Run</b> again to re-trace.</div>
        )}
        {status === 'error' && <div className="pg-error">⚠ {error}</div>}

        {traced && (
          <>
            <DataStructures locals={frame.locals} prevLocals={prevFrame ? prevFrame.locals : null} />
            <div className="pg-panels">
              <div className="pg-panel">
                <h3>Variables <small>frame: {frame.func}</small></h3>
                <VarTable locals={frame.locals} />
              </div>
              <div className="pg-panel">
                <h3>Call stack <small>depth {frame.depth}</small></h3>
                <CallStack frame={frame} />
              </div>
            </div>
            {error && <div className="pg-error">⚠ {error}</div>}
            {stdout && <div className="pg-stdout"><h3>Output</h3><pre>{stdout}</pre></div>}
          </>
        )}
      </div>
      </div>
      {optimal && (
        <div className="pg-gold">
          <button className="btn btn-ghost" onClick={() => setShowGold((s) => !s)}>
            {showGold ? 'Hide gold-standard solution' : '⚡ Reveal gold-standard solution'}
          </button>
          {showGold && <CodeDiff yours={code} optimal={optimal} note="Optimal reference solution — diff your code against it." />}
        </div>
      )}
    </>
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
