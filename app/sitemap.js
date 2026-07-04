import { getProblems } from '../lib/data';
import { PATTERNS } from '../lib/patterns';
import { SITE_URL } from '../lib/site';

export const dynamic = 'force-static';

/**
 * Build-time sitemap for the static export (~3,990 URLs, well under the
 * 50k-per-file limit). Base URL comes from NEXT_PUBLIC_SITE_URL (see lib/site.js).
 */
export default function sitemap() {
  const now = new Date();
  const base = SITE_URL.replace(/\/$/, '');
  const page = (path, priority, changeFrequency = 'monthly') => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page('/', 1, 'weekly'),
    page('/patterns/', 0.9, 'weekly'),
    page('/playground/', 0.8, 'weekly'),
    ...PATTERNS.map((p) => page(`/patterns/${p.key}/`, 0.8)),
    ...getProblems().map((q) => page(`/problem/${q.slug}/`, 0.6)),
  ];
}
