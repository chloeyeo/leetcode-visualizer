'use client';

import Link from 'next/link';
import { PATTERNS, pickPattern } from '../lib/patterns';
import { COMPONENTS } from './vizComponents';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Picks an interactive visualizer from a problem's tags. If none match, shows a
 * helpful note that names the patterns that ARE covered and links to them.
 */
export default function PatternViz({ tags = [] }) {
  const match = pickPattern(tags);

  if (!match) {
    return (
      <div className="viz-placeholder">
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

  const Component = COMPONENTS[match.key];
  return (
    <div>
      <p className="section-note">
        This problem uses the <b>{match.label}</b> pattern.{' '}
        <a className="inline-link" href={`${BASE}/patterns/${match.key}/`}>Open it standalone →</a>
      </p>
      <Component />
    </div>
  );
}
