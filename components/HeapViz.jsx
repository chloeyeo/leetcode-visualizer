'use client';

import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const INSERTS = [5, 3, 8, 1, 9, 2];

function buildFrames() {
  const heap = [];
  const frames = [];
  for (const val of INSERTS) {
    heap.push(val);
    let i = heap.length - 1;
    frames.push({ heap: [...heap], active: i, note: `Insert ${val} at the end (index ${i}).` });
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p] <= heap[i]) {
        frames.push({ heap: [...heap], active: i, compare: p, note: `${heap[i]} ≥ parent ${heap[p]} — heap property holds, stop.` });
        break;
      }
      frames.push({ heap: [...heap], active: i, compare: p, note: `${heap[i]} < parent ${heap[p]} — swap up.` });
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
    if (i === 0) {
      frames.push({ heap: [...heap], active: 0, note: `${val} reached the root — it's the new minimum.` });
    }
  }
  frames[frames.length - 1].done = true;
  return frames;
}

const FRAMES = buildFrames();

const VB_W = 560;
const TOP = 38;
const GAPY = 80;
function pos(i) {
  const level = Math.floor(Math.log2(i + 1));
  const idxInLevel = i - (2 ** level - 1);
  const count = 2 ** level;
  return { x: (VB_W * (idxInLevel + 0.5)) / count, y: TOP + level * GAPY, level };
}

export default function HeapViz() {
  const player = useStepPlayer(FRAMES.length);
  const { step } = player;
  const frame = FRAMES[Math.min(step, FRAMES.length - 1)];
  const heap = frame.heap;
  const maxLevel = heap.length ? pos(heap.length - 1).level : 0;
  const VB_H = TOP + maxLevel * GAPY + 38;

  function cls(i) {
    if (i === frame.active) return 'current';
    if (i === frame.compare) return 'frontier';
    return 'visited';
  }

  return (
    <div className="viz">
      <p className="viz-prompt">
        Build a <b>min-heap</b> by inserting one value at a time and bubbling it up
        while it&apos;s smaller than its parent.
      </p>

      <svg className="viz-graph" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="min-heap as a binary tree">
        <title>Min-heap insertion</title>
        {heap.map((_, i) =>
          i === 0 ? null : (
            <line key={`e${i}`} x1={pos(i).x} y1={pos(i).y} x2={pos(Math.floor((i - 1) / 2)).x} y2={pos(Math.floor((i - 1) / 2)).y} />
          )
        )}
        {heap.map((v, i) => {
          const { x, y } = pos(i);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="22" className={cls(i)} />
              <text x={x} y={y}>{v}</text>
            </g>
          );
        })}
      </svg>

      <div className="viz-out">
        <span className="viz-out-label">Array:</span>
        {heap.map((v, i) => (
          <span key={i} className={`pill${i === frame.active ? ' current' : ''}`}>{v}</span>
        ))}
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
