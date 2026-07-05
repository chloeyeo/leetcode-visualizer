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
 * Natural math in prose, for EVERY problem: any base^exp → real <sup>
 * (10^9, 2^31, x^n, base^k, (2+1)^x), <= → ≤, >= → ≥, != → ≠, spaced -> → →,
 * 3 * 10^4 → 3 × 10⁴. Text-level only — backtick code spans are left as-is,
 * and spaced XOR ("a ^ b") is untouched since the exponent must hug the ^.
 */
function MathProse({ text }) {
  const s = String(text)
    .replace(/[ \t]*<=[ \t]*/g, ' ≤ ')
    .replace(/[ \t]*>=[ \t]*/g, ' ≥ ')
    .replace(/[ \t]*!=[ \t]*/g, ' ≠ ')
    .replace(/[ \t]->[ \t]/g, ' → ')
    .replace(/(\d)\s*\*\s*(?=\d)/g, '$1 × ');
  // split(/\^(-?\w+)/) alternates [text, exponent, text, exponent, …]
  return s.split(/\^(-?\w+)/g).map((chunk, i) =>
    i % 2 === 1 ? <sup key={i}>{chunk}</sup> : chunk
  );
}

/**
 * Renders `backtick-wrapped` tokens in prose as inline <code> instead of
 * showing the literal backticks; everything else gets natural math notation
 * via MathProse. No other markdown.
 */
export function InlineCode({ text }) {
  const parts = String(text).split(/(`[^`\n]+`)/g);
  return parts.map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2
      ? <code className="inline-code" key={i}>{part.slice(1, -1)}</code>
      : <MathProse key={i} text={part} />
  );
}

/**
 * InlineCode plus value highlighting for example text: array literals and
 * quoted strings render as code chips so inputs/outputs pop out of the prose.
 */
function RichText({ text }) {
  const parts = String(text).split(/((?<![\w\]])\[[^\[\]\n]{0,80}\]|"[^"\n]{0,60}"|'[^'\n]{0,60}')/g);
  return parts.map((part, i) =>
    /^(\[.*\]|".*"|'.*')$/.test(part)
      ? <code className="inline-code" key={i}>{part}</code>
      : <InlineCode key={i} text={part} />
  );
}

/** Constraints as a scannable list of code-styled lines, LeetCode-style. */
function ConstraintList({ text }) {
  const items = String(text).split(/\s*·\s*|\n+/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  return (
    <ul className="ps-constraints">
      {items.map((item, i) => (
        <li key={i}><InlineCode text={item} /></li>
      ))}
    </ul>
  );
}

/**
 * Examples as separate blocks, one per case, with Input/Output/Explanation
 * labels emphasized and literal values shown as code chips. Handles the
 * catalog's real shapes: "Input: X → Output: Y; Input: …", "Example 1: …",
 * newline-separated cases, and single free-form sentences.
 */
function ExampleList({ text }) {
  const rows = String(text)
    .split(/\n+|;\s+/)
    .flatMap((seg) => seg.split(/(?!^)(?=Input\s*:)/))
    .flatMap((seg) => seg.split(/(?!^)(?=Example\s*\d+\s*:)/i))
    .map((s) => s.trim())
    .filter(Boolean);
  if (!rows.length) return null;
  const LABEL = /(Input\s*:|Output\s*:|Explanation\s*:|Example\s*\d+\s*:)/gi;
  return (
    <ul className="ps-examples">
      {rows.map((row, i) => (
        <li key={i}>
          {row.split(LABEL).map((piece, j) =>
            /^(Input|Output|Explanation|Example\s*\d+)\s*:$/i.test(piece)
              ? <b className="ps-label" key={j}>{piece}</b>
              : <RichText key={j} text={piece} />
          )}
        </li>
      ))}
    </ul>
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
          <ConstraintList text={constraints} />
        </details>
      )}
      {examples && (
        <details className="ps-sec ps-ex" open={!compact}>
          <summary className="ps-head">🧪 Examples</summary>
          <ExampleList text={examples} />
        </details>
      )}
    </div>
  );
}
