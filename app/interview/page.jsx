'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import InterviewSession from '../../components/InterviewSession';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function InterviewPage() {
  const [problems, setProblems] = useState(null);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/problems.json`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        setProblems(d);
        setStatus('ready');
        const slug = new URLSearchParams(window.location.search).get('problem');
        if (slug) {
          const p = d.find((x) => x.slug === slug);
          if (p) setSelected(p);
        }
      })
      .catch(() => setStatus('error'));
  }, []);

  const filtered = useMemo(() => {
    if (!problems) return [];
    const q = query.trim().toLowerCase();
    if (!q) return problems.slice(0, 40);
    return problems.filter((p) => `${p.id} ${p.title}`.toLowerCase().includes(q)).slice(0, 40);
  }, [problems, query]);

  if (selected) {
    return <InterviewSession problem={selected} onExit={() => { setSelected(null); history.replaceState(null, '', window.location.pathname); }} />;
  }

  return (
    <div>
      <Link className="back-link" href="/">&#8592; All problems</Link>
      <section className="hero">
        <h1>Mock Interview <span className="beta-tag">prototype</span></h1>
        <p>
          Practice the FAANG-style loop out loud: restate the problem, clarify, give a brute force,
          justify Big-O, optimize, then code — with a coach that guides each phase and grades your
          communication at the end. Pick a problem to begin.
        </p>
      </section>

      <div className="controls">
        <div className="search-box">
          <input type="text" placeholder="Search a problem to practice…" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search problems" />
        </div>
      </div>

      {status === 'loading' && <p className="loading">Loading problems…</p>}
      {status === 'error' && <p className="empty-state">Couldn&apos;t load the problem list.</p>}
      {status === 'ready' && (
        <div className="grid">
          {filtered.map((p) => (
            <button className="card iv-pick" key={p.slug} onClick={() => setSelected(p)}>
              <span className={`diff-chip ${p.difficulty}`} aria-hidden="true">{p.difficulty[0]}</span>
              <span className="num">{p.id}</span>
              <span className="grow"><span className="title">{p.title}</span></span>
              <span className="iv-start">Start →</span>
            </button>
          ))}
        </div>
      )}

      <p className="viz-disclaimer pg-foot">
        Speech recognition works in Chrome/Edge; other browsers fall back to typing. Everything runs
        locally — no recording leaves your machine in this prototype.
      </p>
    </div>
  );
}
