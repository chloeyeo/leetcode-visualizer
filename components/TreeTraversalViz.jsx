'use client';

import { useMemo, useState } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const NODES = [
  { id: 0, val: 8, x: 300, y: 44 },
  { id: 1, val: 4, x: 165, y: 130 },
  { id: 2, val: 12, x: 435, y: 130 },
  { id: 3, val: 2, x: 90, y: 216 },
  { id: 4, val: 6, x: 240, y: 216 },
  { id: 5, val: 10, x: 360, y: 216 },
  { id: 6, val: 14, x: 510, y: 216 },
];
const KIDS = { 0: [1, 2], 1: [3, 4], 2: [5, 6], 3: [], 4: [], 5: [], 6: [] };

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const left = (id) => (KIDS[id] && KIDS[id][0] != null ? KIDS[id][0] : null);
const right = (id) => (KIDS[id] && KIDS[id][1] != null ? KIDS[id][1] : null);

function preorder(id, out) { if (id == null) return; out.push(id); preorder(left(id), out); preorder(right(id), out); }
function inorder(id, out) { if (id == null) return; inorder(left(id), out); out.push(id); inorder(right(id), out); }
function postorder(id, out) { if (id == null) return; postorder(left(id), out); postorder(right(id), out); out.push(id); }
function levelorder(rootId) {
  const out = [];
  const q = [rootId];
  while (q.length) {
    const id = q.shift();
    out.push(id);
    if (left(id) != null) q.push(left(id));
    if (right(id) != null) q.push(right(id));
  }
  return out;
}

const MODES = {
  Preorder: { build: () => { const o = []; preorder(0, o); return o; }, rule: 'node → left → right' },
  Inorder: { build: () => { const o = []; inorder(0, o); return o; }, rule: 'left → node → right (sorted for a BST!)' },
  Postorder: { build: () => { const o = []; postorder(0, o); return o; }, rule: 'left → right → node' },
  'Level order': { build: () => levelorder(0), rule: 'top to bottom, left to right (BFS)' },
};

const EDGES = [];
for (const id of Object.keys(KIDS)) {
  for (const c of KIDS[id]) EDGES.push([Number(id), c]);
}

export default function TreeTraversalViz() {
  const [mode, setMode] = useState('Preorder');
  const order = useMemo(() => MODES[mode].build(), [mode]);
  const player = useStepPlayer(order.length);
  const { step } = player;
  const current = order[Math.min(step, order.length - 1)];
  const visited = new Set(order.slice(0, step + 1));

  function switchMode(m) {
    setMode(m);
    player.setStep(0);
    player.setPlaying(false);
  }

  function nodeClass(id) {
    if (id === current) return 'current';
    if (visited.has(id)) return 'visited';
    return '';
  }

  return (
    <div className="viz">
      <div className="viz-modes">
        {Object.keys(MODES).map((m) => (
          <button key={m} className={m === mode ? 'active' : ''} onClick={() => switchMode(m)}>
            {m}
          </button>
        ))}
      </div>

      <p className="viz-prompt"><b>{mode}</b>: {MODES[mode].rule}</p>

      <svg className="viz-tree" viewBox="0 0 600 260" role="img" aria-label={`${mode} traversal of a binary search tree`}>
        <title>{mode} traversal</title>
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y} />
        ))}
        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="22" className={nodeClass(n.id)} />
            <text x={n.x} y={n.y}>{n.val}</text>
          </g>
        ))}
      </svg>

      <div className="viz-out">
        <span className="viz-out-label">Output:</span>
        {order.slice(0, step + 1).map((id, i) => (
          <span key={i} className={`pill${id === current ? ' current' : ''}`}>{byId[id].val}</span>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className="viz-note">Visit node {byId[current].val}.</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        Illustrates the general pattern with a sample tree — not a solver for this exact problem.
      </p>
    </div>
  );
}
