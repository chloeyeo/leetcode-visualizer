import Link from 'next/link';
import { getProblems, getProblemBySlug, getVideos, getSolutionBySlug } from '../../../lib/data';
import PatternViz from '../../../components/PatternViz';
import ProblemStatement from '../../../components/ProblemStatement';

export function generateStaticParams() {
  return getProblems().map((q) => ({ slug: q.slug }));
}

export function generateMetadata({ params }) {
  const q = getProblemBySlug(params.slug);
  return {
    title: q ? `${q.id}. ${q.title} — LC Visualizer` : 'Problem — LC Visualizer',
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
        <Link
          className="btn btn-ghost"
          href={`/playground/?problem=${q.slug}&title=${encodeURIComponent(q.title)}&id=${q.id}`}
        >
          Open in Playground
        </Link>
        <Link className="btn btn-ghost" href={`/interview/?problem=${q.slug}`}>
          Practice interview
        </Link>
      </div>

      {sol ? (
        <section className="prob-statement">
          <h2 className="section-title lead">The problem</h2>
          <ProblemStatement sol={sol} />
          {sol.starterCode && (
            <div className="blueprint">
              <div className="blueprint-head">
                <span>Starter blueprint · Python</span>
                <Link
                  className="inline-link"
                  href={`/playground/?problem=${q.slug}&title=${encodeURIComponent(q.title)}&id=${q.id}`}
                >
                  Edit &amp; run in Playground →
                </Link>
              </div>
              <pre className="blueprint-code"><code>{sol.starterCode}</code></pre>
            </div>
          )}
          <p className="section-note prob-fineprint">
            Summary rewritten in our own words for study purposes — see the exact original on{' '}
            <a className="inline-link" href={lcUrl} target="_blank" rel="noreferrer">LeetCode ↗</a>.
          </p>
        </section>
      ) : (
        <p className="section-note">
          A plain-language summary for this problem is on the way. For now, open the exact
          statement on <a className="inline-link" href={lcUrl} target="_blank" rel="noreferrer">LeetCode ↗</a>.
        </p>
      )}

      <h2 className="section-title lead">Visualize the pattern</h2>
      <PatternViz tags={q.tags || []} viz={sol?.viz} />

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
