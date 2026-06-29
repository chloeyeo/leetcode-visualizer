'use client';

import { useEffect, useState } from 'react';
import InterviewSession from '../../components/InterviewSession';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Interview is always entered from a specific problem (its "Practice interview"
 * button links here with ?problem=<slug>). There is no standalone problem picker
 * — visiting /interview without a problem just sends you back to the catalog.
 */
export default function InterviewPage() {
  const [state, setState] = useState({ status: 'loading', problem: null });

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('problem');
    if (!slug) { window.location.replace(`${BASE}/`); return; }
    fetch(`${BASE}/problems.json`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        const p = d.find((x) => x.slug === slug);
        if (p) setState({ status: 'ready', problem: p });
        else window.location.replace(`${BASE}/`);
      })
      .catch(() => setState({ status: 'error', problem: null }));
  }, []);

  if (state.status === 'ready' && state.problem) {
    return (
      <InterviewSession
        problem={state.problem}
        onExit={() => window.location.assign(`${BASE}/problem/${state.problem.slug}`)}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <p className="empty-state">
        Couldn&apos;t load that problem.{' '}
        <a className="inline-link" href={`${BASE}/`}>Back to all problems →</a>
      </p>
    );
  }
  return <p className="loading">Setting up your interview…</p>;
}
