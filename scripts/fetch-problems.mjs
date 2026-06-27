#!/usr/bin/env node
/**
 * Pull the full LeetCode problem catalog (metadata only) into public/problems.json.
 * Uses the public GraphQL endpoint. Run locally where leetcode.com is reachable:
 *
 *   npm run fetch-problems
 *
 * No login or API key required. We only store metadata (title, slug, difficulty,
 * tags, acceptance) and link out to LeetCode for the actual problem text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'problems.json');
const ENDPOINT = 'https://leetcode.com/graphql';
const PAGE = 100;

const QUERY = `
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      difficulty
      acRate
      paidOnly: isPaidOnly
      topicTags { name }
    }
  }
}`;

async function fetchPage(skip) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com/problemset/all/',
      'User-Agent': 'leetcode-visualizer/0.1 (study tool)',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { categorySlug: '', skip, limit: PAGE, filters: {} },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} at skip=${skip}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.problemsetQuestionList;
}

async function main() {
  console.log('Fetching LeetCode problem catalog…');
  let skip = 0;
  let total = Infinity;
  const all = [];

  while (skip < total) {
    const page = await fetchPage(skip);
    total = page.total;
    for (const q of page.questions) {
      all.push({
        id: Number(q.frontendQuestionId),
        slug: q.titleSlug,
        title: q.title,
        difficulty: q.difficulty,
        tags: (q.topicTags || []).map((t) => t.name),
        acceptance: Math.round((q.acRate || 0) * 10) / 10,
        paid: !!q.paidOnly,
      });
    }
    skip += PAGE;
    process.stdout.write(`\r  ${Math.min(skip, total)}/${total}`);
    await new Promise((r) => setTimeout(r, 300)); // be polite
  }

  all.sort((a, b) => a.id - b.id);
  fs.writeFileSync(OUT, JSON.stringify(all, null, 0));
  console.log(`\nWrote ${all.length} problems to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error('\nFailed:', e.message);
  process.exit(1);
});
