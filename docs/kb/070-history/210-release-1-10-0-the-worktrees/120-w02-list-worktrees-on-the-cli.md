---
summary: >-
  W02 · wave A · ready · TypeScript · ~200 lines: a read-only backend query
  that lists a repository's worktrees from `git worktree list --porcelain -z`
  into a new `GitWorktree` type (path, HEAD, branch, detached, bare, main,
  current, locked and prunable with reasons), with a pure parser and real-Git
  fixtures. The base for display, actions and the engine parity test (W03).
---

# W02 — List worktrees on the CLI

Status: integrated `ad43c13` (`2026-11-05`)
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

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:02
- **Branch and commits:** `wt-1.10.0/W02` —
  - `1f6f7db G docs(worktrees): claim slice W02 (W02)`
  - `f705ec0 G feat(worktrees): add the GitWorktree type (W02)`
  - `c4a2e6d G feat(worktrees): list worktrees from git worktree list (W02)`
  - `907e8c4 G test(worktrees): cover the worktree list parser and real Git (W02)`
  - Report commit: see the branch tip (this commit).
- **Files changed:**
  - `src/backend/types/git.types.ts` (+23, −0): `GitWorktree` type
  - `src/backend/queries/worktrees.ts` (+164, new): `parseWorktreeList`, `loadWorktrees`, `WorktreeListFormatError`
  - `tests/backend/queries/worktrees.test.ts` (+297, new)
  - this slice file (claim and report only)
  - Source lines outside tests: about 187 (budget ~200).
- **Tests added or changed:** 18 new tests in `tests/backend/queries/worktrees.test.ts`: 11 parser cases and 7 real-Git cases (main plus linked branch, detached, locked with a reason, prunable with its folder deleted, `isCurrent` from main, from a linked worktree and through a symlink, and a bare repository with two linked worktrees). The file adds 18 backend tests; I did not measure the count before the slice, so no before/after pair is recorded. The full backend run after the slice: 1162 passed.
- **Gates:** biome strict (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`) on every touched `.ts` file, exit 0; `pnpm run typecheck` exit 0; `pnpm run test`: backend 1162 passed, 60 skipped, of 1222 (94 files); webview 791 passed of 791 (64 files); l10n n/a (no user-visible text); kb:check not run (only this slice file changed under docs/kb, its front matter and headings untouched); Rust arm n/a; Sonar: integrator
- **Acceptance:**
  - Every fixture maps exactly: met. Tests compare `head`, `branch`, `detached`, `bare`, `locked`, `prunable` and order against real `git worktree list` output from fixtures.
  - `isCurrent` right from the main worktree and from a linked one, with canonical paths: met. The symlink test checks that a symlinked path also resolves to the main worktree.
  - No test touches a real repository or the network: met. All fixtures live under `os.tmpdir()`, the global config is an empty temp file for the run (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`), and no test asserts on this repository's worktree list.
- **Deviations from the slice:** none in substance. `parseWorktreeList` returns `isCurrent: false` for every entry, because canonical path comparison is async; `loadWorktrees` sets it, as the slice's step 2 implies. `tests/backend/helpers.ts` was not changed; the test file uses `makeRepo` and `git` as they are.
- **Open questions / follow-ups:**
  - The engine binary copied into `engine/native/linux-x64/` is the one from the main checkout, built before W01. W02 does not use the engine, so no engine-backed test ran against it here.
  - Biome 2.6.3 is installed, while `biome.strict.jsonc` names schema 2.5.13. Biome prints a config-version notice on every run, but exits 0. I did not touch the config.
  - 60 backend tests are skipped in the full run. They are existing `skipIf` tests (for example the engine-dependent ones in `tests/backend/engine/`); I did not investigate each skip.
  - `loadWorktrees` compares the `repo` argument as given, so a subdirectory of a worktree matches no entry and every `isCurrent` is false. Callers must pass the worktree root; W10 or W32 should keep that in mind.
