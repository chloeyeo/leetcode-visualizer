/**
 * Canonical production origin (no trailing slash). Override per-deploy with
 * NEXT_PUBLIC_SITE_URL; the default is the primary Vercel deployment.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://lc-visualizer.vercel.app').replace(/\/$/, '');
