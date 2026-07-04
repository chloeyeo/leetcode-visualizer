/**
 * Copyright-safe starter scaffolds + summary assembly, shared by the problem
 * pages (server), the Playground, and the Interview (client).
 *
 * Everything here is built ONLY from catalog facts — title, slug, id, tags,
 * difficulty — which are metadata, not LeetCode's copyrighted statement text.
 * The statement itself is always a link-out, never copied.
 */

/** two-sum → two_sum · 3sum → solve_3sum (identifiers can't start with a digit) */
export function funcNameFor(slug) {
  const base = String(slug || 'solution').toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
  const name = /^[0-9]/.test(base) ? `solve_${base}` : base;
  return name || 'solution';
}

/**
 * A runnable, original Python scaffold for ANY problem in the catalog.
 * `q`: { slug, title, id?, tags?, difficulty? } · `opts.hint` overrides the body comment.
 */
export function starterFor(q, opts = {}) {
  const fn = funcNameFor(q.slug);
  const meta = [q.id ? `${q.id}. ` : '', q.title || q.slug, q.difficulty ? ` · ${q.difficulty}` : ''].join('');
  const tags = (q.tags || []).length ? `\n# Tags: ${q.tags.slice(0, 4).join(', ')}` : '';
  const hint = opts.hint || 'Read the statement, sketch your plan in comments, then implement.';
  return `# ${meta}${tags}\n# Full statement: https://leetcode.com/problems/${q.slug}/\n\ndef ${fn}():\n    # ${hint}\n    pass\n\nprint(${fn}())\n`;
}

/**
 * Normalizes a solutions.json entry to one summary text. Hand-authored entries
 * carry `aiSummary`; generated ones carry goal/constraints/examples. The
 * "Constraints:"/"Examples:" prefixes are re-split into sections by
 * ProblemStatement's chunk(). Returns null when there is nothing to show.
 */
export function summaryTextFor(entry) {
  if (!entry) return null;
  if (entry.aiSummary) return entry.aiSummary;
  if (!entry.goal) return null;
  const parts = [entry.goal];
  if (entry.constraints) parts.push(`Constraints: ${entry.constraints}`);
  if (entry.examples) parts.push(`Examples: ${entry.examples}`);
  return parts.join('\n\n');
}
