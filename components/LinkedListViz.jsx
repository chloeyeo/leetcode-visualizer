'use client';

import { Fragment } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const VALUES = [1, 2, 3, 4, 5];

function buildFrames() {
  const n = VALUES.length;
  const link = VALUES.map((_, i) => (i < n - 1 ? i + 1 : null));
  const frames = [];
  let prev = null;
  let curr = 0;
  frames.push({ prev, curr, link: [...link], note: 'Start: prev = null, curr = head (1).' });
  while (curr !== null) {
    const next = link[curr];
    link[curr] = prev;
    frames.push({ prev, curr, link: [...link], note: `Flip node ${VALUES[curr]}'s arrow to point at ${prev === null ? 'null' : VALUES[prev]}.` });
    prev = curr;
    curr = next;
    frames.push({
      prev, curr, link: [...link], done: curr === null,
      note: curr === null ? `Done — the list is reversed. New head is ${VALUES[prev]}.` : `Advance: prev = ${VALUES[prev]}, curr = ${VALUES[curr]}.`,
    });
  }
  return frames;
}

const FRAMES = buildFrames();

export default function LinkedListViz() {
  const player = useStepPlayer(FRAMES.length);
  const { step } = player;
  const frame = FRAMES[Math.min(step, FRAMES.length - 1)];
  const { link, prev, curr } = frame;
  const n = VALUES.length;

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
        {VALUES.map((v, i) => (
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
        Illustrates the general pattern with sample data — not a solver for this exact problem.
      </p>
    </div>
  );
}
