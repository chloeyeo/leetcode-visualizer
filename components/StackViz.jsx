'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const TEMPS = [73, 74, 75, 71, 69, 72, 76, 73];

function buildFrames() {
  const res = Array(TEMPS.length).fill(0);
  const st = [];
  const frames = [];
  for (let i = 0; i < TEMPS.length; i++) {
    while (st.length && TEMPS[st[st.length - 1]] < TEMPS[i]) {
      const idx = st.pop();
      res[idx] = i - idx;
      frames.push({ i, stack: [...st], result: [...res], popped: idx, note: `Day ${i} (${TEMPS[i]}°) beats day ${idx} (${TEMPS[idx]}°): answer[${idx}] = ${i - idx} day(s). Pop it.` });
    }
    st.push(i);
    frames.push({ i, stack: [...st], result: [...res], pushed: i, note: `Push day ${i} (${TEMPS[i]}°) — it's now waiting for a warmer day.` });
  }
  frames.push({ i: TEMPS.length, stack: [...st], result: [...res], done: true, note: 'Done. Days still on the stack have no warmer future day → 0.' });
  return frames;
}

const FRAMES = buildFrames();

/* ---------- Brackets mode (valid-parentheses) ---------- */
const PAIRS = { ')': '(', ']': '[', '}': '{' };
const OPENERS = new Set(['(', '[', '{']);

function buildBracketFrames(s) {
  const chars = [...s];
  const frames = [];
  const stack = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (OPENERS.has(c)) {
      stack.push(i);
      frames.push({ i, stack: [...stack], note: `'${c}' is an opener — push it onto the stack.` });
    } else if (PAIRS[c]) {
      const topIdx = stack[stack.length - 1];
      if (stack.length && chars[topIdx] === PAIRS[c]) {
        stack.pop();
        frames.push({ i, matched: topIdx, stack: [...stack], note: `'${c}' matches the '${PAIRS[c]}' at index ${topIdx} — pop it.` });
      } else {
        frames.push({ i, stack: [...stack], done: true, fail: true, note: `'${c}' has no matching opener on top — NOT balanced.` });
        return frames;
      }
    } else {
      frames.push({ i, stack: [...stack], note: `'${c}' isn't a bracket — skip it.` });
    }
  }
  frames.push({
    i: chars.length, stack: [...stack], done: true, fail: stack.length > 0,
    note: stack.length
      ? `End of string with ${stack.length} unclosed opener(s) — NOT balanced.`
      : 'End of string and the stack is empty — balanced! ✓',
  });
  return frames;
}

function BracketsViz({ s }) {
  const chars = useMemo(() => [...s], [s]);
  const frames = useMemo(() => buildBracketFrames(s), [s]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];

  return (
    <div className="viz">
      <p className="viz-prompt">
        Push every opening bracket; on a closer, the top of the stack must be its match.
        An empty stack at the end ⇒ <b>balanced</b>.
      </p>

      <div className="viz-out-label">Input</div>
      <div className="viz-track">
        {chars.map((c, i) => (
          <div className="viz-col" key={i}>
            <div className={`viz-cell ${i === frame.i ? 'mid' : ''} ${frame.matched === i ? 'found' : ''} ${frame.stack.includes(i) ? 'active' : ''}`}>{c}</div>
            <div className="viz-idx">{i}</div>
          </div>
        ))}
      </div>

      <div className="stk-wrap">
        <span className="viz-out-label">Stack (open brackets), top →</span>
        <div className="stk-row">
          {frame.stack.length ? (
            frame.stack.map((idx, k) => (
              <div className={`stk-item${k === frame.stack.length - 1 ? ' top' : ''}`} key={k}>
                <b>{chars[idx]}</b>
                <small>i{idx}</small>
              </div>
            ))
          ) : (
            <span className="viz-empty">empty</span>
          )}
        </div>
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? `viz-note done${frame.fail ? ' miss' : ''}` : 'viz-note'}>{frame.note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">Running the stack technique on this problem&apos;s own sample input.</p>
    </div>
  );
}

export default function StackViz({ input }) {
  const player = useStepPlayer(FRAMES.length);
  const { step } = player;
  const frame = FRAMES[Math.min(step, FRAMES.length - 1)];

  if (input && (input.string || input.mode === 'brackets')) {
    return <BracketsViz s={input.string || '()[]{}'} />;
  }

  return (
    <div className="viz">
      <p className="viz-prompt">
        For each day, how many days until a <b>warmer</b> temperature? Keep a stack of days still waiting.
      </p>

      <div className="stk-arrays">
        <div>
          <div className="viz-out-label">Temps</div>
          <div className="viz-track">
            {TEMPS.map((t, i) => (
              <div className="viz-col" key={i}>
                <div className={`viz-cell ${i === frame.i ? 'mid' : i < frame.i ? 'eliminated' : ''} ${frame.stack.includes(i) ? 'active' : ''}`}>{t}</div>
                <div className="viz-idx">{i}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="viz-out-label">answer (days to wait)</div>
          <div className="viz-track">
            {frame.result.map((r, i) => (
              <div className="viz-col" key={i}>
                <div className={`viz-cell small ${i === frame.popped ? 'found' : r ? 'filled' : ''}`}>{r}</div>
                <div className="viz-idx">{i}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stk-wrap">
        <span className="viz-out-label">Stack (days waiting), top →</span>
        <div className="stk-row">
          {frame.stack.length ? (
            frame.stack.map((idx, k) => (
              <div className={`stk-item${k === frame.stack.length - 1 ? ' top' : ''}`} key={k}>
                <b>{TEMPS[idx]}°</b>
                <small>day {idx}</small>
              </div>
            ))
          ) : (
            <span className="viz-empty">empty</span>
          )}
        </div>
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        Illustrates the general pattern with sample data — not a solver for this exact problem.
      </p>
    </div>
  );
}
