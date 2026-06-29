'use client';

import { useEffect, useState } from 'react';

const MIN = 0.8;
const MAX = 1.8;
const STEP = 0.1;

/**
 * A− / A+ controls that scale readable text app-wide by setting the
 * `--font-scale` CSS variable on <html>. Surfaces that opt in (problem text,
 * code editor, transcript, blueprints) size their font with
 * `calc(<base>px * var(--font-scale))`. Choice persists in localStorage.
 */
export default function FontResizer() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let s = 1;
    try { s = parseFloat(localStorage.getItem('fontScale')) || 1; } catch (e) { /* noop */ }
    s = Math.min(MAX, Math.max(MIN, s));
    document.documentElement.style.setProperty('--font-scale', String(s));
    setScale(s);
  }, []);

  function change(delta) {
    setScale((prev) => {
      const next = Math.min(MAX, Math.max(MIN, Math.round((prev + delta) * 10) / 10));
      document.documentElement.style.setProperty('--font-scale', String(next));
      try { localStorage.setItem('fontScale', String(next)); } catch (e) { /* noop */ }
      return next;
    });
  }

  return (
    <div className="font-resizer" role="group" aria-label="Text size">
      <button type="button" onClick={() => change(-STEP)} disabled={scale <= MIN} aria-label="Decrease text size">A&minus;</button>
      <button type="button" onClick={() => change(STEP)} disabled={scale >= MAX} aria-label="Increase text size">A+</button>
    </div>
  );
}
