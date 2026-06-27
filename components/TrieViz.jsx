'use client';

import { useStepPlayer } from './useStepPlayer';
import VizControls from './VizControls';

const WORDS = ['cat', 'car', 'card', 'dog'];

const NODES = [{ id: 0, ch: 'root', isEnd: false, parent: null, depth: 0, children: {}, createdAt: -1, endAt: Infinity }];
const FRAMES = [];
(function build() {
  let stepCounter = 0;
  for (const w of WORDS) {
    let cur = 0;
    for (let k = 0; k < w.length; k++) {
      const ch = w[k];
      let child = NODES[cur].children[ch];
      let created = false;
      if (child == null) {
        const id = NODES.length;
        NODES.push({ id, ch, isEnd: false, parent: cur, depth: NODES[cur].depth + 1, children: {}, createdAt: stepCounter, endAt: Infinity });
        NODES[cur].children[ch] = id;
        child = id;
        created = true;
      }
      FRAMES.push({ node: child, word: w, prefix: w.slice(0, k + 1), created, step: stepCounter });
      cur = child;
      stepCounter++;
    }
    NODES[cur].isEnd = true;
    NODES[cur].endAt = FRAMES[FRAMES.length - 1].step;
    FRAMES[FRAMES.length - 1].wordDone = true;
  }
})();

const VB_W = 600;
const MARGIN = 48;
const TOP = 34;
const GAPY = 66;
(function layout() {
  const leaves = [];
  (function collect(id) {
    const kids = Object.values(NODES[id].children);
    if (kids.length === 0) leaves.push(id);
    else kids.forEach(collect);
  })(0);
  const span = VB_W - 2 * MARGIN;
  let li = 0;
  (function assign(id) {
    const n = NODES[id];
    const kids = Object.values(n.children);
    if (kids.length === 0) {
      n.x = MARGIN + (leaves.length === 1 ? span / 2 : span * (li / (leaves.length - 1)));
      li++;
    } else {
      kids.forEach(assign);
      n.x = (NODES[kids[0]].x + NODES[kids[kids.length - 1]].x) / 2;
    }
    n.y = TOP + n.depth * GAPY;
  })(0);
})();
const maxDepth = Math.max(...NODES.map((n) => n.depth));
const VB_H = TOP + maxDepth * GAPY + 34;
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

export default function TrieViz() {
  const player = useStepPlayer(FRAMES.length);
  const { step } = player;
  const frame = FRAMES[Math.min(step, FRAMES.length - 1)];
  const s = frame.step;
  const visible = (n) => n.id === 0 || n.createdAt <= s;
  const insertedWords = [...new Set(FRAMES.slice(0, step + 1).filter((f) => f.wordDone).map((f) => f.word))];

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
        {WORDS.map((w) => (
          <span key={w} className={`pill${w === frame.word ? ' current' : insertedWords.includes(w) ? ' filled' : ''}`}>{w}</span>
        ))}
      </div>

      <svg className="viz-trie" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="trie prefix tree">
        <title>Trie construction</title>
        {NODES.map((n) =>
          n.parent == null || !visible(n) ? null : (
            <line key={`e${n.id}`} x1={n.x} y1={n.y} x2={byId[n.parent].x} y2={byId[n.parent].y} />
          )
        )}
        {NODES.filter(visible).map((n) => (
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
        Illustrates the general pattern with sample data — not a solver for this exact problem.
      </p>
    </div>
  );
}
