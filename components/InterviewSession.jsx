'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PHASES, checklistFor, computeScorecard, starterCode } from '../lib/interview';
import { createBrain } from '../lib/interviewBrain';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const BRAIN_LABELS = { stub: 'Stub', claude: 'Claude', gemini: 'Gemini', custom: 'Custom' };

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function loadSettings() {
  if (typeof window === 'undefined') return { mode: 'stub' };
  try {
    return {
      mode: localStorage.getItem('iv_mode') || 'stub',
      key: localStorage.getItem('iv_key') || '',
      model: localStorage.getItem('iv_model') || '',
      model2: localStorage.getItem('iv_model2') || '',
      baseUrl: localStorage.getItem('iv_baseurl') || '',
    };
  } catch (e) { return { mode: 'stub' }; }
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
  const [thinking, setThinking] = useState(false);
  const [grading, setGrading] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  const recRef = useRef(null);
  const workerRef = useRef(null);
  const startedAt = useRef(Date.now());
  const transcriptEnd = useRef(null);

  const brain = useMemo(() => createBrain(settings), [settings]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSrSupported(!!SR);
    if (!SR) return undefined;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    let finalBuf = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalBuf += tr + ' '; else interim += tr;
      }
      setPending((finalBuf + interim).trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = { rec, reset: () => { finalBuf = ''; } };
    return () => { try { rec.stop(); } catch (e) { /* noop */ } };
  }, []);

  useEffect(() => {
    const intro = PHASES[0].enter;
    setTurns([{ role: 'interviewer', text: intro, phase: 0, t: 0 }]);
    speak(intro);
    // eslint-disable-next-line
  }, []);

  useEffect(() => { transcriptEnd.current?.scrollIntoView({ block: 'end' }); }, [turns, thinking]);

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

  const candidateText = useMemo(() => turns.filter((t) => t.role === 'candidate').map((t) => t.text).join(' '), [turns]);
  const checklist = checklistFor(phaseIndex, { text: candidateText + ' ' + pending, code, ran });

  async function commitTurn() {
    const text = pending.trim();
    if (!text || thinking) return;
    const candTurn = { role: 'candidate', text, phase: phaseIndex, t: elapsed };
    const base = [...turns, candTurn];
    const candidateAll = candidateText + ' ' + text;
    setTurns(base);
    setPending('');
    if (recRef.current) recRef.current.reset();
    setThinking(true);
    try {
      const { say, advance } = await brain.respond({
        problem, phaseIndex, transcript: base, candidateAll, code, ran,
        checklist: checklistFor(phaseIndex, { text: candidateAll, code, ran }),
      });
      const nextPhase = advance && phaseIndex < PHASES.length - 1 ? phaseIndex + 1 : phaseIndex;
      setTurns((t) => [...t, { role: 'interviewer', text: say, phase: nextPhase, t: elapsed }]);
      setPhaseIndex(nextPhase);
      speak(say);
    } catch (err) {
      setTurns((t) => [...t, { role: 'interviewer', text: `(coach error: ${err.message || err})`, phase: phaseIndex, t: elapsed }]);
    } finally {
      setThinking(false);
    }
  }

  async function endSession() {
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    if (recRef.current) { try { recRef.current.rec.stop(); } catch (e) { /* noop */ } }
    setListening(false);
    setGrading(true);
    try {
      const sc = await brain.grade({ turns, candidateText, code, ran, problem });
      setFinished(sc);
    } catch (err) {
      setFinished(computeScorecard({ turns, candidateText, code, ran }));
    } finally {
      setGrading(false);
    }
  }

  function saveSettings(next) {
    setSettings(next);
    try {
      localStorage.setItem('iv_mode', next.mode);
      localStorage.setItem('iv_key', next.key || '');
      localStorage.setItem('iv_model', next.model || '');
      localStorage.setItem('iv_model2', next.model2 || '');
      localStorage.setItem('iv_baseurl', next.baseUrl || '');
    } catch (e) { /* noop */ }
    setShowSettings(false);
  }

  if (finished) return <Scorecard problem={problem} card={finished} elapsed={elapsed} brain={brain.mode} onExit={onExit} />;

  return (
    <div className="iv">
      <div className="iv-bar">
        <div className="iv-bar-left">
          <button className="iv-exit" onClick={onExit} aria-label="Leave interview">&#8592;</button>
          <span className="iv-title">{problem.id}. {problem.title}</span>
          <span className={`diff ${problem.difficulty}`}>{problem.difficulty}</span>
          <span className={`iv-brain ${brain.mode}`}>{BRAIN_LABELS[brain.mode] || 'Stub'}</span>
        </div>
        <div className="iv-bar-right">
          <button className="iv-voice" onClick={() => setShowSettings(true)} aria-label="Interviewer settings">⚙</button>
          <button className={`iv-voice${voiceOn ? ' on' : ''}`} onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}>
            {voiceOn ? '🔊 Voice on' : '🔈 Voice off'}
          </button>
          <span className="iv-timer">{fmtTime(elapsed)}</span>
          <button className="btn btn-primary iv-end" onClick={endSession} disabled={grading}>{grading ? 'Grading…' : 'End & grade'}</button>
        </div>
      </div>

      {showSettings && <SettingsPanel settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />}

      <div className="iv-grid">
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
            {thinking && <div className="iv-turn interviewer"><span className="iv-who">Interviewer</span><p className="iv-thinking">…thinking</p></div>}
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
            <button className="btn btn-primary iv-done" onClick={commitTurn} disabled={!pending.trim() || thinking}>
              {thinking ? 'Interviewer…' : 'Done speaking →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSave, onClose }) {
  const [mode, setMode] = useState(settings.mode || 'stub');
  const [key, setKey] = useState(settings.key || '');
  const [model, setModel] = useState(settings.model || '');
  const [model2, setModel2] = useState(settings.model2 || '');
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl || '');
  return (
    <div className="iv-modal-backdrop" onClick={onClose}>
      <div className="iv-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Interviewer brain</h3>
        <label className="iv-radio"><input type="radio" checked={mode === 'stub'} onChange={() => setMode('stub')} /> Stub — free, scripted (no API)</label>
        <label className="iv-radio"><input type="radio" checked={mode === 'gemini'} onChange={() => setMode('gemini')} /> Gemini (Google) — free tier, works in-browser</label>
        <label className="iv-radio"><input type="radio" checked={mode === 'claude'} onChange={() => setMode('claude')} /> Claude (Anthropic)</label>
        <label className="iv-radio"><input type="radio" checked={mode === 'custom'} onChange={() => setMode('custom')} /> Custom OpenAI-compatible (OpenRouter, etc.)</label>

        {mode === 'gemini' && (
          <div className="iv-claude-fields">
            <label>Google AI Studio API key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" /></label>
            <label>Model<input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-2.5-flash" /></label>
            <p className="iv-note">Free key from aistudio.google.com. Stored only in your browser, sent directly to Google.</p>
          </div>
        )}
        {mode === 'claude' && (
          <div className="iv-claude-fields">
            <label>Anthropic API key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" /></label>
            <label>Conversation model<input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-haiku-4-5-20251001" /></label>
            <label>Grading model<input type="text" value={model2} onChange={(e) => setModel2(e.target.value)} placeholder="claude-sonnet-4-6" /></label>
          </div>
        )}
        {mode === 'custom' && (
          <div className="iv-claude-fields">
            <label>Base URL<input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /></label>
            <label>API key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" /></label>
            <label>Model<input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="provider/model:free" /></label>
            <p className="iv-note">Any OpenAI-compatible /chat/completions endpoint. Some providers block browser calls (CORS) — OpenRouter usually works; HF / Groq may need a proxy.</p>
          </div>
        )}

        <div className="iv-modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ mode, key, model, model2, baseUrl })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Scorecard({ problem, card, elapsed, brain, onExit }) {
  return (
    <div className="iv-scorecard">
      <button className="back-link" onClick={onExit}>&#8592; New interview</button>
      <div className="sc-head">
        <div>
          <h1>Interview scorecard</h1>
          <p className="sc-sub">{problem.id}. {problem.title} · {fmtTime(elapsed)} · {card.durationTurns} spoken turns · {brain === 'stub' ? 'heuristic grade' : `${BRAIN_LABELS[brain] || brain}-graded`}</p>
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
        {brain !== 'stub'
          ? `Graded by ${BRAIN_LABELS[brain] || brain} against the rubric. Feedback quality depends on the model and your transcript.`
          : 'Heuristic grade (keyword + behavior based). Switch the interviewer brain (⚙) to Gemini or Claude for nuanced, evidence-cited feedback — same scorecard format.'}
      </p>
    </div>
  );
}
