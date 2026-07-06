# CLAUDE.md — leetcode-visualizer

## Git workflow — git-flow (operator directive 2026-07-06, MANDATORY)

All work in this repo follows **git-flow**, per the 우아한형제들 write-up the
operator designated as the reference: https://techblog.woowahan.com/2553/
("우린 Git-flow를 사용하고 있어요"). Adapted to this single shared repo (no
fork/upstream layer, no JIRA).

*(Deploy/daemon specifics below were adapted 2026-07-06 from the original
directive — written for the ax-ingest repo — to this repo's reality: a Next.js
static export served locally by `next dev` from the main checkout.)*

- **Branches**: `main` (production — the static export and the dev server at
  the main checkout serve from this), `develop` (integration), `feature/*`,
  `release/*`, `hotfix/*`.
- **New work**: branch `feature/<short-description>` FROM `develop`, commit
  there, merge back INTO `develop` with `--no-ff`, delete the feature branch.
  **Never commit work directly on `main` or `develop`.**
- **Worktree sessions** (Claude Code creates `claude/*` worktree branches):
  treat the session branch as the feature branch — before merging, either
  rename it `feature/<short-description>` or merge it `--no-ff` into
  `develop` with a merge message naming the feature. Same rules apply.
- **History hygiene** (from the reference article): commit scoping follows
  "Git discipline — single-purpose commits" below; `git pull --rebase` to
  update a feature branch; NEVER rewrite shared branches (`main`/`develop`);
  no force-push (standing rule).
- **Release**: when `develop` is ready to deploy, cut `release/<x.y.z>` from
  `develop`, stabilize, merge into `main` AND back into `develop`, tag
  `main`. Docs-only / trivial chores may fast-track `develop` → `main`
  without a release branch. Deploy = build the static export (`npm run
  build`) from `main`.
- **Hotfix**: urgent production fix branches `hotfix/*` FROM `main`, merges
  into `main` AND `develop`.
- **Operational caution**: the dev server (localhost) serves whatever the
  MAIN checkout's working tree has checked out. Park that tree on `main`
  when not actively working — a feature branch checked out there shows
  unreviewed code as if it were the product.
- PRs (`gh`) are optional — use one when the operator wants a review;
  otherwise local `--no-ff` merges are fine.

## Git discipline — single-purpose commits (operator directive 2026-07-06, MANDATORY)

Operator: "깃에는 같은 성격만 커밋하는게 나중에 revert하기도 좋아요" — every
commit must be revertable ALONE when it turns out to be the problem.

1. **One concern per commit.** Exactly one bug, one feature, or one refactor
   per commit; two unrelated concerns = two commits, even in one session.
   The test: "if this change is wrong, can the operator revert THIS commit
   without losing an unrelated fix?" If no, split.
2. **A fix + its regression test = ONE concern** — same commit, so reverting
   the fix reverts its guard. Tests for OTHER behaviors, invariant suites,
   or test refactors are separate commits.
3. **No drive-by changes.** No cosmetic fixes, renames, formatting, typos,
   or "while I'm here" improvements inside a functional commit — even
   one-liners. Spotted something? Register it as a follow-up or commit it
   separately after.
4. **Messages: concise, scoped, mechanism-first.** `type: <what changed,
   naming the actual mechanism>` (fix/feat/refactor/test/docs/chore) — e.g.
   "fix: run per-keyword wiki-search fallback so contradiction arm receives
   candidates", never "fix wiki bug". One line, imperative, ≤72 chars where
   possible; body only when the WHY isn't obvious. Describe what the commit
   DOES, not the session's goal.
5. **Scope shifted mid-work? The message follows reality.** If the real fix
   differs from the assigned hypothesis (assigned as routing, landed as
   retrieval), name what was ACTUALLY changed — never describe the plan.
6. **Ask before bundling.** If a split seems genuinely impossible (e.g. an
   atomic many-file rename), propose the split explicitly BEFORE committing
   — never decide unilaterally to bundle.
