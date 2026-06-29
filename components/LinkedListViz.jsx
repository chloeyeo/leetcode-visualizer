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

/* ---------- Merge mode (merge-two-sorted-lists) ---------- */
function buildMergeFrames(a, b) {
  const frames = [];
  let i = 0;
  let j = 0;
  const merged = [];
  frames.push({ i, j, merged: [], note: 'Compare the heads of both lists; take the smaller.' });
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) { const v = a[i]; merged.push({ v, from: 'A' }); i += 1; frames.push({ i, j, merged: [...merged], note: `${v} ≤ ${b[j]} → take ${v} from A.` }); }
    else { const v = b[j]; merged.push({ v, from: 'B' }); j += 1; frames.push({ i, j, merged: [...merged], note: `${v} < ${a[i]} → take ${v} from B.` }); }
  }
  while (i < a.length) { const v = a[i]; merged.push({ v, from: 'A' }); i += 1; frames.push({ i, j, merged: [...merged], note: `List B is empty → append ${v} from A.` }); }
  while (j < b.length) { const v = b[j]; merged.push({ v, from: 'B' }); j += 1; frames.push({ i, j, merged: [...merged], note: `List A is empty → append ${v} from B.` }); }
  frames.push({ i, j, merged: [...merged], done: true, note: 'Done — one sorted list.' });
  return frames;
}

function MergeListsViz({ listA, listB }) {
  const a = listA && listA.length ? listA : [1, 2, 4];
  const b = listB && listB.length ? listB : [1, 3, 4];
  const frames = useMemo(() => buildMergeFrames(a, b), [a, b]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];
  const cls = (idx, head) => (idx < head ? 'viz-cell eliminated' : idx === head ? 'viz-cell mid' : 'viz-cell');

  return (
    <div className="viz">
      <p className="viz-prompt">Merge two sorted lists: compare the two heads, take the smaller, advance that list.</p>
      <div className="mg-row">
        <span className="viz-out-label">List A</span>
        <div className="viz-track">{a.map((v, idx) => (<div className="viz-col" key={idx}><div className={cls(idx, frame.i)}>{v}</div></div>))}</div>
      </div>
      <div className="mg-row">
        <span className="viz-out-label">List B</span>
        <div className="viz-track">{b.map((v, idx) => (<div className="viz-col" key={idx}><div className={cls(idx, frame.j)}>{v}</div></div>))}</div>
      </div>
      <div className="mg-row">
        <span className="viz-out-label">Merged</span>
        <div className="viz-track">
          {frame.merged.length ? frame.merged.map((m, idx) => (
            <div className="viz-col" key={idx}><div className={`viz-cell found${m.from === 'B' ? ' mg-from-b' : ''}`}>{m.v}</div></div>
          )) : <span className="viz-empty">empty</span>}
        </div>
      </div>
      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.note}</span>
      </div>
      <VizControls player={player} />
      <p className="viz-disclaimer">Merging this problem&apos;s own sample lists, step by step.</p>
    </div>
  );
}

/**
 * Linked-list visualizer.
 * @param {object} [input] problem-specific data:
 *   { values:number[] } — reversal (default), or
 *   { mode:'merge', listA:number[], listB:number[] } — merge two sorted lists.
 */
export default function LinkedListViz({ input }) {
  const values = input && Array.isArray(input.values) && input.values.length ? input.values : DEFAULT_VALUES;
  const frames = useMemo(() => buildFrames(values), [values]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];
  const { link, prev, curr } = frame;
  const n = values.length;

  if (input && input.mode === 'merge') return <MergeListsViz listA={input.listA} listB={input.listB} />;

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
