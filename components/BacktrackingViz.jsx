'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const ELEMS = [1, 2, 3];
const MAX_ELEMS = 4; // 2^4 leaves is the widest tree the 640px viewBox can hold

const VB_W = 640;
const MARGIN = 44;
const V_GAP = 78;
const TOP = 36;

/** Build the full include/skip decision tree + layout for a set of elements. */
function buildModel(elems) {
  const nodes = [];
  const edges = [];
  (function build(depth, subset, parent) {
    const id = nodes.length;
    const node = { id, depth, subset: [...subset], parent, children: [], isLeaf: depth === elems.length };
    nodes.push(node);
    if (parent != null) {
      nodes[parent].children.push(id);
      edges.push([parent, id]);
    }
    if (depth < elems.length) {
      build(depth + 1, subset, id);
      build(depth + 1, [...subset, elems[depth]], id);
    }
    return id;
  })(0, [], null);

  const leaves = nodes.filter((n) => n.isLeaf);
  leaves.forEach((lf, i) => {
    lf.x = leaves.length === 1 ? VB_W / 2 : MARGIN + (VB_W - 2 * MARGIN) * (i / (leaves.length - 1));
  });
  (function setX(id) {
    const n = nodes[id];
    if (n.children.length === 0) return n.x;
    const xs = n.children.map(setX);
    n.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    return n.x;
  })(0);
  nodes.forEach((n) => { n.y = TOP + n.depth * V_GAP; });

  return {
    nodes,
    edges,
    byId: Object.fromEntries(nodes.map((n) => [n.id, n])),
    vbH: TOP + elems.length * V_GAP + 36,
    elems,
  };
}

const label = (subset) => (subset.length ? subset.join('') : '∅');
const setStr = (subset) => `{${subset.join(', ')}}`;

function pathToRoot(byId, id) {
  const path = [];
  let cur = id;
  while (cur != null) { path.push(cur); cur = byId[cur].parent; }
  return new Set(path);
}

/**
 * Backtracking (subsets decision tree) visualizer.
 * @param {object} [input] problem-specific data: { elems:(number|string)[] } —
 * the problem's own elements (max 4, so the tree stays drawable).
 * When omitted it enumerates the subsets of [1, 2, 3].
 */
export default function BacktrackingViz({ input }) {
  const elems = input && Array.isArray(input.elems) && input.elems.length
    ? input.elems.slice(0, MAX_ELEMS)
    : ELEMS;
  const { nodes, edges, byId, vbH } = useMemo(() => buildModel(elems), [elems]);
  const player = useStepPlayer(nodes.length);
  const { step } = player;
  const node = nodes[Math.min(step, nodes.length - 1)];
  const pathSet = useMemo(() => pathToRoot(byId, node.id), [byId, node.id]);
  const results = nodes.filter((n) => n.id <= step && n.isLeaf).map((n) => n.subset);

  function nodeClass(id) {
    if (id === node.id) return 'current';
    if (pathSet.has(id)) return 'path';
    if (id < step) return 'visited';
    return '';
  }

  const note = node.isLeaf
    ? `Leaf reached — record ${setStr(node.subset)}.`
    : `At ${setStr(node.subset)}: branch on whether to include ${elems[node.depth]}.`;

  return (
    <div className="viz">
      <p className="viz-prompt">
        Backtracking builds all subsets of <b>[{elems.join(', ')}]</b>. Each level decides one
        element: left = skip, right = take. Leaves are finished subsets.
      </p>

      <svg className="viz-btree" viewBox={`0 0 ${VB_W} ${vbH}`} role="img" aria-label="subset decision tree">
        <title>Backtracking decision tree</title>
        {edges.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y}
            className={pathSet.has(a) && pathSet.has(b) ? 'on-path' : ''} />
        ))}
        {nodes.map((n) => (
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
        {input
          ? "Enumerating the subsets of this problem's own sample elements."
          : 'Illustrates the general pattern with a sample input — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
