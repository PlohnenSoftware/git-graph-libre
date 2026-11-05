---
summary: >-
  W10F · wave C · ready · TypeScript · ~40 lines: W10 and W03 were built in
  parallel, so W10's single worktree read in `loadBranches` calls the CLI's
  `loadWorktrees` directly. Route it through W03's engine-backed
  `readWorktrees` (`src/backend/engine/worktrees.ts`), which honors the
  `backend` setting and the repository's verification and falls back to the
  CLI, as W10's slice planned once W03 was integrated.
---

# W10F — Read worktrees through the engine reader

Status: claimed by Claude Haiku 5.5 on 2026-11-05 18:21
Needs: W03 (integrated `f9e54a4`), W10 (integrated `2a619c4`)
Decisions: —
Kind: TypeScript · Size budget: ~40 changed lines outside tests
Source: W10 — Carry worktrees to the webview ("it uses W03's reader once
integrated"); W03 — List worktrees in the engine

## Facts (checked `2026-11-05`, `the-worktrees` at `2a619c4`)

- `src/backend/queries/loadBranches.ts` has one seam:
  - the local `readWorktrees(git, input)` (`:26`–`:31`) calls W02's
    `loadWorktrees(git, input.currentRepo, input.recordGitCommand)`;
  - `LoadBranchesInput` (`:10`–`:17`) carries `currentRepo`, `gitPath`
    and `recordGitCommand`, but no engine dependencies;
  - a failure yields `[]` and a `logBackendRoute` line, never an error on
    the response.
- W03 exports `readWorktrees(git, repo, deps, record)` from
  `src/backend/engine/worktrees.ts`. Its `deps` are `{ backend,
  addonProvider, isVerified }`, and it returns the same
  `WorktreeListResult`. It uses the engine only when `backend()` is
  `"auto"`, the repository is verified and the addon has `listWorktrees`;
  otherwise it logs the reason and calls `loadWorktrees`.
- `src/extension/messageHandler.ts:872` calls `loadBranches(...)`. The
  handler already builds engine dependencies elsewhere: `config.backend`,
  and `isVerified: (repo) => deps.repoSearch?.isVerified(repo) ?? false`
  (`:529`, and `readerFor()` at `:543`–`:550`).

## Steps

1. Give `LoadBranchesInput` an optional injected worktree reader, for
   example `readWorktrees?: (git, repo, record?) => Promise<WorktreeListResult>`.
   Without it, keep today's CLI `loadWorktrees`, so existing callers and
   tests are unchanged. Use it at the one seam. Rename the local helper if
   the name collides with W03's export.
2. In `messageHandler.ts`, pass a reader that calls W03's `readWorktrees`
   with `{ backend: config.backend, isVerified: (repo) =>
   deps.repoSearch?.isVerified(repo) ?? false }`, reading the setting live
   as the other readers do.
3. Tests:
   - `loadBranches` uses an injected reader when one is given;
   - without one it keeps the CLI;
   - the handler passes a reader that honors `backend: "git-cli"`.

   W03's own parity tests already cover the engine path.

## Touch

`src/backend/queries/loadBranches.ts`, `src/extension/messageHandler.ts`
(the `loadBranches` call only), `tests/**`

## Acceptance

- With `backend: "auto"` and a verified repository, the worktree list comes
  from the engine (a `[route] listWorktrees backend=engine` line).
  Otherwise it comes from the CLI.
- The response shape and every existing test are unchanged.

## Report

Not started.
