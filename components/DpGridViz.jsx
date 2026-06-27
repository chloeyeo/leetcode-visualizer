'use client';

import { useMemo, useState } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const COST = [
  [1, 3, 1, 2],
  [1, 5, 1, 3],
  [4, 2, 1, 2],
];

function build(mode) {
  const rows = mode === 'Min Path Sum' ? COST.length : 4;
  const cols = mode === 'Min Path Sum' ? COST[0].length : 5;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  const frames = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let val;
      let froms = [];
      let note;
      if (mode === 'Unique Paths') {
        if (r === 0 || c === 0) {
          val = 1;
          note = 'Edge cell: exactly one way to reach it.';
        } else {
          froms = [[r - 1, c], [r, c - 1]];
          val = dp[r - 1][c] + dp[r][c - 1];
          note = `${dp[r - 1][c]} (above) + ${dp[r][c - 1]} (left) = ${val} paths.`;
        }
      } else {
        const cost = COST[r][c];
        if (r === 0 && c === 0) {
          val = cost;
          note = `Start cell: cost ${cost}.`;
        } else if (r === 0) {
          froms = [[r, c - 1]];
          val = cost + dp[r][c - 1];
          note = `cost ${cost} + ${dp[r][c - 1]} (left) = ${val}.`;
        } else if (c === 0) {
          froms = [[r - 1, c]];
          val = cost + dp[r - 1][c];
          note = `cost ${cost} + ${dp[r - 1][c]} (above) = ${val}.`;
        } else {
          froms = [[r - 1, c], [r, c - 1]];
          const best = Math.min(dp[r - 1][c], dp[r][c - 1]);
          val = cost + best;
          note = `cost ${cost} + min(${dp[r - 1][c]}, ${dp[r][c - 1]}) = ${val}.`;
        }
      }
      dp[r][c] = val;
      frames.push({ r, c, froms, note, done: r === rows - 1 && c === cols - 1 });
    }
  }

  const answer = dp[rows - 1][cols - 1];
  frames[frames.length - 1].note =
    mode === 'Unique Paths'
      ? `Done. ${answer} unique paths to the bottom-right.`
      : `Done. Cheapest path cost = ${answer}.`;

  return { rows, cols, dp, frames, mode };
}

export default function DpGridViz() {
  const [mode, setMode] = useState('Unique Paths');
  const model = useMemo(() => build(mode), [mode]);
  const { rows, cols, dp, frames } = model;
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];
  const isFilled = (r, c) => r * cols + c <= step;

  function switchMode(m) {
    setMode(m);
    player.setStep(0);
    player.setPlaying(false);
  }

  function cellClass(r, c) {
    if (r === frame.r && c === frame.c) return 'dp-cell current';
    if (frame.froms.some(([fr, fc]) => fr === r && fc === c)) return 'dp-cell from';
    if (isFilled(r, c)) return 'dp-cell filled';
    return 'dp-cell';
  }

  return (
    <div className="viz">
      <div className="viz-modes">
        {['Unique Paths', 'Min Path Sum'].map((m) => (
          <button key={m} className={m === mode ? 'active' : ''} onClick={() => switchMode(m)}>{m}</button>
        ))}
      </div>

      <p className="viz-prompt">
        {mode === 'Unique Paths' ? (
          <>Count paths from top-left to bottom-right moving only right/down. <b>dp = above + left</b>.</>
        ) : (
          <>Cheapest top-left → bottom-right path. <b>dp = cost + min(above, left)</b>.</>
        )}
      </p>

      <div className="dp-grid-scroll">
        <div className="dp-grid">
          {Array.from({ length: rows }).map((_, r) => (
            <div className="dp-row" key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <div className={cellClass(r, c)} key={c}>
                  {mode === 'Min Path Sum' && <span className="dp-cost">{COST[r][c]}</span>}
                  {isFilled(r, c) ? dp[r][c] : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
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
