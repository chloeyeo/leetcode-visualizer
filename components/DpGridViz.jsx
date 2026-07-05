'use client';

import { useMemo, useState } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const COST = [
  [1, 3, 1, 2],
  [1, 5, 1, 3],
  [4, 2, 1, 2],
];

function build(mode, opts = {}) {
  const grid = mode === 'Min Path Sum' ? (opts.grid || COST) : null;
  const rows = grid ? grid.length : opts.rows || 4;
  const cols = grid ? grid[0].length : opts.cols || 5;
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
        const cost = grid[r][c];
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

  return { rows, cols, dp, frames, mode, grid };
}

/**
 * DP-table visualizer.
 * @param {object} [input] problem-specific data:
 *   { mode:'unique-paths', rows:int, cols:int } — count right/down paths on the problem's own m×n grid.
 *   { mode:'min-path-sum', grid:number[][] } — cheapest path over the problem's own cost grid.
 * When omitted it runs the generic two-mode demo.
 */
export default function DpGridViz({ input }) {
  const forced = input && input.mode === 'unique-paths' ? 'Unique Paths'
    : input && input.mode === 'min-path-sum' ? 'Min Path Sum'
      : null;
  const [mode, setMode] = useState(forced || 'Unique Paths');
  const model = useMemo(
    () => build(forced || mode, forced ? { rows: input.rows, cols: input.cols, grid: input.grid } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, forced, input]
  );
  const { rows, cols, dp, frames, grid } = model;
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
      {!forced && (
        <div className="viz-modes">
          {['Unique Paths', 'Min Path Sum'].map((m) => (
            <button key={m} className={m === mode ? 'active' : ''} onClick={() => switchMode(m)}>{m}</button>
          ))}
        </div>
      )}

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
                  {grid && <span className="dp-cost">{grid[r][c]}</span>}
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
        {input
          ? "Filling the DP table for this problem's own input, cell by cell."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
