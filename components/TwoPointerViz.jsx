'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';
import { useState } from 'react';

const SAMPLE_SORTED = [1, 3, 4, 5, 7, 10, 11];
const TARGET = 9;
const SAMPLE_WINDOW = [2, 1, 5, 1, 3, 2, 4];
const K = 3;

function buildTwoPointerFrames(arr, target) {
  const frames = [];
  let l = 0;
  let r = arr.length - 1;
  while (l < r) {
    const sum = arr[l] + arr[r];
    let action;
    let done = false;
    if (sum === target) {
      action = `arr[${l}] + arr[${r}] = ${sum} = target. Found the pair.`;
      done = true;
    } else if (sum < target) {
      action = `${sum} < ${target}: sum too small, move left pointer right.`;
    } else {
      action = `${sum} > ${target}: sum too big, move right pointer left.`;
    }
    frames.push({ l, r, sum, action, done });
    if (done) break;
    if (sum < target) l++;
    else r--;
  }
  if (frames.length === 0 || !frames[frames.length - 1].done) {
    frames.push({ l, r, sum: null, action: 'Pointers met — no pair found.', done: true });
  }
  return frames;
}

function buildWindowFrames(arr, k) {
  const frames = [];
  let best = -Infinity;
  let bestStart = 0;
  for (let start = 0; start + k <= arr.length; start++) {
    let sum = 0;
    for (let i = start; i < start + k; i++) sum += arr[i];
    if (sum > best) {
      best = sum;
      bestStart = start;
    }
    frames.push({
      start,
      end: start + k - 1,
      sum,
      best,
      bestStart,
      action: `Window [${start}…${start + k - 1}] sum = ${sum}. Best so far = ${best}.`,
      done: start + k === arr.length,
    });
  }
  return frames;
}

export default function TwoPointerViz() {
  const [mode, setMode] = useState('two-pointers');
  const frames = useMemo(
    () =>
      mode === 'two-pointers'
        ? buildTwoPointerFrames(SAMPLE_SORTED, TARGET)
        : buildWindowFrames(SAMPLE_WINDOW, K),
    [mode]
  );
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const arr = mode === 'two-pointers' ? SAMPLE_SORTED : SAMPLE_WINDOW;
  const frame = frames[Math.min(step, frames.length - 1)];

  function switchMode(m) {
    setMode(m);
    player.setStep(0);
    player.setPlaying(false);
  }

  function cellClass(i) {
    if (mode === 'two-pointers') {
      if (i === frame.l && i === frame.r) return 'viz-cell both';
      if (i === frame.l) return 'viz-cell left';
      if (i === frame.r) return 'viz-cell right';
      if (i > frame.l && i < frame.r) return 'viz-cell inside';
      return 'viz-cell';
    }
    if (i >= frame.start && i <= frame.end) return 'viz-cell window';
    return 'viz-cell';
  }

  function pointerLabel(i) {
    if (mode !== 'two-pointers') return null;
    if (i === frame.l && i === frame.r) return 'L·R';
    if (i === frame.l) return 'L';
    if (i === frame.r) return 'R';
    return null;
  }

  return (
    <div className="viz">
      <div className="viz-modes">
        <button className={mode === 'two-pointers' ? 'active' : ''} onClick={() => switchMode('two-pointers')}>
          Two pointers
        </button>
        <button className={mode === 'window' ? 'active' : ''} onClick={() => switchMode('window')}>
          Sliding window
        </button>
      </div>

      <p className="viz-prompt">
        {mode === 'two-pointers' ? (
          <>Sorted array — find two values that sum to <b>{TARGET}</b>.</>
        ) : (
          <>Slide a window of size <b>{K}</b> — track the maximum window sum.</>
        )}
      </p>

      <div className="viz-track">
        {arr.map((val, i) => (
          <div key={i} className="viz-col">
            <div className="viz-ptr">{pointerLabel(i)}</div>
            <div className={cellClass(i)}>{val}</div>
            <div className="viz-idx">{i}</div>
          </div>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.action}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        Illustrates the general pattern with sample data — not a solver for this exact problem.
      </p>
    </div>
  );
}
