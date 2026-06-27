import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(rel) {
  const file = path.join(root, rel);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getProblems() {
  return readJson('public/problems.json');
}

export function getVideos() {
  try {
    return readJson('public/videos.json');
  } catch {
    return {};
  }
}

export function getProblemBySlug(slug) {
  return getProblems().find((q) => q.slug === slug);
}
