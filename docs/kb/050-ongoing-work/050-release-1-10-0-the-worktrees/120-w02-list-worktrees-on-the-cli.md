---
summary: >-
  W02 · wave A · ready · TypeScript · ~200 lines: a read-only backend query
  that lists a repository's worktrees from `git worktree list --porcelain -z`
  into a new `GitWorktree` type (path, HEAD, branch, detached, bare, main,
  current, locked and prunable with reasons), with a pure parser and real-Git
  fixtures. The base for display, actions and the engine parity test (W03).
---

# W02 — List worktrees on the CLI

Status: claimed by Claude Haiku 5.5 on 2026-11-05 17:59
Needs: —
Decisions: —
Kind: TypeScript · Size budget: ~200 changed lines outside tests
Source: issue #37; Phase 18's slice 18.1 (CLI half); Git worktree behavior,
verified

## Goal

One function that answers "which worktrees does this repository have, and
what is checked out in each", exactly as Git reports it. Every later slice
reads worktrees through it, or through W03's engine twin.

## Read first

- The Agent protocol for release 1.10.0, including its worktree rules
- Git worktree behavior, verified: the porcelain format, order, the bare
  case and the prunable case
- `src/backend/queries/stashes.ts` or `resolveRef.ts`: the pattern for a
  small read-only query through `runGitRaw`
- `src/backend/types/git.types.ts`, `src/backend/utils/git.ts`
  (`canonicalizePath`)

## Steps

1. Add `GitWorktree` to `src/backend/types/git.types.ts`:
   ```ts
   type GitWorktree = {
     path: string;                       // as Git prints it
     head: string | null;                // null only for a bare main repository
     branch: string | null;              // "feat", with refs/heads/ stripped; null when detached or bare
     detached: boolean;
     bare: boolean;
     isMain: boolean;                    // the first record
     isCurrent: boolean;                 // the repository asked about, by canonical path
     locked: { reason: string } | null;  // reason "" when locked without one
     prunable: { reason: string } | null;
   };
   ```
2. Create `src/backend/queries/worktrees.ts`:
   - `parseWorktreeList(stdout: string): GitWorktree[]`, pure. Records are
     NUL-separated fields ending in an empty field. Ignore unknown fields, so
     a newer Git still parses. Throw a typed error on a malformed record
     (no `worktree` field) rather than guessing.
   - `loadWorktrees(git, repo, record?)`: `git worktree list --porcelain -z`
     through `runGitRaw`, labelled `worktrees.list`, kind query. `isCurrent`
     compares `canonicalizePath()` of each path with the repository's.
   - No message type yet: W10 decides the transport.
3. Tests in `tests/backend/queries/worktrees.test.ts`:
   - **parser:** main only; main plus linked; detached; locked with and
     without a reason; prunable; a bare main record; a path with a space and
     one with a non-ASCII character; an unknown future field ignored; a
     malformed record rejected;
   - **real Git** (fixtures from `makeRepo` under the test's temp directory):
     main plus linked, detached, locked with a reason, and prunable (its
     folder deleted); queried both from the main worktree and from a linked
     one, to check `isCurrent`; and a bare repository with two linked
     worktrees.

## Touch

`src/backend/types/git.types.ts`, `src/backend/queries/worktrees.ts` (new),
`tests/backend/queries/worktrees.test.ts` (new), `tests/backend/helpers.ts`
(only a worktree fixture helper, if one helps)

## Acceptance

- Every fixture maps exactly. `isCurrent` is right from the main worktree and
  from a linked one, with canonical paths.
- No test touches a real repository or the network.

## Report

Not started.
