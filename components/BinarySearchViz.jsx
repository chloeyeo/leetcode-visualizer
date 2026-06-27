'use client';

import { useMemo, useState } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const ARR = [1, 4, 7, 9, 12, 15, 20, 24, 30, 33, 41, 48];
const TARGETS = [15, 33, 7, 14]; // 14 is absent -> demonstrates a miss

function buildFrames(arr, target) {
  const frames = [];
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    let action;
    let done = false;
    if (arr[mid] === target) {
      action = `arr[${mid}] = ${arr[mid]} = target. Found it at index ${mid}.`;
      done = true;
    } else if (arr[mid] < target) {
      action = `arr[${mid}] = ${arr[mid]} < ${target}: discard the left half, search right.`;
    } else {
      action = `arr[${mid}] = ${arr[mid]} > ${target}: discard the right half, search left.`;
    }
    frames.push({ lo, hi, mid, action, done });
    if (done) break;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  if (frames.length === 0 || !frames[frames.length - 1].done) {
    frames.push({ lo, hi, mid: -1, action: `${target} is not in the array.`, done: true, miss: true });
  }
  return frames;
}

export default function BinarySearchViz() {
  const [target, setTarget] = useState(TARGETS[0]);
  const frames = useMemo(() => buildFrames(ARR, target), [target]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];

  function pickTarget(t) {
    setTarget(t);
    player.setStep(0);
    player.setPlaying(false);
  }

  function cellClass(i) {
    if (i < frame.lo || i > frame.hi) return 'viz-cell eliminated';
    if (i === frame.mid && frame.done && !frame.miss) return 'viz-cell found';
    if (i === frame.mid) return 'viz-cell mid';
    return 'viz-cell active';
  }

  function pointerLabel(i) {
    const labels = [];
    if (i === frame.lo) labels.push('lo');
    if (i === frame.mid) labels.push('mid');
    if (i === frame.hi) labels.push('hi');
    return labels.join('·') || null;
  }

  return (
    <div className="viz">
      <div className="viz-targets">
        <span className="viz-targets-label">Search for:</span>
        {TARGETS.map((t) => (
          <button key={t} className={t === target ? 'active' : ''} onClick={() => pickTarget(t)}>
            {t}
          </button>
        ))}
      </div>

      <p className="viz-prompt">
        Sorted array — binary search halves the range each step until it finds{' '}
        <b>{target}</b> (or rules it out).
      </p>

      <div className="viz-track">
        {ARR.map((val, i) => (
          <div key={i} className="viz-col">
            <div className="viz-ptr">{pointerLabel(i)}</div>
            <div className={cellClass(i)}>{val}</div>
            <div className="viz-idx">{i}</div>
          </div>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? `viz-note done${frame.miss ? ' miss' : ''}` : 'viz-note'}>
          {frame.action}
        </span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        Illustrates the general pattern with sample data — not a solver for this exact problem.
      </p>
    </div>
  );
}
