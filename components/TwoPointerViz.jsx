'use client';

import { useMemo, useState } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const SAMPLE_SORTED = [1, 3, 4, 5, 7, 10, 11];
const TARGET = 9;
const SAMPLE_WINDOW = [2, 1, 5, 1, 3, 2, 4];
const K = 3;
const SAMPLE_PALINDROME = 'Was it a car or a cat I saw?';

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

function buildPalindromeFrames(chars) {
  const frames = [];
  if (chars.length === 0) {
    return [{ l: 0, r: 0, action: 'Empty after filtering — trivially a palindrome.', done: true }];
  }
  let l = 0;
  let r = chars.length - 1;
  while (l < r) {
    const match = chars[l] === chars[r];
    if (!match) {
      frames.push({ l, r, action: `'${chars[l]}' ≠ '${chars[r]}' — mismatch, so it is NOT a palindrome.`, done: true, fail: true });
      break;
    }
    frames.push({ l, r, action: `'${chars[l]}' = '${chars[r]}' — match, move both pointers inward.`, done: false });
    l++;
    r--;
  }
  if (frames.length === 0 || !frames[frames.length - 1].done) {
    frames.push({ l, r, action: 'Pointers crossed — every pair matched. It IS a palindrome.', done: true });
  }
  return frames;
}

/**
 * Two-pointer family visualizer.
 * @param {object} [input] problem-specific data. Shapes:
 *   { mode:'two-pointers', array:number[], target:number }
 *   { mode:'window', array:number[], k:number }
 *   { mode:'palindrome', string:string }
 * When `input` is omitted it runs the generic demos with a mode switcher.
 */
export default function TwoPointerViz({ input }) {
  const forced = input && input.mode ? input.mode : null;
  const [mode, setMode] = useState(forced || 'two-pointers');

  const tpArr = (input && input.array) || SAMPLE_SORTED;
  const tpTarget = input && typeof input.target === 'number' ? input.target : TARGET;
  const winArr = (input && input.array) || SAMPLE_WINDOW;
  const winK = input && typeof input.k === 'number' ? input.k : K;
  const palRaw = (input && input.string) || SAMPLE_PALINDROME;
  const palChars = useMemo(() => palRaw.toLowerCase().replace(/[^a-z0-9]/g, '').split(''), [palRaw]);

  const frames = useMemo(() => {
    if (mode === 'palindrome') return buildPalindromeFrames(palChars);
    if (mode === 'window') return buildWindowFrames(winArr, winK);
    return buildTwoPointerFrames(tpArr, tpTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, palChars]);

  const player = useStepPlayer(frames.length);
  const { step } = player;
  const arr = mode === 'window' ? winArr : mode === 'palindrome' ? palChars : tpArr;
  const frame = frames[Math.min(step, frames.length - 1)];

  function switchMode(m) {
    setMode(m);
    player.setStep(0);
    player.setPlaying(false);
  }

  function cellClass(i) {
    if (mode === 'window') {
      if (i >= frame.start && i <= frame.end) return 'viz-cell window';
      return 'viz-cell';
    }
    if (i === frame.l && i === frame.r) return 'viz-cell both';
    if (i === frame.l) return 'viz-cell left';
    if (i === frame.r) return 'viz-cell right';
    if (i > frame.l && i < frame.r) return 'viz-cell inside';
    return 'viz-cell';
  }

  function pointerLabel(i) {
    if (mode === 'window') return null;
    if (i === frame.l && i === frame.r) return 'L·R';
    if (i === frame.l) return 'L';
    if (i === frame.r) return 'R';
    return null;
  }

  return (
    <div className="viz">
      {!forced && (
        <div className="viz-modes">
          <button className={mode === 'two-pointers' ? 'active' : ''} onClick={() => switchMode('two-pointers')}>
            Two pointers
          </button>
          <button className={mode === 'window' ? 'active' : ''} onClick={() => switchMode('window')}>
            Sliding window
          </button>
        </div>
      )}

      <p className="viz-prompt">
        {mode === 'two-pointers' && (
          <>Sorted array — find two values that sum to <b>{tpTarget}</b>.</>
        )}
        {mode === 'window' && (
          <>Slide a window of size <b>{winK}</b> — track the maximum window sum.</>
        )}
        {mode === 'palindrome' && (
          <>Compare characters from both ends — is this a palindrome (ignoring case &amp; punctuation)?</>
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
        <span className={frame.done ? `viz-note done${frame.fail ? ' miss' : ''}` : 'viz-note'}>{frame.action}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        {input
          ? "Running the two-pointer technique on this problem's own sample input."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
