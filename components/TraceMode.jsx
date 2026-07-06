'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStepPlayer } from './useStepPlayer';
import { useTraceWorker } from './useTraceWorker';
import VizControls from './VizControls';
import { CodeView, DataStructures, VarTable, CallStack } from './TraceViews';
import ProblemStatement, { InlineCode } from './ProblemStatement';
import CodeDiff from './CodeDiff';
import GuideCoach from './GuideCoach';
import { starterFor, summaryTextFor } from '../lib/starter';
import { analyzeComplexity } from '../lib/analyzeComplexity';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

// CodeMirror is client-only — load it after mount so the static export stays clean.
const CodeEditor = dynamic(() => import('./CodeEditor'), {
  ssr: false,
  loading: () => <div className="pg-code-input pg-code-loading">Loading editor…</div>,
});

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

function ComplexityLint({ warnings }) {
  if (!warnings) return null;
  if (!warnings.length) {
    return <div className="cx-lint ok">✓ Complexity check: no hidden O(N) lookups inside loops.</div>;
  }
  return (
    <div className="cx-lint warn">
      <h3>⚠ Hidden complexity — {warnings.length} spot{warnings.length === 1 ? '' : 's'} that may be secretly O(N²)</h3>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>
            <span className="cx-loc">Line {w.line}</span>
            <code className="cx-code">{w.code}</code>
            <span className="cx-msg"><InlineCode text={w.msg} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The full trace-and-inspect experience: edit Python, run it in the Pyodide
 * worker, step through every line with live variables / call stack / data
 * structures, complexity lint, and the gold-standard diff when we have one.
 *
 * Used two ways:
 * - Playground page: <TraceMode autoLoadFromUrl /> — reads ?problem= etc.
 * - Problem pages:   <TraceMode initialCode={starter} problemSlug={slug} showSummary={false} />
 */
export default function TraceMode({
  initialCode = SAMPLE,
  problemSlug = null,
  autoLoadFromUrl = false,
  showSummary = true,
}) {
  const [code, setCode] = useState(initialCode);
  const [ranCode, setRanCode] = useState(initialCode);
  const [trace, setTrace] = useState([]);
  const [status, setStatus] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState(null);
  const [stdout, setStdout] = useState('');
  const [editing, setEditing] = useState(true);
  const [summary, setSummary] = useState(null);
  const [optimal, setOptimal] = useState(null);
  const [showGold, setShowGold] = useState(false);
  const [guide, setGuide] = useState(null);
  const [guideSlug, setGuideSlug] = useState(null);
  // GuideCoach registers its worker-message listener here (see routing below).
  const guideHandler = useRef(null);

  useEffect(() => {
    let slug = problemSlug;
    let title = null;
    if (autoLoadFromUrl) {
      const p = new URLSearchParams(window.location.search);
      slug = p.get('problem');
      if (!slug) return;
      title = p.get('title') || slug;
      const fallback = starterFor({
        slug,
        title,
        id: p.get('id') || '',
        difficulty: p.get('diff') || '',
        tags: (p.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
      });
      setCode(fallback);
      setRanCode(fallback);
    }
    if (!slug) return;
    // Prefer the curated blueprint + our own summary when we have one.
    fetch(`${BASE}/solutions.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const entry = d && d[slug];
        if (!entry) return;
        if (autoLoadFromUrl && entry.starterCode) { setCode(entry.starterCode); setRanCode(entry.starterCode); }
        if (showSummary) {
          const text = summaryTextFor(entry);
          if (text) setSummary({ title: title || slug, slug, text });
        }
        if (entry.optimal) setOptimal(entry.optimal);
        if (entry.guide) { setGuide(entry.guide); setGuideSlug(slug); }
      })
      .catch(() => {});
    // eslint-disable-next-line
  }, []);

  const worker = useTraceWorker((d) => {
    // Guide checks share this worker; route on id so their results never
    // clobber the trace UI state (docs/guided-coach-plan.md, Q2).
    if (typeof d.id === 'string' && d.id.indexOf('guide:') === 0) {
      if (guideHandler.current) guideHandler.current(d);
      return;
    }
    // A fatal worker error carries no id — unblock a pending guide check too.
    if (d.type === 'error' && !d.id && guideHandler.current) guideHandler.current(d);
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
  const complexityWarnings = useMemo(() => analyzeComplexity(code), [code]);
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
          <span>solution.py{traced ? ` · line ${frame.line}` : ''}</span>
        </div>
        {guide && guideSlug && (
          <GuideCoach
            slug={guideSlug}
            guide={guide}
            code={code}
            workerRef={worker}
            register={(fn) => { guideHandler.current = fn; }}
          />
        )}
        {traced ? (
          <div className="pg-editor-trace">
            <CodeView lines={codeLines} active={frame.line} />
            <div className="pg-run-bar">
              <VizControls player={player} />
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>✎ Edit</button>
            </div>
          </div>
        ) : (
          <>
            <CodeEditor value={code} onChange={setCode} ariaLabel="Python code" minHeight="320px" />
            <div className="pg-run-bar">
              <button className="btn btn-primary" onClick={run} disabled={status === 'busy'}>
                {status === 'busy' ? 'Running…' : '▶ Run'}
              </button>
            </div>
          </>
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
      <ComplexityLint warnings={complexityWarnings} />
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
