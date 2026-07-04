import { SITE_URL } from '../lib/site';

export const dynamic = 'force-static';

export default function robots() {
  const base = SITE_URL.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${base}/sitemap.xml`,
  };
}
