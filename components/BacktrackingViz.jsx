'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const ELEMS = [1, 2, 3];

const NODES = [];
const EDGES = [];
(function build(depth, subset, parent) {
  const id = NODES.length;
  const node = { id, depth, subset: [...subset], parent, children: [], isLeaf: depth === ELEMS.length };
  NODES.push(node);
  if (parent != null) {
    NODES[parent].children.push(id);
    EDGES.push([parent, id]);
  }
  if (depth < ELEMS.length) {
    build(depth + 1, subset, id);
    build(depth + 1, [...subset, ELEMS[depth]], id);
  }
  return id;
})(0, [], null);

const VB_W = 640;
const MARGIN = 44;
const V_GAP = 78;
const TOP = 36;
const leaves = NODES.filter((n) => n.isLeaf);
leaves.forEach((lf, i) => { lf.x = MARGIN + (VB_W - 2 * MARGIN) * (i / (leaves.length - 1)); });
(function setX(id) {
  const n = NODES[id];
  if (n.children.length === 0) return n.x;
  const xs = n.children.map(setX);
  n.x = (Math.min(...xs) + Math.max(...xs)) / 2;
  return n.x;
})(0);
NODES.forEach((n) => { n.y = TOP + n.depth * V_GAP; });
const VB_H = TOP + ELEMS.length * V_GAP + 36;

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
const label = (subset) => (subset.length ? subset.join('') : '∅');
const setStr = (subset) => `{${subset.join(', ')}}`;

function pathToRoot(id) {
  const path = [];
  let cur = id;
  while (cur != null) { path.push(cur); cur = byId[cur].parent; }
  return new Set(path);
}

export default function BacktrackingViz() {
  const player = useStepPlayer(NODES.length);
  const { step } = player;
  const node = NODES[Math.min(step, NODES.length - 1)];
  const pathSet = useMemo(() => pathToRoot(node.id), [node.id]);
  const results = NODES.filter((n) => n.id <= step && n.isLeaf).map((n) => n.subset);

  function nodeClass(id) {
    if (id === node.id) return 'current';
    if (pathSet.has(id)) return 'path';
    if (id < step) return 'visited';
    return '';
  }

  const note = node.isLeaf
    ? `Leaf reached — record ${setStr(node.subset)}.`
    : `At ${setStr(node.subset)}: branch on whether to include ${ELEMS[node.depth]}.`;

  return (
    <div className="viz">
      <p className="viz-prompt">
        Backtracking builds all subsets of <b>[1, 2, 3]</b>. Each level decides one
        element: left = skip, right = take. Leaves are finished subsets.
      </p>

      <svg className="viz-btree" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="subset decision tree">
        <title>Backtracking decision tree</title>
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y}
            className={pathSet.has(a) && pathSet.has(b) ? 'on-path' : ''} />
        ))}
        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="18" className={nodeClass(n.id)} />
            <text x={n.x} y={n.y}>{label(n.subset)}</text>
          </g>
        ))}
      </svg>

      <div className="viz-struct">
        <span className="viz-out-label">Current path:</span>
        <span className="pill current">{setStr(node.subset)}</span>
      </div>

      <div className="viz-out">
        <span className="viz-out-label">Subsets found ({results.length}):</span>
        {results.map((s, i) => (
          <span key={i} className={`pill${i === results.length - 1 && node.isLeaf ? ' current' : ''}`}>{setStr(s)}</span>
        ))}
      </div>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={node.isLeaf ? 'viz-note done' : 'viz-note'}>{note}</span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        Illustrates the general pattern with a sample input — not a solver for this exact problem.
      </p>
    </div>
  );
}
