'use client';

import { Fragment, useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const DEFAULT_VALUES = [1, 2, 3, 4, 5];

function buildFrames(values) {
  const n = values.length;
  const link = values.map((_, i) => (i < n - 1 ? i + 1 : null));
  const frames = [];
  let prev = null;
  let curr = 0;
  frames.push({ prev, curr, link: [...link], note: `Start: prev = null, curr = head (${values[0]}).` });
  while (curr !== null) {
    const next = link[curr];
    link[curr] = prev;
    frames.push({ prev, curr, link: [...link], note: `Flip node ${values[curr]}'s arrow to point at ${prev === null ? 'null' : values[prev]}.` });
    prev = curr;
    curr = next;
    frames.push({
      prev, curr, link: [...link], done: curr === null,
      note: curr === null ? `Done — the list is reversed. New head is ${values[prev]}.` : `Advance: prev = ${values[prev]}, curr = ${values[curr]}.`,
    });
  }
  return frames;
}

/**
 * Linked-list reversal visualizer.
 * @param {object} [input] problem-specific data: { values:number[] }.
 */
export default function LinkedListViz({ input }) {
  const values = input && Array.isArray(input.values) && input.values.length ? input.values : DEFAULT_VALUES;
  const frames = useMemo(() => buildFrames(values), [values]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];
  const { link, prev, curr } = frame;
  const n = values.length;

  function ptr(i) {
    if (i === prev) return 'prev';
    if (i === curr) return 'curr';
    return null;
  }
  function connector(i) {
    if (link[i] === i + 1) return 'arrow fwd';
    if (link[i + 1] === i) return 'arrow back';
    return 'arrow broken';
  }

  return (
    <div className="viz">
      <p className="viz-prompt">
        Reverse a linked list in place: for each node, point its arrow at the{' '}
        <b>previous</b> node, then step forward.
      </p>

      <div className="ll-row">
        {values.map((v, i) => (
          <Fragment key={i}>
            <div className="ll-col">
              <div className={`ll-ptr ${ptr(i) || ''}`}>{ptr(i)}</div>
              <div className={`ll-node${i === curr ? ' curr' : i === prev ? ' prev' : ''}`}>{v}</div>
            </div>
            {i < n - 1 && (
              <div className={`ll-conn ${connector(i)}`}>
                {connector(i).includes('back') ? '←' : connector(i).includes('fwd') ? '→' : '⇠'}
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        {input
          ? "Reversing this problem's own sample list, node by node."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
