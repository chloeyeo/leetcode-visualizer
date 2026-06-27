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

export default function GraphViz() {
  const [mode, setMode] = useState('BFS');
  const frames = useMemo(() => (mode === 'BFS' ? bfs(0) : dfs(0)), [mode]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];
  const order = frames.slice(0, step + 1).map((f) => f.node);

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
