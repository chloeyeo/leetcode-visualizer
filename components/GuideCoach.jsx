'use client';

import { useEffect, useRef, useState } from 'react';
import { genCheckProgram, parseVerdict } from '../lib/guideChecks';

/**
 * The guided thought-process coach — a docked strip INSIDE the editor region
 * (one-region rule: it never overlays the code; the user types while reading).
 * One authored step at a time: prompt → user edits code → OK → the step's
 * check program runs in the shared Pyodide worker → advance or nudge.
 * Hints escalate on failure; reveal is user-initiated after 3 tries; progress
 * persists per problem in localStorage. docs/guided-coach-plan.md is the spec.
 *
 * Worker messages come pre-routed from TraceMode via `register` (TraceMode
 * owns the worker; anything with an id starting "guide:" lands here).
 */
export default function GuideCoach({ slug, guide, code, workerRef, register }) {
  const steps = guide.steps;
  const storageKey = `guide:${slug}`;
  const [step, setStep] = useState(0);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fail, setFail] = useState(null);
  const [flash, setFlash] = useState(null);
  const [hintTier, setHintTier] = useState(-1);
  const [reveal, setReveal] = useState(false);
  // Persistence is gated until restore has applied: the persist effect would
  // otherwise fire on mount with default state and clobber saved progress
  // (StrictMode's double effect pass then re-reads the clobbered value).
  const [hydrated, setHydrated] = useState(false);
  const pending = useRef(null);

  // The register callback is bound once; read live state through a ref.
  const live = useRef({});
  live.current = { step, tries };

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (s && typeof s.step === 'number') {
        setStep(Math.max(0, Math.min(s.step, steps.length - 1)));
        setTries(s.tries || 0);
        setDone(!!s.done);
        setDismissed(!!s.dismissed);
      }
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ step, tries, done, dismissed }));
    } catch {}
  }, [hydrated, step, tries, done, dismissed, storageKey]);

  useEffect(() => {
    register((d) => {
      const p = pending.current;
      if (!p) return;
      if (d.type === 'result' && d.id === p.id) {
        pending.current = null;
        settle(parseVerdict(d.stdout));
      } else if (d.type === 'error' && (d.id === p.id || !d.id)) {
        pending.current = null;
        setChecking(false);
        setFail('The check could not run (' + (d.message || 'worker error') + ') — try Run, then OK again.');
      }
    });
    return () => register(null);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  function failMessage(v) {
    if (!v) return 'The check could not run — press Run to see the error, then try OK again.';
    const human = (v.notes || []).filter((n) => !/^rule:\d+$/.test(n));
    if (v.failed.indexOf('syntax') !== -1) {
      return "Your code doesn't parse yet — " + (human[0] || 'fix the syntax error and try again.');
    }
    if (human.length) return 'Not yet — ' + human[0];
    return "Not yet — the code's shape doesn't match this step. Try the hint.";
  }

  function settle(v) {
    setChecking(false);
    const { step: s, tries: t } = live.current;
    if (v && v.ok) {
      advance(v.notes.length > 0);
    } else {
      const nt = t + 1;
      setTries(nt);
      setHintTier(Math.min(nt - 1, (steps[s].hints || []).length - 1));
      setFail(failMessage(v));
    }
  }

  function advance(withNote) {
    const { step: s } = live.current;
    setFail(null);
    setReveal(false);
    setHintTier(-1);
    setTries(0);
    if (s >= steps.length - 1) {
      setDone(true);
    } else {
      setStep(s + 1);
      setFlash(withNote
        ? '✓ Passed — you took a different route than the intended one; peek at the hint if curious.'
        : '✓ That works.');
    }
  }

  function onOk() {
    const st = steps[live.current.step];
    const program = genCheckProgram(code, st.check);
    if (!program) {
      advance(false);
      return;
    }
    if (!workerRef.current) {
      setFail('The Python runtime is not available — reload the page.');
      return;
    }
    const id = 'guide:' + slug + ':' + st.id + ':' + Date.now();
    pending.current = { id };
    setChecking(true);
    setFail(null);
    workerRef.current.postMessage({ type: 'run', id, code: program });
  }

  function restart() {
    setStep(0); setTries(0); setDone(false); setDismissed(false);
    setFail(null); setFlash(null); setHintTier(-1); setReveal(false);
  }

  if (dismissed) {
    return (
      <div className="guide-strip guide-strip-min">
        <button className="guide-chip" onClick={() => setDismissed(false)}>
          💡 Guide ({done ? 'done' : `step ${step + 1}/${steps.length}`}) — resume
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="guide-strip">
        <div className="guide-head">
          <span className="guide-progress">💡 Guide</span>
          <strong className="guide-title">🎉 You built it yourself — guide complete.</strong>
          <span className="guide-head-btns">
            <button title="Hide guide" onClick={() => setDismissed(true)}>✕</button>
          </span>
        </div>
        <div className="guide-actions">
          <button className="btn btn-ghost guide-btn" onClick={restart}>Restart guide</button>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="guide-strip guide-strip-min">
        <button className="guide-chip" onClick={() => setCollapsed(false)}>
          💡 Guide · step {step + 1}/{steps.length} · {steps[step].title} — expand
        </button>
      </div>
    );
  }

  const st = steps[step];
  const hints = st.hints || [];
  const hasCheck = st.check && st.check.type !== 'ok' && st.check.type !== 'llm';

  return (
    <div className="guide-strip">
      <div className="guide-head">
        <span className="guide-progress">💡 Guide · step {step + 1}/{steps.length}</span>
        <strong className="guide-title">{st.title}</strong>
        <span className="guide-head-btns">
          <button title="Collapse guide" onClick={() => setCollapsed(true)}>–</button>
          <button title="End guide" onClick={() => setDismissed(true)}>✕</button>
        </span>
      </div>
      {flash && <p className="guide-flash">{flash}</p>}
      <p className="guide-prompt">{st.prompt}</p>
      {hintTier >= 0 && hints.length > 0 && (
        <p className="guide-hint">Hint: {hints[Math.min(hintTier, hints.length - 1)]}</p>
      )}
      {fail && <p className="guide-fail">{fail}</p>}
      {reveal && st.reveal && <pre className="guide-reveal">{st.reveal}</pre>}
      <div className="guide-actions">
        <button className="btn btn-primary guide-btn" onClick={onOk} disabled={checking}>
          {checking ? 'Checking…' : hasCheck ? 'OK — check my code' : 'OK — next'}
        </button>
        {hints.length > 0 && (
          <button
            className="btn btn-ghost guide-btn"
            onClick={() => setHintTier((h) => Math.min(h + 1, hints.length - 1))}
          >
            Hint
          </button>
        )}
        {st.reveal && tries >= 3 && !reveal && (
          <button className="btn btn-ghost guide-btn" onClick={() => setReveal(true)}>
            Show me this step
          </button>
        )}
        <button className="btn btn-ghost guide-btn guide-skip" onClick={() => advance(false)}>
          Skip
        </button>
      </div>
      {checking && (
        <p className="guide-checking-note">The first check loads the Python runtime — a few seconds.</p>
      )}
    </div>
  );
}
