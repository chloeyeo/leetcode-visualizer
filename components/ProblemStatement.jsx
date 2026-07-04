'use client';

/**
 * Renders a problem summary as three scannable, collapsible sections —
 * Goal / Constraints / Examples — instead of one wall of text.
 *
 * Schema: an entry may provide explicit `goal`, `constraints`, `examples`
 * strings. If it only has `aiSummary` (our current Top-20 format), we split it
 * by paragraph: paragraphs starting with "Example"/"Constraints" route to those
 * sections, everything else is the goal. So all existing entries chunk for free.
 */
/**
 * Renders `backtick-wrapped` tokens in prose as inline <code> instead of
 * showing the literal backticks. Plain text otherwise — no other markdown.
 */
export function InlineCode({ text }) {
  const parts = String(text).split(/(`[^`\n]+`)/g);
  return parts.map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2
      ? <code className="inline-code" key={i}>{part.slice(1, -1)}</code>
      : part
  );
}

function chunk(sol) {
  if (!sol) return { goal: '', constraints: '', examples: '' };
  if (sol.goal || sol.constraints || sol.examples) {
    return { goal: sol.goal || '', constraints: sol.constraints || '', examples: sol.examples || '' };
  }
  const paras = (sol.aiSummary || '').split('\n\n').map((p) => p.trim()).filter(Boolean);
  const goal = [];
  const constraints = [];
  const examples = [];
  for (const p of paras) {
    if (/^examples?\s*:/i.test(p)) examples.push(p.replace(/^examples?\s*:\s*/i, ''));
    else if (/^constraints?\s*:/i.test(p)) constraints.push(p.replace(/^constraints?\s*:\s*/i, ''));
    else goal.push(p);
  }
  return { goal: goal.join('\n\n'), constraints: constraints.join('\n\n'), examples: examples.join('\n\n') };
}

export default function ProblemStatement({ sol, compact = false }) {
  const { goal, constraints, examples } = chunk(sol);
  if (!goal && !constraints && !examples) return null;
  return (
    <div className="ps">
      <details className="ps-sec ps-goal" open>
        <summary className="ps-head">🎯 The goal</summary>
        <p className="prob-para"><InlineCode text={goal} /></p>
      </details>
      {constraints && (
        <details className="ps-sec ps-rules" open={!compact}>
          <summary className="ps-head">📏 Constraints &amp; rules</summary>
          <p className="prob-para"><InlineCode text={constraints} /></p>
        </details>
      )}
      {examples && (
        <details className="ps-sec ps-ex" open={!compact}>
          <summary className="ps-head">🧪 Examples</summary>
          <p className="prob-para"><InlineCode text={examples} /></p>
        </details>
      )}
    </div>
  );
}
