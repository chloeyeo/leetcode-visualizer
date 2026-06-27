import Link from 'next/link';
import { PATTERNS } from '../../lib/patterns';

export const metadata = {
  title: 'Algorithm patterns — LC Visualizer',
  description: 'Interactive visualizers for the core LeetCode algorithm patterns.',
};

export default function PatternsPage() {
  return (
    <div>
      <Link className="back-link" href="/">&#8592; All problems</Link>

      <section className="hero">
        <h1>Algorithm pattern visualizers</h1>
        <p>
          {PATTERNS.length} interactive, step-by-step visualizers for the patterns behind
          most LeetCode problems. Open one to play with it directly — no specific problem
          required.
        </p>
      </section>

      <div className="pattern-grid">
        {PATTERNS.map((p) => (
          <Link key={p.key} className="pattern-card" href={`/patterns/${p.key}`}>
            <span className="pattern-name">{p.label}</span>
            <span className="pattern-blurb">{p.blurb}</span>
            <span className="pattern-go">Open visualizer &#8594;</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
