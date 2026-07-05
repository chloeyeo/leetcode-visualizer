'use client';

import { useMemo } from 'react';
import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const WORDS = ['cat', 'car', 'card', 'dog'];

const VB_W = 600;
const MARGIN = 48;
const TOP = 34;
const GAPY = 66;

/** Build the trie, its insertion frames, and the tree layout for a word list. */
function buildModel(words) {
  const nodes = [{ id: 0, ch: 'root', isEnd: false, parent: null, depth: 0, children: {}, createdAt: -1, endAt: Infinity }];
  const frames = [];
  let stepCounter = 0;
  for (const w of words) {
    let cur = 0;
    for (let k = 0; k < w.length; k++) {
      const ch = w[k];
      let child = nodes[cur].children[ch];
      let created = false;
      if (child == null) {
        const id = nodes.length;
        nodes.push({ id, ch, isEnd: false, parent: cur, depth: nodes[cur].depth + 1, children: {}, createdAt: stepCounter, endAt: Infinity });
        nodes[cur].children[ch] = id;
        child = id;
        created = true;
      }
      frames.push({ node: child, word: w, prefix: w.slice(0, k + 1), created, step: stepCounter });
      cur = child;
      stepCounter++;
    }
    nodes[cur].isEnd = true;
    nodes[cur].endAt = frames[frames.length - 1].step;
    frames[frames.length - 1].wordDone = true;
  }

  const leaves = [];
  (function collect(id) {
    const kids = Object.values(nodes[id].children);
    if (kids.length === 0) leaves.push(id);
    else kids.forEach(collect);
  })(0);
  const span = VB_W - 2 * MARGIN;
  let li = 0;
  (function assign(id) {
    const n = nodes[id];
    const kids = Object.values(n.children);
    if (kids.length === 0) {
      n.x = MARGIN + (leaves.length === 1 ? span / 2 : span * (li / (leaves.length - 1)));
      li++;
    } else {
      kids.forEach(assign);
      n.x = (nodes[kids[0]].x + nodes[kids[kids.length - 1]].x) / 2;
    }
    n.y = TOP + n.depth * GAPY;
  })(0);

  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  return {
    nodes,
    frames,
    byId: Object.fromEntries(nodes.map((n) => [n.id, n])),
    vbH: TOP + maxDepth * GAPY + 34,
    words,
  };
}

/**
 * Trie (prefix tree) visualizer.
 * @param {object} [input] problem-specific data: { words:string[] } — the
 * problem's own lowercase words, inserted one by one.
 * When omitted it inserts a generic sample word list.
 */
export default function TrieViz({ input }) {
  const words = input && Array.isArray(input.words) && input.words.length >= 2 ? input.words : WORDS;
  const { nodes, frames, byId, vbH } = useMemo(() => buildModel(words), [words]);
  const player = useStepPlayer(frames.length);
  const { step } = player;
  const frame = frames[Math.min(step, frames.length - 1)];
  const s = frame.step;
  const visible = (n) => n.id === 0 || n.createdAt <= s;
  const insertedWords = [...new Set(frames.slice(0, step + 1).filter((f) => f.wordDone).map((f) => f.word))];

  function cls(n) {
    if (n.id === frame.node) return 'current';
    if (n.isEnd && s >= n.endAt) return 'end';
    return 'visited';
  }

  return (
    <div className="viz">
      <p className="viz-prompt">
        Insert words into a <b>trie</b>: each letter is a node, shared prefixes reuse
        nodes, and word-endings are marked (green).
      </p>

      <div className="trie-words">
        {words.map((w) => (
          <span key={w} className={`pill${w === frame.word ? ' current' : insertedWords.includes(w) ? ' filled' : ''}`}>{w}</span>
        ))}
      </div>

      <svg className="viz-trie" viewBox={`0 0 ${VB_W} ${vbH}`} role="img" aria-label="trie prefix tree">
        <title>Trie construction</title>
        {nodes.map((n) =>
          n.parent == null || !visible(n) ? null : (
            <line key={`e${n.id}`} x1={n.x} y1={n.y} x2={byId[n.parent].x} y2={byId[n.parent].y} />
          )
        )}
        {nodes.filter(visible).map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="18" className={cls(n)} />
            <text x={n.x} y={n.y}>{n.ch === 'root' ? '•' : n.ch}</text>
          </g>
        ))}
      </svg>

      <div className="viz-status" role="status" aria-live="polite">
        <span className={frame.wordDone ? 'viz-note done' : 'viz-note'}>
          {frame.created ? 'New node: ' : 'Reuse existing node: '}
          <b>{frame.prefix}</b>
          {frame.wordDone ? ` — end of "${frame.word}".` : '…'}
        </span>
      </div>

      <VizControls player={player} />

      <p className="viz-disclaimer">
        {input
          ? "Building the trie from this problem's own sample words."
          : 'Illustrates the general pattern with sample data — not a solver for this exact problem.'}
      </p>
    </div>
  );
}
