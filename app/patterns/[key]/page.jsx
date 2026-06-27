import Link from 'next/link';
import { PATTERNS } from '../../../lib/patterns';
import PatternPlayer from '../../../components/PatternPlayer';

export function generateStaticParams() {
  return PATTERNS.map((p) => ({ key: p.key }));
}

export function generateMetadata({ params }) {
  const p = PATTERNS.find((x) => x.key === params.key);
  return { title: p ? `${p.label} — LC Visualizer` : 'Pattern — LC Visualizer' };
}

export default function PatternDetail({ params }) {
  const p = PATTERNS.find((x) => x.key === params.key);

  if (!p) {
    return (
      <div>
        <Link className="back-link" href="/patterns">&#8592; All patterns</Link>
        <p className="empty">Unknown pattern.</p>
      </div>
    );
  }

  return (
    <div>
      <Link className="back-link" href="/patterns">&#8592; All patterns</Link>

      <div className="detail-head">
        <h1>{p.label}</h1>
      </div>
      <p className="pattern-detail-blurb">{p.blurb}</p>

      <h2 className="section-title lead">Visualize the pattern</h2>
      <PatternPlayer keyName={p.key} />

      <p className="section-note pattern-example">
        Example problem that uses it:{' '}
        <Link className="inline-link" href={`/problem/${p.example}`}>{p.example}</Link>
      </p>
    </div>
  );
}
