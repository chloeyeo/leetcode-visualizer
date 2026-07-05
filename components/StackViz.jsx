'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const TEMPS = [73, 74, 75, 71, 69, 72, 76, 73];

// `days` switches the wording between the generic next-greater walk and the
// daily-temperatures framing of the default demo.
function buildFrames(arr, days) {
  const unit = days ? '°' : '';
  const thing = days ? 'day' : 'index';
  const res = Array(arr.length).fill(0);
  const st = [];
  const frames = [];
  for (let i = 0; i < arr.length; i++) {
    while (st.length && arr[st[st.length - 1]] < arr[i]) {
      const idx = st.pop();
      res[idx] = i - idx;
      frames.push({ i, stack: [...st], result: [...res], popped: idx, note: `${days ? 'Day' : 'Index'} ${i} (${arr[i]}${unit}) beats ${thing} ${idx} (${arr[idx]}${unit}): answer[${idx}] = ${i - idx} ${days ? 'day(s)' : 'step(s)'}. Pop it.` });
    }
    st.push(i);
    frames.push({ i, stack: [...st], result: [...res], pushed: i, note: `Push ${thing} ${i} (${arr[i]}${unit}) — it's now waiting for a ${days ? 'warmer day' : 'greater value'}.` });
  }
  frames.push({ i: arr.length, stack: [...st], result: [...res], done: true, note: `Done. ${days ? 'Days' : 'Indices'} still on the stack have no ${days ? 'warmer future day' : 'greater value ahead'} → 0.` });
  return frames;
}

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

/* ---------- Intervals mode (merge-intervals) ---------- */
function buildIntervalFrames(sorted) {
  const frames = [];
  const out = [];
  frames.push({ idx: -1, out: [], note: 'Sort intervals by start, then sweep left to right merging overlaps.' });
  sorted.forEach((iv, idx) => {
    const top = out[out.length - 1];
    if (!top || iv[0] > top[1]) {
      out.push([...iv]);
      frames.push({
        idx, out: out.map((p) => [...p]),
        note: top
          ? `[${iv[0]}, ${iv[1]}] starts after the top [${top[0]}, ${top[1]}] ends — no overlap, push it.`
          : `Output is empty — push [${iv[0]}, ${iv[1]}] as the first block.`,
      });
    } else {
      top[1] = Math.max(top[1], iv[1]);
      frames.push({
        idx, out: out.map((p) => [...p]),
        note: `[${iv[0]}, ${iv[1]}] overlaps the top — merge them into [${top[0]}, ${top[1]}].`,
      });
    }
  });
  frames.push({ idx: sorted.length, out: out.map((p) => [...p]), done: true, note: `Done — ${out.length} merged interval${out.length === 1 ? '' : 's'}.` });
  return frames;
}

function IntervalBar({ iv, lo, span, state }) {
  const left = ((iv[0] - lo) / span) * 100;
  const width = Math.max(((iv[1] - iv[0]) / span) * 100, 3);
  const bg = state === 'current' ? 'var(--accent)' : state === 'done' ? 'var(--state-visited)' : state === 'out' ? 'var(--easy)' : 'var(--bg-elev-2)';
  return (
    <div
      style={{
        position: 'absolute', left: `${left}%`, width: `${width}%`, top: 3, bottom: 3,
        background: bg, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        color: state === 'pending' ? 'var(--text-faint)' : 'var(--on-accent)',
        outline: state === 'current' ? '2px solid var(--text)' : 'none',
        transition: 'background 0.25s', whiteSpace: 'nowrap', overflow: 'hidden',
      }}
    >
      [{iv[0]},{iv[1]}]
    </div>
  );
}

function IntervalsViz({ intervals }) {
  const sorted = useMemo(() => [...intervals].map((p) => [...p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), [intervals]);
  const frames = useMemo(() => buildIntervalFrames(sorted), [sorted]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];
  const lo = Math.min(...sorted.map((p) => p[0]));
  const hi = Math.max(...sorted.map((p) => p[1]));
  const span = Math.max(hi - lo, 1);

  return (
    <div className="viz">
      <p className="viz-prompt">
        Sort by start, then keep an output stack: each interval either <b>merges into</b> the
        top (overlap) or is <b>pushed</b> as a new block.
      </p>

      <div className="viz-out-label">Input (sorted by start)</div>
      <div style={{ margin: '8px 0 14px' }}>
        {sorted.map((iv, i) => (
          <div key={i} style={{ position: 'relative', height: 30 }}>
            <IntervalBar iv={iv} lo={lo} span={span} state={i === frame.idx ? 'current' : i < frame.idx ? 'done' : 'pending'} />
          </div>
        ))}
      </div>

      <div className="viz-out-label">Merged output, top →</div>
      <div style={{ position: 'relative', height: 30, margin: '8px 0 4px' }}>
        {frame.out.length ? (
          frame.out.map((iv, i) => <IntervalBar key={i} iv={iv} lo={lo} span={span} state="out" />)
        ) : (
          <span className="viz-empty">empty</span>
        )}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">Merging this problem&apos;s own sample intervals, step by step.</p>
    </div>
  );
}

/**
 * Stack-family visualizer.
 * @param {object} [input] problem-specific data:
 *   { mode:'brackets', string:string } — matched-brackets walk,
 *   { mode:'monotonic', array:number[] } — next-greater-element walk,
 *   { mode:'intervals', intervals:[lo,hi][] } — sort + merge via an output stack.
 * When omitted it runs the daily-temperatures demo.
 */
export default function StackViz({ input }) {
  const custom = input && input.mode === 'monotonic' && Array.isArray(input.array) && input.array.length >= 2 ? input.array : null;
  const arr = custom || TEMPS;
  const frames = useMemo(() => buildFrames(arr, !custom), [arr, custom]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];

  if (input && (input.string || input.mode === 'brackets')) {
    return <BracketsViz s={input.string || '()[]{}'} />;
  }
  if (input && input.mode === 'intervals' && Array.isArray(input.intervals) && input.intervals.length >= 2) {
    return <IntervalsViz intervals={input.intervals} />;
  }

  return (
    <div className="viz">
      <p className="viz-prompt">
        {custom ? (
          <>For each element, how many steps until a <b>greater</b> value appears? Keep a stack of indices still waiting.</>
        ) : (
          <>For each day, how many days until a <b>warmer</b> temperature? Keep a stack of days still waiting.</>
        )}
      </p>

      <div className="stk-arrays">
        <div>
          <div className="viz-out-label">{custom ? 'Values' : 'Temps'}</div>
          <div className="viz-track">
            {arr.map((t, i) => (
              <div className="viz-col" key={i}>
                <div className={`viz-cell ${i === frame.i ? 'mid' : i < frame.i ? 'eliminated' : ''} ${frame.stack.includes(i) ? 'active' : ''}`}>{t}</div>
                <div className="viz-idx">{i}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="viz-out-label">{custom ? 'answer (steps to wait)' : 'answer (days to wait)'}</div>
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
        <span className="viz-out-label">Stack ({custom ? 'indices' : 'days'} waiting), top →</span>
        <div className="stk-row">
          {frame.stack.length ? (
            frame.stack.map((idx, k) => (
              <div className={`stk-item${k === frame.stack.length - 1 ? ' top' : ''}`} key={k}>
                <b>{arr[idx]}{custom ? '' : '°'}</b>
                <small>{custom ? `i = ${idx}` : `day ${idx}`}</small>
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
        {custom
          ? "Running the monotonic-stack technique on this problem's own sample input."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
