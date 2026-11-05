---
summary: >-
  How an agent works one slice of release 1.10.0: the Agent protocol for
  release 1.9.0 applies in full, with the branch, ID and decisions
  substitutions listed here, plus five worktree rules: worktree writes only in
  temporary fixtures, never on this repository (which has linked worktrees of
  its own); fixtures with awkward paths; decide from the worktree list, never
  Git's translated messages; no engine writes; rebuild the engine after W01.
---

# Agent protocol for release 1.10.0

**Follow the Agent protocol for release 1.9.0 in full**, every section and
every hard rule, with these substitutions:

| In the 1.9.0 protocol | For 1.10.0 |
| --- | --- |
| the release overview, Release 1.9.0 — "The Diff" | Release 1.10.0 — "The Worktrees" |
| Maintainer decisions for release 1.9.0, decisions `X…` | Maintainer decisions for release 1.10.0, decisions `Y…` |
| branch `diff-1.9.0/<slice-id>` from `the-diff` (decision X6) | branch `wt-1.10.0/<slice-id>` from the integration branch named in decision Y1 |
| commit suffix `(D<nn>)` | commit suffix `(W<nn>)`, for example `feat(worktrees): list worktrees on the CLI (W02)` |
| report line `diff-1.9.0/<id>` | report line `wt-1.10.0/<id>` |

If this file and that one disagree, this file wins for release 1.10.0. If
either conflicts with the rest of the knowledge base, the knowledge base
wins: stop and report the conflict.

## Worktree rules, in addition to the hard rules

1. **Worktree writes run only in temporary fixtures.** `git worktree add`,
   `remove`, `prune`, `move`, `lock`, `unlock` and `repair`, and every new
   action that wraps them, run only in repositories a test built under its
   own temporary directory (`tests/backend/helpers.ts`, `makeRepo`). This
   repository has linked worktrees of its own: every slice worktree, and the
   maintainer's `../ggl-fix`. A `prune` or `remove` run here would strand or
   delete them. Never run one outside a fixture, not even to "check
   something".
2. **Tests build the worktrees they assert on.** Never assert on this
   repository's own worktree list, which changes with every dispatch.
3. **Awkward paths are part of every fixture.** Each worktree fixture set
   includes a path with a space and one with a non-ASCII character. Compare
   paths through `canonicalizePath()`, the lesson of PR #9 (symlinked
   temporary directories on macOS, drive-letter case on Windows).
4. **Decide from the worktree list, never from Git's message text.** Git
   translates "is already used by worktree at" and every other refusal
   (Git worktree behavior, verified).
5. **The engine never writes** (Non-goals, permanently). A worktree write
   stays on `runGitRaw`. An engine slice that seems to need one is the wrong
   slice: stop and report.

After W01 is integrated, the engine is built against gix 0.90. Run
`pnpm run engine:build` in your worktree before running the TypeScript tests,
or the engine halves of the parity tests load an older binary or skip.
