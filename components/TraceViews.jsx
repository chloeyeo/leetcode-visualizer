'use client';

/* Reusable renderers for an execution trace (shared by Trace and Compare modes). */

export function CodeView({ lines, active }) {
  return (
    <div className="pg-codeview">
      {lines.map((ln, i) => (
        <div key={i} className={`code-line${active === i + 1 ? ' active' : ''}`}>
          <span className="code-ln">{i + 1}</span>
          <code>{ln || ' '}</code>
        </div>
      ))}
    </div>
  );
}

function ArrayCells({ list, prev }) {
  return (
    <div className="ds-cells">
      {list.length === 0 && <span className="pg-muted">empty</span>}
      {list.map((el, i) => {
        const changed = !prev || prev[i] !== el;
        return (
          <div key={i} className={`ds-cell${changed ? ' changed' : ''}`}>
            <span className="ds-val">{el}</span>
            <span className="ds-idx">{i}</span>
          </div>
        );
      })}
    </div>
  );
}

function LinkedCells({ vals, cyclic }) {
  return (
    <div className="ds-llist">
      {vals.length === 0 && <span className="pg-muted">empty</span>}
      {vals.map((v, i) => (
        <span key={i} className="ds-llist-node">
          <span className="ds-cell"><span className="ds-val">{v}</span></span>
          {i < vals.length - 1 && <span className="ds-arrow">→</span>}
        </span>
      ))}
      {vals.length > 0 && <span className="ds-arrow">→</span>}
      <span className="ds-null">{cyclic ? '⟲ cycle' : 'null'}</span>
    </div>
  );
}

function DictChips({ entries }) {
  return (
    <div className="ds-dict">
      {entries.length === 0 && <span className="pg-muted">empty</span>}
      {entries.map(([k, v], i) => (
        <span className="ds-kv" key={i}><b>{k}</b>: {v}</span>
      ))}
    </div>
  );
}

// Lay out a nested {val,left,right} tree with in-order x positions.
function layoutTree(root) {
  const nodes = [];
  const edges = [];
  let counter = 0;
  function walk(n, depth) {
    if (!n) return null;
    const leftId = walk(n.left, depth + 1);
    const id = nodes.length;
    nodes.push({ id, x: counter++, y: depth, val: n.val });
    if (leftId != null) edges.push([id, leftId]);
    const rightId = walk(n.right, depth + 1);
    if (rightId != null) edges.push([id, rightId]);
    return id;
  }
  walk(root, 0);
  return { nodes, edges, width: counter };
}

function TreeView({ root }) {
  if (!root) return <span className="ds-null">null</span>;
  const { nodes, edges, width } = layoutTree(root);
  const GX = 46;
  const GY = 56;
  const PAD = 24;
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.y), 0);
  const W = Math.max(width, 1) * GX + PAD;
  const H = (maxDepth + 1) * GY + PAD;
  const px = (n) => PAD / 2 + n.x * GX + GX / 2;
  const py = (n) => PAD / 2 + n.y * GY + 20;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <svg className="viz-tree ds-tree" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: Math.min(W, 420) }} role="img" aria-label="binary tree value">
      {edges.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={px(byId[a])} y1={py(byId[a])} x2={px(byId[b])} y2={py(byId[b])} />
      ))}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={px(n)} cy={py(n)} r="16" className="visited" />
          <text x={px(n)} y={py(n)}>{n.val}</text>
        </g>
      ))}
    </svg>
  );
}

export function DataStructures({ locals, prevLocals }) {
  const entries = Object.entries(locals).filter(
    ([, val]) => val && ['list', 'llist', 'tree', 'dict'].includes(val.t)
  );
  if (!entries.length) return null;
  return (
    <div className="pg-ds">
      <h3>Data structures</h3>
      {entries.map(([name, val]) => (
        <div className="ds-row" key={name}>
          <span className="ds-name">{name}</span>
          {val.t === 'list' && (
            <ArrayCells list={val.v} prev={prevLocals && prevLocals[name] && prevLocals[name].t === 'list' ? prevLocals[name].v : null} />
          )}
          {val.t === 'llist' && <LinkedCells vals={val.v} cyclic={val.cyclic} />}
          {val.t === 'tree' && <TreeView root={val.v} />}
          {val.t === 'dict' && <DictChips entries={val.v} />}
        </div>
      ))}
    </div>
  );
}

export function VarTable({ locals }) {
  const entries = Object.entries(locals);
  if (!entries.length) return <p className="pg-muted">No locals in scope.</p>;
  const fmt = (val) =>
    val.t === 'list' ? `[${val.v.join(', ')}]`
      : val.t === 'dict' ? `{${val.v.map(([k, v]) => `${k}: ${v}`).join(', ')}}`
        : val.t === 'llist' ? `${val.v.join(' → ')}${val.cyclic ? ' → ⟲' : ' → null'}`
          : val.t === 'tree' ? '<tree>'
            : val.v;
  return (
    <table className="var-table">
      <tbody>
        {entries.map(([k, val]) => (
          <tr key={k}><td className="var-name">{k}</td><td className="var-val">{fmt(val)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function CallStack({ frame }) {
  return (
    <div className="call-stack">
      {frame.stack.slice().reverse().map((fn, i) => (
        <div key={i} className={`stack-frame${i === 0 ? ' top' : ''}`}>{fn}()</div>
      ))}
    </div>
  );
}
