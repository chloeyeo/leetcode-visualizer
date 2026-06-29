'use client';

import { useMemo, useState } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const NODES = [
  { id: 0, x: 300, y: 44 },
  { id: 1, x: 150, y: 130 },
  { id: 2, x: 450, y: 130 },
  { id: 3, x: 80, y: 224 },
  { id: 4, x: 230, y: 224 },
  { id: 5, x: 370, y: 224 },
  { id: 6, x: 520, y: 224 },
];
const ADJ = { 0: [1, 2], 1: [0, 3, 4], 2: [0, 5, 6], 3: [1], 4: [1, 5], 5: [2, 4], 6: [2] };
const EDGES = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [4, 5]];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const L = (id) => LABELS[id];

function bfs(start) {
  const frames = [];
  const visited = new Set([start]);
  const q = [start];
  while (q.length) {
    const node = q.shift();
    const added = [];
    for (const nb of ADJ[node]) {
      if (!visited.has(nb)) { visited.add(nb); q.push(nb); added.push(nb); }
    }
    frames.push({
      node, visited: new Set(visited), frontier: [...q], structure: 'Queue',
      note: added.length ? `Visit ${L(node)}; enqueue ${added.map(L).join(', ')}.` : `Visit ${L(node)}; no new neighbours.`,
    });
  }
  return frames;
}

function dfs(start) {
  const frames = [];
  const visited = new Set();
  const stack = [];
  function go(node) {
    visited.add(node);
    stack.push(node);
    frames.push({ node, visited: new Set(visited), frontier: [...stack], structure: 'Stack', note: `Visit ${L(node)}; recurse into unvisited neighbours.` });
    for (const nb of ADJ[node]) if (!visited.has(nb)) go(nb);
    stack.pop();
  }
  go(start);
  return frames;
}

/* ---------- Grid flood-fill mode (number-of-islands) ---------- */
const ISLAND_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--easy)', 'var(--medium)', 'var(--hard)'];

function buildIslandFrames(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const color = Array.from({ length: rows }, () => Array(cols).fill(0)); // 0 = unvisited, >0 = island id
  const frames = [];
  let islands = 0;
  const inb = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === '1' && color[r][c] === 0) {
        islands += 1;
        color[r][c] = islands;
        const stack = [[r, c]];
        frames.push({ cur: [r, c], color: color.map((row) => [...row]), islands, note: `Unvisited land at (${r}, ${c}) — start island #${islands}.` });
        while (stack.length) {
          const [cr, cc] = stack.pop();
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (inb(nr, nc) && grid[nr][nc] === '1' && color[nr][nc] === 0) {
              color[nr][nc] = islands;
              stack.push([nr, nc]);
              frames.push({ cur: [nr, nc], color: color.map((row) => [...row]), islands, note: `Flood-fill (${nr}, ${nc}) into island #${islands}.` });
            }
          }
        }
      }
    }
  }
  frames.push({ cur: null, color: color.map((row) => [...row]), islands, done: true, note: `Done — ${islands} island${islands === 1 ? '' : 's'} found.` });
  return frames;
}

function IslandsViz({ grid }) {
  const frames = useMemo(() => buildIslandFrames(grid), [grid]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];
  const cols = grid[0].length;

  return (
    <div className="viz">
      <p className="viz-prompt">
        Scan the grid; on each unvisited <b>land</b> cell, flood-fill its whole island
        (up/down/left/right) and add one to the count.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 44px)`, gap: 4, margin: '10px 0 14px' }}>
        {grid.map((row, r) => row.map((cell, c) => {
          const id = frame.color[r][c];
          const isCur = frame.cur && frame.cur[0] === r && frame.cur[1] === c;
          const bg = cell === '0' ? 'var(--bg-elev-2)' : id > 0 ? ISLAND_COLORS[(id - 1) % ISLAND_COLORS.length] : 'var(--state-visited)';
          return (
            <div
              key={`${r}-${c}`}
              style={{
                height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontVariantNumeric: 'tabular-nums', background: bg,
                color: cell === '0' ? 'var(--text-faint)' : 'var(--on-accent)',
                outline: isCur ? '3px solid var(--text)' : 'none', transition: 'background 0.25s',
              }}
            >
              {cell}
            </div>
          );
        }))}
      </div>

      <div className="viz-out">
        <span className="viz-out-label">Islands so far:</span>
        <span className="pill current">{frame.islands}</span>
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">Running flood-fill on this problem&apos;s own sample grid.</p>
    </div>
  );
}

export default function GraphViz({ input }) {
  const [mode, setMode] = useState('BFS');
  const frames = useMemo(() => (mode === 'BFS' ? bfs(0) : dfs(0)), [mode]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];
  const order = frames.slice(0, step + 1).map((f) => f.node);

  if (input && input.grid) return <IslandsViz grid={input.grid} />;

  function switchMode(m) {
    setMode(m);
    player.setStep(0);
    player.setPlaying(false);
  }

  function nodeClass(id) {
    if (id === frame.node) return 'current';
    if (frame.frontier.includes(id)) return 'frontier';
    if (frame.visited.has(id)) return 'visited';
    return '';
  }

  return (
    <div className="viz">
      <div className="viz-modes">
        {['BFS', 'DFS'].map((m) => (
          <button key={m} className={m === mode ? 'active' : ''} onClick={() => switchMode(m)}>
            {m === 'BFS' ? 'BFS (breadth-first)' : 'DFS (depth-first)'}
          </button>
        ))}
      </div>

      <p className="viz-prompt">
        Traverse from <b>A</b> using {mode === 'BFS' ? 'a queue (explore level by level)' : 'a stack / recursion (go deep first)'}.
      </p>

      <svg className="viz-graph" viewBox="0 0 600 268" role="img" aria-label={`${mode} graph traversal`}>
        <title>{mode} traversal</title>
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y} />
        ))}
        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="22" className={nodeClass(n.id)} />
            <text x={n.x} y={n.y}>{L(n.id)}</text>
          </g>
        ))}
      </svg>

      <div className="viz-struct">
        <span className="viz-out-label">{frame.structure}:</span>
        {frame.frontier.length ? (
          frame.frontier.map((id, i) => <span key={i} className="pill">{L(id)}</span>)
        ) : (
          <span className="viz-empty">empty</span>
        )}
      </div>

      <div className="viz-out">
        <span className="viz-out-label">Visited:</span>
        {order.map((id, i) => (
          <span key={i} className={`pill${id === frame.node ? ' current' : ''}`}>{L(id)}</span>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className="viz-note">{frame.note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        Illustrates the general pattern with a sample graph — not a solver for this exact problem.
      </p>
    </div>
  );
}
