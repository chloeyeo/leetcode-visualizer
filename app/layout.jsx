import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'LeetCode Visualizer — see the pattern behind every problem',
  description:
    'Browse every LeetCode problem with a step-by-step interactive visualizer of the algorithm pattern it uses, plus a video hint.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link className="brand" href="/">
              LC<span>Visualizer</span>
            </Link>
            <nav className="header-nav">
              <Link className="ghost-link" href="/patterns">Patterns</Link>
              <a className="ghost-link" href="https://leetcode.com/problemset/" target="_blank" rel="noreferrer">
                LeetCode &#8599;
              </a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            Problem metadata from the public LeetCode API &middot; thumbnails from
            YouTube &middot; an independent study tool, not affiliated with LeetCode.
          </div>
        </footer>
      </body>
    </html>
  );
}
