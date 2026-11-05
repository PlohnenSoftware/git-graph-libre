---
summary: >-
  W04F · wave A · ready · TypeScript · ~60 lines: clear the four SonarQube
  findings wave A's gate found in W04's code, one of them the security issue
  that turned the gate red (S4036, `git` spawned through `PATH` in
  `resolveGitDirs()`). Drop the `git rev-parse` fallback for a file-system
  check of bare repositories. Make W08's telemetry use the same helper
  instead of its own copy of the `commondir` check.
---

# W04F — Git dirs Sonar follow-up, and one worktree check

Status: claimed by Claude Haiku 5.5 on 2026-11-05 18:14
Needs: W04, W08 (both integrated)
Decisions: —
Kind: TypeScript · Size budget: ~60 changed lines outside tests
Source: wave A's gate (`2026-11-05`, Sonar task
`01ead3ac-8e5c-4824-9819-cdedc8f13dc9`, quality gate `ERROR` on
`software_quality_security_issues` 1 > 0); the W08F note in the Integration
log

## Facts (checked `2026-11-05`, `the-worktrees` at `6b0e232`)

- SonarQube's new-code issues, all in W04's code:
  - `typescript:S4036`, `src/backend/utils/gitDirs.ts:53`: "Make sure the
    PATH variable only contains fixed, unwriteable directories." This is the
    `cp.execFileSync("git", ["rev-parse", …])` in `resolveWithGit()`. It is
    the one security issue, and it fails the gate.
  - `typescript:S6582`, `gitDirs.ts:37`: prefer an optional chain.
  - `typescript:S2933`, `src/repoFileWatcher.ts:64`: mark the member
    (`bases`) `readonly`.
  - `typescript:S7778`, `repoFileWatcher.ts:109`: don't call `Array#push()`
    several times in a row.
- `resolveGitDirs()` tries the file system first: a `.git` directory, or a
  `.git` file's `gitdir:` plus the admin dir's `commondir`. Only when that
  fails does it run a synchronous `git rev-parse` in the extension host, with
  a 5 s timeout. The case left for that fallback is a bare repository: no
  `.git`, and the repository path is itself the git dir. Everything else
  (normal repositories, linked worktrees, submodules) resolves from the file
  system.
- W08's `isLinkedWorktree()` in `src/telemetry/viewFeatures.ts` reads the
  same `.git` file and `commondir` itself. The two slices were built in
  parallel. A repository is a linked worktree exactly when
  `resolveGitDirs()` returns a `gitDir` different from its `commonDir`.

## Steps

1. In `gitDirs.ts`:
   - Remove `resolveWithGit()` and the `node:child_process` import.
   - Add a file-system branch for a bare repository. When `repo` has no
     `.git` but holds `HEAD` as a file and an `objects` directory, then
     `gitDir` is `repo`, and `commonDir` is `repo` or its `commondir` when
     present.
   - Keep the final fallback (`<repo>/.git` for both).
   - Fix S6582 with an optional chain.
2. In `repoFileWatcher.ts`: make `bases` `readonly`, and push the watchers
   in one call per branch (S2933, S7778). Behavior is unchanged.
3. In `viewFeatures.ts`: replace `isLinkedWorktree()`'s file reading with
   `resolveGitDirs()` (a linked worktree is `gitDir !== commonDir`). Keep the
   per-session cache and the rule that only paths already nested are
   checked. An independent nested repository and a submodule still count.
4. Tests:
   - `gitDirs`: a bare repository resolves to itself;
   - `gitDirs`: no `git` process is spawned (assert that
     `node:child_process` is not imported, or spy on it);
   - every existing `gitDirs`, watcher and `viewFeatures` test still
     passes unchanged.

## Touch

`src/backend/utils/gitDirs.ts`, `src/repoFileWatcher.ts`,
`src/telemetry/viewFeatures.ts`, `tests/backend/utils/gitDirs.test.ts`,
`tests/webview/repoFileWatcher.test.ts`,
`tests/backend/telemetry/viewFeatures.test.ts`

## Acceptance

- The four findings are gone. The integrator's rescan has no security
  issue, and the quality gate is `OK`.
- `resolveGitDirs()` spawns no process.
- Telemetry, watcher and gitDirs behavior is unchanged for every existing
  test, and the bare case is new.

## Report

Not started.
