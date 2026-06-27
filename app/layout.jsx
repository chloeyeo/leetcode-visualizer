import './globals.css';
import Link from 'next/link';
import { Space_Grotesk } from 'next/font/google';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'LeetCode Visualizer — see the pattern behind every problem',
  description:
    'Browse every LeetCode problem with a step-by-step interactive visualizer of the algorithm pattern it uses, plus a video hint.',
};

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 28 28" width="26" height="26" aria-hidden="true" focusable="false">
      <line x1="7" y1="9" x2="14" y2="20" />
      <line x1="21" y1="9" x2="14" y2="20" />
      <circle className="n-a" cx="7" cy="9" r="3.6" />
      <circle className="n-b" cx="21" cy="9" r="3.6" />
      <circle className="n-c" cx="14" cy="20" r="3.6" />
    </svg>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link className="brand" href="/">
              <BrandMark />
              <span className="brand-word">LC Visualizer</span>
            </Link>
            <nav className="header-nav">
              <Link className="ghost-link" href="/patterns">Patterns</Link>
              <Link className="ghost-link" href="/playground">Playground</Link>
              <a className="ghost-link" href="https://leetcode.com/problemset/" target="_blank" rel="noreferrer">
                LeetCode &#8599;
              </a>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <div className="footer-brand">
              <BrandMark />
              <span className="brand-word">LC Visualizer</span>
            </div>
            <nav className="footer-links">
              <Link href="/">Problems</Link>
              <Link href="/patterns">Patterns</Link>
              <a href="https://leetcode.com/problemset/" target="_blank" rel="noreferrer">LeetCode</a>
            </nav>
            <p className="footer-fine">
              Problem metadata from the public LeetCode API · thumbnails from YouTube · an
              independent study tool, not affiliated with LeetCode.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
