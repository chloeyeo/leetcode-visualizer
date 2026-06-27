'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { pickPattern } from '../lib/patterns';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const DIFFS = ['All', 'Easy', 'Medium', 'Hard'];
const PAGE_SIZE = 50;

export default function Home() {
  const [problems, setProblems] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [query, setQuery] = useState('');
  const [diff, setDiff] = useState('All');
  const [tag, setTag] = useState('All');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const load = useCallback(() => {
    setStatus('loading');
    fetch(`${BASE}/problems.json`)
      .then((r) => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then((d) => { setProblems(d); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);

  // initial load + restore filters from the URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('q')) setQuery(p.get('q'));
    if (p.get('diff')) setDiff(p.get('diff'));
    if (p.get('tag')) setTag(p.get('tag'));
    load();
  }, [load]);

  // persist filters to the URL (shareable, survives refresh + back button)
  useEffect(() => {
    if (status !== 'ready') return;
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (diff !== 'All') p.set('diff', diff);
    if (tag !== 'All') p.set('tag', tag);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [query, diff, tag, status]);

  useEffect(() => setLimit(PAGE_SIZE), [query, diff, tag]);

  const tags = useMemo(() => {
    if (!problems) return [];
    const set = new Set();
    problems.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return ['All', ...Array.from(set).sort()];
  }, [problems]);

  const diffCounts = useMemo(() => {
    const c = { Easy: 0, Medium: 0, Hard: 0 };
    (problems || []).forEach((p) => { c[p.difficulty] = (c[p.difficulty] || 0) + 1; });
    return c;
  }, [problems]);

  const filtered = useMemo(() => {
    if (!problems) return [];
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (diff !== 'All' && p.difficulty !== diff) return false;
      if (tag !== 'All' && !(p.tags || []).includes(tag)) return false;
      if (q && !`${p.id} ${p.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [problems, query, diff, tag]);

  const anyFilter = query || diff !== 'All' || tag !== 'All';
  const clearFilters = () => { setQuery(''); setDiff('All'); setTag('All'); };
  const hasViz = (p) => !!pickPattern(p.tags || []);

  return (
    <>
      <section className="hero">
        <h1>See the pattern behind every LeetCode problem.</h1>
        <p>
          Browse the full problem set and open any one for a step-by-step{' '}
          <b>interactive visualizer</b> of the algorithm pattern it uses — plus a video
          walkthrough when you want to go deeper.{' '}
          <Link className="inline-link" href="/patterns">Browse visualizers by pattern →</Link>
        </p>
      </section>

      <div className="controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by number or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search problems"
          />
        </div>
        <div className="seg" role="group" aria-label="Filter by difficulty">
          {DIFFS.map((d) => (
            <button key={d} className={d === diff ? 'active' : ''} aria-pressed={d === diff} onClick={() => setDiff(d)}>
              {d}{d !== 'All' && problems ? <span className="seg-count"> {diffCounts[d]}</span> : ''}
            </button>
          ))}
        </div>
        <select className="tag-select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by topic">
          {tags.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All topics' : t}</option>
          ))}
        </select>
        {anyFilter && <button className="clear-btn" onClick={clearFilters}>Clear ✕</button>}
      </div>

      {status === 'loading' && <p className="loading">Loading problems…</p>}

      {status === 'error' && (
        <div className="empty-state">
          <p>Couldn&apos;t load the problem list.</p>
          <button className="more-btn" onClick={load}>Try again</button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <p className="result-count">
            {filtered.length} problem{filtered.length === 1 ? '' : 's'}{anyFilter ? ' match your filters' : ''}
          </p>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>No problems match your filters.</p>
              <button className="more-btn" onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <div className="grid">
              {filtered.slice(0, limit).map((p) => {
                const extra = (p.tags || []).length - 3;
                return (
                  <Link className="card" key={p.slug} href={`/problem/${p.slug}`}>
                    <span className={`diff-chip ${p.difficulty}`} aria-label={p.difficulty} title={p.difficulty}>
                      {p.difficulty[0]}
                    </span>
                    <span className="num">{p.id}</span>
                    <span className="grow">
                      <span className="title">{p.title}</span>
                      <span className="meta">
                        {(p.tags || []).slice(0, 3).map((t) => (
                          <span className="pill" key={t}>{t}</span>
                        ))}
                        {extra > 0 && <span className="pill muted">+{extra}</span>}
                      </span>
                    </span>
                    {typeof p.acceptance === 'number' && (
                      <span className="accept" title="Acceptance rate">{p.acceptance.toFixed(0)}%</span>
                    )}
                    {hasViz(p) && <span className="has-viz" title="Interactive visualizer available">▶ visual</span>}
                  </Link>
                );
              })}
            </div>
          )}
          {limit < filtered.length && (
            <button className="more-btn" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Show more ({filtered.length - limit} left)
            </button>
          )}
        </>
      )}
    </>
  );
}
