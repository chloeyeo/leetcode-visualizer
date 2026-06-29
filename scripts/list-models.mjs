/**
 * Lists the Gemini models YOUR key can actually call for generateContent.
 * Run:  set GEMINI_API_KEY=...   &&   npm run list-models
 * Then use one of the printed names as MODEL for gen-solutions.
 */
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const data = await res.json();
const usable = (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'));
if (!usable.length) {
  console.log('No models support generateContent on this key. You likely need to enable billing on the project (free tier may be unavailable for your account/region).');
} else {
  console.log('Models you can use as MODEL=... :\n');
  for (const m of usable) console.log('  ' + m.name.replace('models/', '').padEnd(28), '·', m.displayName);
}
