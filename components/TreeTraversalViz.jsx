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

/* ---------- Invert mode (invert-binary-tree) ---------- */
function treeFromLevelOrder(arr) {
  if (!arr || !arr.length) return null;
  let id = 0;
  const root = { id: id++, val: arr[0], left: null, right: null };
  const q = [root];
  let i = 1;
  while (q.length && i < arr.length) {
    const node = q.shift();
    if (i < arr.length && arr[i] != null) { node.left = { id: id++, val: arr[i], left: null, right: null }; q.push(node.left); }
    i++;
    if (i < arr.length && arr[i] != null) { node.right = { id: id++, val: arr[i], left: null, right: null }; q.push(node.right); }
    i++;
  }
  return root;
}
function cloneTree(n) { return n ? JSON.parse(JSON.stringify(n)) : null; }
function findNode(n, id) {
  if (!n) return null;
  if (n.id === id) return n;
  return findNode(n.left, id) || findNode(n.right, id);
}
function layoutInvert(root) {
  const nodes = []; const edges = []; let i = 0; let maxDepth = 0;
  (function pos(n, d) {
    if (!n) return;
    pos(n.left, d + 1);
    nodes.push({ id: n.id, val: n.val, x: i++, y: d });
    maxDepth = Math.max(maxDepth, d);
    pos(n.right, d + 1);
  })(root, 0);
  (function ed(n) {
    if (!n) return;
    if (n.left) { edges.push([n.id, n.left.id]); ed(n.left); }
    if (n.right) { edges.push([n.id, n.right.id]); ed(n.right); }
  })(root);
  return { nodes, edges, cols: i, maxDepth };
}
function buildInvertFrames(root) {
  const frames = [{ tree: cloneTree(root), current: null, note: 'The original tree.' }];
  const ids = [];
  (function pre(n) { if (!n) return; ids.push(n.id); pre(n.left); pre(n.right); })(root);
  for (const id of ids) {
    const node = findNode(root, id);
    if (node && (node.left || node.right)) {
      const t = node.left; node.left = node.right; node.right = t;
      frames.push({ tree: cloneTree(root), current: id, note: `Swap the children of ${node.val}.` });
    }
  }
  frames.push({ tree: cloneTree(root), current: null, done: true, note: 'Done — every node mirrored.' });
  return frames;
}

function InvertTreeViz({ tree }) {
  const root = useMemo(() => treeFromLevelOrder(tree && tree.length ? tree : [4, 2, 7, 1, 3, 6, 9]), [tree]);
  const frames = useMemo(() => buildInvertFrames(cloneTree(root)), [root]);
  const player = useStepPlayer(frames.length);
  const frame = frames[Math.min(player.step, frames.length - 1)];
  const { nodes, edges, cols, maxDepth } = layoutInvert(frame.tree);
  const GX = 66; const GY = 68; const PAD = 28;
  const W = Math.max(cols, 1) * GX + PAD;
  const H = (maxDepth + 1) * GY + PAD;
  const px = (x) => PAD / 2 + x * GX + GX / 2;
  const py = (y) => PAD / 2 + y * GY + 22;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="viz">
      <p className="viz-prompt">Invert a binary tree: swap every node&apos;s left and right child so the whole tree mirrors.</p>
      <svg className="viz-tree" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: Math.min(W, 600) }} role="img" aria-label="Inverting a binary tree">
        {edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={px(byId[a].x)} y1={py(byId[a].y)} x2={px(byId[b].x)} y2={py(byId[b].y)} />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={px(n.x)} cy={py(n.y)} r="20" className={n.id === frame.current ? 'current' : 'visited'} />
            <text x={px(n.x)} y={py(n.y)}>{n.val}</text>
          </g>
        ))}
      </svg>
      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.done ? 'viz-note done' : 'viz-note'}>{frame.note}</span>
      </div>
      <VizControls player={player} />
      <p className="viz-disclaimer">Mirroring this problem&apos;s own sample tree, swap by swap.</p>
    </div>
  );
}

/* ---------- Traverse mode (problem-specific tree) ---------- */
const ORDER_LABELS = { preorder: 'Preorder', inorder: 'Inorder', postorder: 'Postorder', level: 'Level order' };

function buildOrder(root, kind) {
  const out = [];
  if (kind === 'level') {
    const q = [root];
    while (q.length) {
      const n = q.shift();
      out.push(n);
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
    }
    return out;
  }
  (function walk(n) {
    if (!n) return;
    if (kind === 'preorder') out.push(n);
    walk(n.left);
    if (kind === 'inorder') out.push(n);
    walk(n.right);
    if (kind === 'postorder') out.push(n);
  })(root);
  return out;
}

const ORDER_RULES = {
  preorder: 'node → left → right',
  inorder: 'left → node → right',
  postorder: 'left → right → node',
  level: 'top to bottom, left to right (BFS)',
};

function TraverseTreeViz({ tree, order: initialOrder }) {
  const root = useMemo(() => treeFromLevelOrder(tree), [tree]);
  const [order, setOrder] = useState(
    ORDER_LABELS[initialOrder] ? initialOrder : 'preorder'
  );
  const seq = useMemo(() => buildOrder(root, order), [root, order]);
  const player = useStepPlayer(seq.length);
  const { step } = player;
  const current = seq[Math.min(step, seq.length - 1)];
  const visitedIds = new Set(seq.slice(0, step + 1).map((n) => n.id));
  const { nodes, edges, cols, maxDepth } = useMemo(() => layoutInvert(root), [root]);
  const GX = 66; const GY = 68; const PAD = 28;
  const W = Math.max(cols, 1) * GX + PAD;
  const H = (maxDepth + 1) * GY + PAD;
  const px = (x) => PAD / 2 + x * GX + GX / 2;
  const py = (y) => PAD / 2 + y * GY + 22;
  const posById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  function switchOrder(o) {
    setOrder(o);
    player.setStep(0);
    player.setPlaying(false);
  }

  function nodeClass(id) {
    if (id === current.id) return 'current';
    if (visitedIds.has(id)) return 'visited';
    return '';
  }

  return (
    <div className="viz">
      <div className="viz-modes">
        {Object.keys(ORDER_LABELS).map((o) => (
          <button key={o} className={o === order ? 'active' : ''} onClick={() => switchOrder(o)}>
            {ORDER_LABELS[o]}
          </button>
        ))}
      </div>

      <p className="viz-prompt"><b>{ORDER_LABELS[order]}</b>: {ORDER_RULES[order]}</p>

      <svg className="viz-tree" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: Math.min(W, 600) }} role="img" aria-label={`${ORDER_LABELS[order]} traversal of this problem's tree`}>
        <title>{ORDER_LABELS[order]} traversal</title>
        {edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={px(posById[a].x)} y1={py(posById[a].y)} x2={px(posById[b].x)} y2={py(posById[b].y)} />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={px(n.x)} cy={py(n.y)} r="20" className={nodeClass(n.id)} />
            <text x={px(n.x)} y={py(n.y)}>{n.val}</text>
          </g>
        ))}
      </svg>

      <div className="viz-out">
        <span className="viz-out-label">Output:</span>
        {seq.slice(0, step + 1).map((n, i) => (
          <span key={i} className={`pill${n.id === current.id ? ' current' : ''}`}>{n.val}</span>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className="viz-note">Visit node {current.val}.</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">Traversing this problem&apos;s own sample tree.</p>
    </div>
  );
}

/**
 * Binary-tree visualizer.
 * @param {object} [input] problem-specific data:
 *   { mode:'traverse', tree:(number|null)[] level-order, order?:'preorder'|'inorder'|'postorder'|'level' }
 *   { mode:'invert', tree:(number|null)[] level-order }
 * When omitted it runs the generic BST demo with an order switcher.
 */
export default function TreeTraversalViz({ input }) {
  const [mode, setMode] = useState('Preorder');
  const order = useMemo(() => MODES[mode].build(), [mode]);
  const player = useStepPlayer(order.length);
  const { step } = player;
  const current = order[Math.min(step, order.length - 1)];
  const visited = new Set(order.slice(0, step + 1));

  if (input && input.mode === 'invert') return <InvertTreeViz tree={input.tree} />;
  if (input && input.mode === 'traverse' && Array.isArray(input.tree) && input.tree.length && input.tree[0] != null) {
    return <TraverseTreeViz tree={input.tree} order={input.order} />;
  }

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
