'use client';

import Link from 'next/link';
import { PATTERNS, pickPattern } from '../lib/patterns';
import { COMPONENTS } from './vizComponents';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Picks an interactive visualizer for a problem.
 * - `viz` (from solutions.json) wins when present: { key, input } drives a
 *   problem-SPECIFIC animation on this problem's own sample input.
 * - Otherwise we fall back to a tag-based generic pattern demo.
 * If neither resolves, we show a helpful note listing the patterns we cover.
 */
export default function PatternViz({ tags = [], viz = null }) {
  const match = pickPattern(tags);
  const key = (viz && viz.key) || (match && match.key);
  const Component = key ? COMPONENTS[key] : null;

  if (!Component) {
    return (
      <div className="viz-placeholder">
        <svg className="ph-mark" viewBox="0 0 64 40" width="84" height="52" aria-hidden="true">
          <line x1="14" y1="20" x2="32" y2="10" />
          <line x1="14" y1="20" x2="32" y2="30" />
          <line x1="32" y1="10" x2="50" y2="20" />
          <line x1="32" y1="30" x2="50" y2="20" />
          <circle cx="14" cy="20" r="5" />
          <circle cx="32" cy="10" r="5" />
          <circle cx="32" cy="30" r="5" />
          <circle cx="50" cy="20" r="5" />
        </svg>
        <p>
          No interactive visualizer matches this problem&apos;s tags yet. We currently
          animate {PATTERNS.length} patterns: {PATTERNS.map((p) => p.label).join(', ')}.
        </p>
        <p>
          <Link className="inline-link" href="/patterns">Browse all visualizers →</Link>
        </p>
      </div>
    );
  }

  const pat = PATTERNS.find((p) => p.key === key);
  const specific = !!(viz && viz.input);

  return (
    <div>
      <p className="section-note">
        {specific ? (
          <>Stepping through <b>this problem&apos;s</b> sample input with the {pat ? pat.label : 'matching'} technique.</>
        ) : (
          <>This problem uses the <b>{pat ? pat.label : 'matching'}</b> pattern.</>
        )}{' '}
        <a className="inline-link" href={`${BASE}/patterns/${key}/`}>Open it standalone →</a>
      </p>
      <Component input={specific ? viz.input : undefined} />
    </div>
  );
}
