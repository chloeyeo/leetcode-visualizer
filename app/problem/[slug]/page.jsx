import Link from 'next/link';
import { getProblems, getProblemBySlug, getVideos, getSolutionBySlug } from '../../../lib/data';
import { starterFor } from '../../../lib/starter';
import { resolveViz } from '../../../lib/vizInput';
import PatternViz from '../../../components/PatternViz';
import ProblemStatement from '../../../components/ProblemStatement';
import TraceMode from '../../../components/TraceMode';

export function generateStaticParams() {
  return getProblems().map((q) => ({ slug: q.slug }));
}

export function generateMetadata({ params }) {
  const q = getProblemBySlug(params.slug);
  if (!q) return { title: 'Problem — LC Visualizer' };
  const tags = (q.tags || []).slice(0, 3).join(', ');
  return {
    title: `${q.id}. ${q.title} — LC Visualizer`,
    description: `${q.title} (${q.difficulty}${tags ? ` · ${tags}` : ''}): interactive pattern visualizer, runnable Python starter, and a spoken mock interview — free, entirely in your browser.`,
  };
}

export default function ProblemPage({ params }) {
  const q = getProblemBySlug(params.slug);

  if (!q) {
    return (
      <div>
        <Link className="back-link" href="/">&#8592; All problems</Link>
        <p className="empty">Problem not found.</p>
      </div>
    );
  }

  const videos = getVideos();
  const v = videos[q.slug];
  const sol = getSolutionBySlug(q.slug);
  const hasVideo = v && v.ok !== false && v.id;
  const searchUrl =
    'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(`${q.title} leetcode solution`);
  const lcUrl = `https://leetcode.com/problems/${q.slug}/`;
  const pgHref = `/playground/?problem=${q.slug}&title=${encodeURIComponent(q.title)}&id=${q.id}&diff=${q.difficulty}&tags=${encodeURIComponent((q.tags || []).join(','))}`;
  const starter = sol?.starterCode || starterFor(q);

  return (
    <div>
      <Link className="back-link" href="/">&#8592; All problems</Link>

      <div className="detail-head">
        <span className="num">{q.id}.</span>
        <h1>{q.title}</h1>
      </div>

      <div className="detail-sub">
        <span className={`diff ${q.difficulty}`}>{q.difficulty}</span>
        {typeof q.acceptance === 'number' && (
          <span className="pill">{q.acceptance.toFixed(1)}% accepted</span>
        )}
        {q.paid && <span className="pill">Premium</span>}
        <span className="tag-row">
          {(q.tags || []).map((t) => (
            <span className="pill" key={t}>{t}</span>
          ))}
        </span>
      </div>

      <div className="actions">
        <a className="btn btn-primary" href={lcUrl} target="_blank" rel="noreferrer">
          Open on LeetCode &#8599;
        </a>
        <Link className="btn btn-ghost" href={pgHref}>
          Open in Playground
        </Link>
        <Link className="btn btn-ghost" href={`/interview/?problem=${q.slug}`}>
          Practice interview
        </Link>
      </div>

      <section className="prob-statement">
        <h2 className="section-title lead">The problem</h2>
        {sol ? (
          <ProblemStatement sol={sol} />
        ) : (
          <p className="section-note">
            We haven&apos;t written our own plain-language summary for this one yet — read the
            exact statement on{' '}
            <a className="inline-link" href={lcUrl} target="_blank" rel="noreferrer">LeetCode ↗</a>,
            then start from the scaffold below.
          </p>
        )}
        <h3 className="pg-embed-title">Code it right here — runs &amp; traces in your browser</h3>
        <TraceMode initialCode={starter} problemSlug={q.slug} showSummary={false} />
        <p className="section-note prob-fineprint">
          {sol ? (
            <>
              Summary rewritten in our own words for study purposes — see the exact original on{' '}
              <a className="inline-link" href={lcUrl} target="_blank" rel="noreferrer">LeetCode ↗</a>.
            </>
          ) : (
            <>
              This scaffold is original to LC Visualizer — the problem statement itself lives on{' '}
              <a className="inline-link" href={lcUrl} target="_blank" rel="noreferrer">LeetCode ↗</a>.
            </>
          )}
        </p>
      </section>

      <h2 className="section-title lead">Visualize the pattern</h2>
      <PatternViz tags={q.tags || []} viz={resolveViz(q, sol)} />

      <h2 className="section-title video-heading">Video hint</h2>
      {hasVideo ? (
        <>
          <p className="section-note">
            Still stuck after the visualizer? Watch a full walkthrough.
          </p>
          <a
            className="video-card"
            href={`https://www.youtube.com/watch?v=${v.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <div className="video-thumb">
              <img
                src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                alt={`${q.title} video walkthrough`}
                loading="lazy"
              />
              <div className="play-badge">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </div>
            </div>
            <div className="video-label">
              {v.title || `${q.title} — walkthrough`}
              <small>Opens on YouTube</small>
            </div>
          </a>
        </>
      ) : (
        <p className="section-note">
          No video mapped for this one yet —{' '}
          <a className="inline-link" href={searchUrl} target="_blank" rel="noreferrer">
            search YouTube for walkthroughs ↗
          </a>
        </p>
      )}
    </div>
  );
}
