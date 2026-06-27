'use client';

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

export default function StackViz() {
  const player = useStepPlayer(FRAMES.length);
  const { step } = player;
  const frame = FRAMES[Math.min(step, FRAMES.length - 1)];

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
