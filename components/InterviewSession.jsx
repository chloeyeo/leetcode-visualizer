'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PHASES, checklistFor, evaluateTurn, computeScorecard, starterCode,
} from '../lib/interview';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function InterviewSession({ problem, onExit }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [turns, setTurns] = useState([]);
  const [pending, setPending] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [code, setCode] = useState(() => starterCode(problem));
  const [ran, setRan] = useState(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(null);
  const [srSupported, setSrSupported] = useState(false);

  const recRef = useRef(null);
  const workerRef = useRef(null);
  const startedAt = useRef(Date.now());
  const transcriptEnd = useRef(null);

  // timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // code-runner worker (reuses the Pyodide trace worker)
  useEffect(() => {
    const w = new Worker(`${BASE}/trace-worker.js`);
    workerRef.current = w;
    w.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === 'result') {
        setRan({ ok: !d.error && (d.trace || []).length > 0, stdout: d.stdout || '', error: d.error || null });
        setRunning(false);
      } else if (d.type === 'error') { setRan({ ok: false, error: d.message }); setRunning(false); }
    };
    return () => w.terminate();
  }, []);

  // speech recognition (Chrome/Edge). Falls back to typing if unsupported.
  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSrSupported(!!SR);
    if (!SR) return undefined;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    let finalBuf = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalBuf += tr + ' ';
        else interim += tr;
      }
      setPending((finalBuf + interim).trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = { rec, reset: () => { finalBuf = ''; } };
    return () => { try { rec.stop(); } catch (e) { /* noop */ } };
  }, []);

  // opening line
  useEffect(() => {
    const intro = PHASES[0].enter;
    setTurns([{ role: 'interviewer', text: intro, phase: 0, t: 0 }]);
    speak(intro);
    // eslint-disable-next-line
  }, []);

  useEffect(() => { transcriptEnd.current?.scrollIntoView({ block: 'end' }); }, [turns]);

  function speak(text) {
    if (!voiceOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch (e) { /* noop */ }
  }

  function toggleMic() {
    const r = recRef.current;
    if (!r) return;
    if (listening) { try { r.rec.stop(); } catch (e) { /* noop */ } setListening(false); }
    else { try { r.reset(); setPending(''); r.rec.start(); setListening(true); } catch (e) { /* noop */ } }
  }

  function runCode() {
    if (!workerRef.current) return;
    setRunning(true);
    workerRef.current.postMessage({ type: 'run', id: 'iv', code });
  }

  const candidateText = useMemo(
    () => turns.filter((t) => t.role === 'candidate').map((t) => t.text).join(' '),
    [turns]
  );
  const liveCtx = { text: candidateText + ' ' + pending, code, ran };
  const checklist = checklistFor(phaseIndex, liveCtx);

  function commitTurn() {
    const text = pending.trim();
    if (!text) return;
    const ctx = { text: candidateText + ' ' + text, code, ran };
    const res = evaluateTurn(phaseIndex, ctx);
    let line;
    let nextPhase = phaseIndex;
    if (res.complete && phaseIndex < PHASES.length - 1) {
      nextPhase = phaseIndex + 1;
      line = res.ack + ' ' + PHASES[nextPhase].enter;
    } else if (res.complete) {
      line = res.ack + " That's a good place to stop — end the session to see your scorecard.";
    } else {
      line = res.nudge;
    }
    setTurns((t) => [...t, { role: 'candidate', text, phase: phaseIndex, t: elapsed }, { role: 'interviewer', text: line, phase: nextPhase, t: elapsed }]);
    setPhaseIndex(nextPhase);
    setPending('');
    if (recRef.current) recRef.current.reset();
    speak(line);
  }

  function endSession() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    if (recRef.current) { try { recRef.current.rec.stop(); } catch (e) { /* noop */ } }
    setListening(false);
    setFinished(computeScorecard({ turns, candidateText, code, ran }));
  }

  if (finished) return <Scorecard problem={problem} card={finished} elapsed={elapsed} onExit={onExit} />;

  return (
    <div className="iv">
      <div className="iv-bar">
        <div className="iv-bar-left">
          <button className="iv-exit" onClick={onExit} aria-label="Leave interview">&#8592;</button>
          <span className="iv-title">{problem.id}. {problem.title}</span>
          <span className={`diff ${problem.difficulty}`}>{problem.difficulty}</span>
        </div>
        <div className="iv-bar-right">
          <button className={`iv-voice${voiceOn ? ' on' : ''}`} onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}>
            {voiceOn ? '🔊 Voice on' : '🔈 Voice off'}
          </button>
          <span className="iv-timer">{fmtTime(elapsed)}</span>
          <button className="btn btn-primary iv-end" onClick={endSession}>End &amp; grade</button>
        </div>
      </div>

      <div className="iv-grid">
        {/* LEFT: code */}
        <div className="iv-left">
          <div className="pg-editor">
            <div className="pg-editor-head">
              <span>solution.py</span>
              <button className="btn btn-primary pg-run" onClick={runCode} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
            </div>
            <textarea className="pg-code-input" spellCheck={false} value={code}
              onChange={(e) => setCode(e.target.value)} aria-label="Solution code" />
          </div>
          {ran && (ran.error ? <div className="pg-error">⚠ {ran.error}</div>
            : <div className="pg-stdout"><h3>Output</h3><pre>{ran.stdout || '(no output)'}</pre></div>)}
          <a className="inline-link iv-lc" href={`https://leetcode.com/problems/${problem.slug}/`} target="_blank" rel="noreferrer">
            Open the full problem on LeetCode ↗
          </a>
        </div>

        {/* RIGHT: interviewer + transcript + talk */}
        <div className="iv-right">
          <div className="iv-phases">
            {PHASES.map((p, i) => (
              <span key={p.id} className={`iv-phase${i === phaseIndex ? ' current' : i < phaseIndex ? ' done' : ''}`}>{p.label}</span>
            ))}
          </div>

          <div className="iv-objective">
            <strong>{PHASES[phaseIndex].label}:</strong> {PHASES[phaseIndex].objective}
            <ul className="iv-checklist">
              {checklist.map((c) => (
                <li key={c.id} className={c.done ? 'done' : ''}>{c.done ? '✓' : '○'} {c.label}</li>
              ))}
            </ul>
          </div>

          <div className="iv-transcript">
            {turns.map((t, i) => (
              <div key={i} className={`iv-turn ${t.role}`}>
                <span className="iv-who">{t.role === 'interviewer' ? 'Interviewer' : 'You'}</span>
                <p>{t.text}</p>
              </div>
            ))}
            <div ref={transcriptEnd} />
          </div>

          <div className="iv-talk">
            {srSupported && (
              <button className={`iv-mic${listening ? ' live' : ''}`} onClick={toggleMic}>
                {listening ? '● Listening… (stop)' : '🎤 Speak'}
              </button>
            )}
            <textarea
              className="iv-pending"
              placeholder={srSupported ? 'Your words appear here as you speak — or type to edit…' : 'Type your spoken reasoning here (your browser has no speech recognition)…'}
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              aria-label="Your response"
            />
            <button className="btn btn-primary iv-done" onClick={commitTurn} disabled={!pending.trim()}>Done speaking →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scorecard({ problem, card, elapsed, onExit }) {
  return (
    <div className="iv-scorecard">
      <button className="back-link" onClick={onExit}>&#8592; New interview</button>
      <div className="sc-head">
        <div>
          <h1>Interview scorecard</h1>
          <p className="sc-sub">{problem.id}. {problem.title} · {fmtTime(elapsed)} · {card.durationTurns} spoken turns</p>
        </div>
        <div className={`sc-grade g-${card.grade}`}>
          <span className="sc-grade-letter">{card.grade}</span>
          <span className="sc-grade-num">{card.overall}/100</span>
        </div>
      </div>

      <div className="sc-dims">
        {card.dims.map((d) => (
          <div className="sc-dim" key={d.name}>
            <div className="sc-dim-head">
              <span className="sc-dim-name">{d.name}</span>
              <span className="sc-dim-score">{d.score}/4</span>
            </div>
            <div className="sc-bar"><div className="sc-bar-fill" style={{ width: `${(d.score / 4) * 100}%` }} /></div>
            {d.evidence && <p className="sc-evidence">{d.evidence}</p>}
          </div>
        ))}
      </div>

      <div className="sc-actions">
        <h3>Top 3 things to work on</h3>
        <ol>{card.actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
      </div>

      <p className="viz-disclaimer">
        Prototype grading is heuristic (keyword + behavior based). A real interviewer model can later
        replace it for nuanced, evidence-cited feedback — same scorecard format.
      </p>
    </div>
  );
}
