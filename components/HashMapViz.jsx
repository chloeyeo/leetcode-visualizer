'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const SAMPLE = [3, 8, 11, 2, 15, 6];
const TARGET = 8;

function buildFrames(arr, target) {
  const frames = [];
  const map = new Map(); // value -> index, in insertion order like the Python dict
  const entries = () => [...map.entries()].map(([k, v]) => ({ k, v }));
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    const need = target - x;
    if (map.has(need)) {
      frames.push({
        i,
        need,
        hit: true,
        entries: entries(),
        action: `need = ${target} − ${x} = ${need}. The map HAS ${need} (index ${map.get(need)}) — return [${map.get(need)}, ${i}]. One pass, O(1) per lookup.`,
        done: true,
      });
      return frames;
    }
    map.set(x, i);
    frames.push({
      i,
      need,
      hit: false,
      entries: entries(),
      action: `need = ${target} − ${x} = ${need}. Not in the map yet — store ${x} → index ${i} and move on.`,
      done: false,
    });
  }
  frames.push({
    i: arr.length - 1,
    need: null,
    hit: false,
    entries: entries(),
    action: 'Scanned the whole array — no pair sums to the target.',
    done: true,
    fail: true,
  });
  return frames;
}

/**
 * Hash-map lookup visualizer — the one-pass Two Sum walk: for each element,
 * compute what's missing, check the map in O(1), otherwise remember the
 * element. Trades O(N) space for O(N²) → O(N) time.
 * @param {object} [input] { array:number[], target:number }
 */
export default function HashMapViz({ input }) {
  const arr = (input && input.array) || SAMPLE;
  const target = input && typeof input.target === 'number' ? input.target : TARGET;

  const frames = useMemo(() => buildFrames(arr, target), [arr, target]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];

  function cellClass(i) {
    if (i === frame.i) return frame.hit ? 'viz-cell both' : 'viz-cell left';
    if (i < frame.i) return 'viz-cell inside';
    return 'viz-cell';
  }

  const hitKey = frame.hit ? frame.need : null;

  return (
    <div className="viz">
      <p className="viz-prompt">
        One pass — for each value <b>x</b>, is <b>{target} − x</b> already in the hash map?
      </p>

      <div className="viz-track">
        {arr.map((val, i) => (
          <div key={i} className="viz-col">
            <div className="viz-ptr">{i === frame.i ? 'i' : null}</div>
            <div className={cellClass(i)}>{val}</div>
            <div className="viz-idx">{i}</div>
          </div>
        ))}
      </div>

      <div className="viz-map" aria-label="Hash map contents">
        <span className="viz-map-label">hash map</span>
        {frame.entries.length === 0 && <span className="viz-kv empty">{'{ }'}</span>}
        {frame.entries.map((e) => (
          <span key={e.k} className={`viz-kv${e.k === hitKey ? ' hit' : ''}`}>
            {e.k} → {e.v}
          </span>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? `viz-note done${frame.fail ? ' miss' : ''}` : 'viz-note'}>{frame.action}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        {input
          ? "Running the hash-map technique on this problem's own sample input."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
