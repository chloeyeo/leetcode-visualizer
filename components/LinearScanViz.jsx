'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const SAMPLE = [7, 1, 5, 3, 6, 4];

function buildFrames(arr) {
  const frames = [];
  let best = -Infinity;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    sum += x;
    const newBest = x > best;
    best = Math.max(best, x);
    frames.push({
      i,
      best,
      sum,
      action: newBest
        ? `i = ${i}: read ${x} — new best so far (${best}). Running sum ${sum}.`
        : `i = ${i}: read ${x} — best stays ${best}. Running sum ${sum}.`,
      done: false,
    });
  }
  frames.push({
    i: arr.length - 1,
    best,
    sum,
    action: `One pass done: ${arr.length} elements visited exactly once — O(N) time, O(1) extra space.`,
    done: true,
  });
  return frames;
}

/**
 * Linear scan — the workhorse behind most Array/String/Greedy problems:
 * march one index across the data, folding each element into a running
 * answer (max/sum here). One look per element = O(N).
 * @param {object} [input] { array:number[] }
 */
export default function LinearScanViz({ input }) {
  const arr = (input && Array.isArray(input.array) && input.array.length ? input.array : SAMPLE).slice(0, 14);
  const frames = useMemo(() => buildFrames(arr), [arr]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];

  return (
    <div className="viz">
      <p className="viz-prompt">
        One index, one pass — fold every element into a <b>running answer</b> as you go.
      </p>

      <div className="viz-track">
        {arr.map((val, i) => (
          <div key={i} className="viz-col">
            <div className="viz-ptr">{i === frame.i ? 'i' : null}</div>
            <div className={`viz-cell${i < frame.i ? ' inside' : ''}${i === frame.i ? (frame.done ? ' both' : ' left') : ''}`}>{val}</div>
            <div className="viz-idx">{i}</div>
          </div>
        ))}
      </div>

      <div className="viz-map" aria-label="Running accumulators">
        <span className="viz-map-label">running</span>
        <span className={`viz-kv${frame.done ? ' hit' : ''}`}>best → {frame.best}</span>
        <span className={`viz-kv${frame.done ? ' hit' : ''}`}>sum → {frame.sum}</span>
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.action}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        {input
          ? "Scanning this problem's own sample input — the accumulators here are stand-ins for whatever this problem tracks per element."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
