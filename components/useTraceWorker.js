'use client';

import { useEffect, useRef } from 'react';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Boots the shared Pyodide execution worker (`public/trace-worker.js`) and routes
 * every message it posts to `onMessage`. Returns a ref whose `.current` is the live
 * Worker (or `null` before mount / after teardown), so callers can `postMessage` to it.
 *
 * Single source of truth for both the Playground and the Interview coach — previously
 * each screen re-implemented this same bootstrap inline.
 *
 * `onMessage` is bound once on mount (the worker is created a single time), so callers
 * should route on the message shape (`d.type`) rather than relying on changing closures.
 */
export function useTraceWorker(onMessage) {
  const ref = useRef(null);
  useEffect(() => {
    const w = new Worker(`${BASE}/trace-worker.js`);
    ref.current = w;
    w.onmessage = (e) => onMessage(e.data || {});
    w.onerror = () => onMessage({ type: 'error', message: 'The execution worker failed to load.' });
    return () => w.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
