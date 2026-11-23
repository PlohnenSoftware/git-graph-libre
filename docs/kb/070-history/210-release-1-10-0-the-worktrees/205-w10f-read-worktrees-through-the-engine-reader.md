---
summary: >-
  W10F · wave C · integrated · TypeScript · ~40 lines: W10 and W03 were built in
  parallel, so W10's single worktree read in `loadBranches` calls the CLI's
  `loadWorktrees` directly. Route it through W03's engine-backed
  `readWorktrees` (`src/backend/engine/worktrees.ts`), which honors the
  `backend` setting and the repository's verification and falls back to the
  CLI, as W10's slice planned once W03 was integrated.
---

# W10F — Read worktrees through the engine reader

Status: integrated `436e0b0` (`2026-11-05`)
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

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:30
- **Branch and commits:** `wt-1.10.0/W10F` —
  `e6b5aca G docs(worktrees): claim W10F`,
  `6d60628 G feat(worktrees): read the branch worktree list through the engine reader (W10F)`,
  `d6cac12 G test(worktrees): the branch read's worktree reader and its handler wiring (W10F)`,
  and the commit that records this report (its hash is the branch tip)
- **Files changed:** `src/backend/queries/loadBranches.ts` (+20/−7: an exported
  `WorktreeReader` type, an optional `readWorktrees` input, the helper renamed to
  `loadBranchWorktrees`), `src/extension/messageHandler.ts` (+14/−1: one import and the
  reader passed to the `loadBranches` call), `tests/backend/queries/loadBranches/worktrees.test.ts`
  (+43), `tests/webview/messageHandlerTrustGate.test.ts` (+119/−10: the mock records its
  input, the backend setting is read live, two new cases)
- **Tests added or changed:** loadBranches worktrees 8 to 10 (an injected reader is asked
  about the current repository; a failed injected reader is logged, and the response keys
  are unchanged). Trust gate 4 to 6 (the handler's reader follows the setting live, with
  `git-cli` and `unverified` routes; a confirmed repository is served by the engine and
  matches the CLI list). Existing assertions are unchanged; the trust-gate file's mock now
  records its input and its `backend` config reads `backendSetting.value`, with the same
  value as before in every existing case.
- **Gates:** biome strict (`--error-on-warnings`) on the four touched TS files: exit 0;
  `pnpm run typecheck`: exit 0; `pnpm run test`: backend 1227 passed, 60 skipped (1287),
  webview 818 passed (818), no Unhandled Errors section. The 60 skips are all in
  `tests/backend/vscodeDiffDifferential.test.ts` (`skipIf` on the local five-arm WASM and
  oracle builds, not present in this worktree); the slice does not touch that file.
  Targeted: `vitest run` on the loadBranches and trust-gate files: 25 passed. Sonar: integrator
- **Acceptance:** with `backend: "auto"` and a verified repository, the list comes from the
  engine (`operation=listWorktrees backend=engine`) and equals the CLI list: met (trust-gate
  case, with the built engine in this worktree). Otherwise the CLI answers, with a logged
  reason (`setting`, `unverified`): met. Response shape unchanged: met (keys asserted).
  Existing tests pass unchanged in their assertions: met.
- **Deviations from the slice:** the handler change adds an import line besides the
  `loadBranches` call, which the reader cannot be passed without. The injected field is
  named `readWorktrees`, and the local helper is renamed `loadBranchWorktrees` (the
  slice's rename option). The `WorktreeReader` type is exported from `loadBranches.ts`.
  The handler's reader reads `config.backend()` at call time, so the setting stays live.
- **Open questions / follow-ups:** the engine-served test needs the built engine
  (`pnpm run engine:build`), like the W03 parity tests; without it, that case fails rather
  than skips. The 60 differential skips above are environmental in this worktree.
