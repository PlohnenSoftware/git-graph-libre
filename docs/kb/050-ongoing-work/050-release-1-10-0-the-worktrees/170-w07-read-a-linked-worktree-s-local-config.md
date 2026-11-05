---
summary: >-
  W07 · wave A · needs W01 · Rust + TypeScript · ~120 lines: a parity bug
  today. In a linked worktree, both the engine's `config_list` (local scope)
  and `resolveLocalGitConfigPath()` read `<common>/.git/worktrees/<id>/config`, a
  file Git does not use, so the engine path drops the local
  `user.name`/`user.email` the CLI shows. Read `<common>/config`, prove it
  with a parity test, and bump the engine version.
---

# W07 — Read a linked worktree's local config

Status: done — awaiting integration
Needs: W01 (serializes the engine changes on gix 0.90)
Decisions: —
Kind: Rust and TypeScript, the Rust arm applies · Size budget: ~120 changed
lines outside tests
Source: Engine changes for worktrees (the `config_list` row)

## Goal

Opened on a linked worktree, the engine path and the CLI path report the
same local identity, and both read the file Git reads.

## Facts (checked `2026-11-04`, `c47207e`)

- Engine: `config_list` maps `ConfigLocation::Local` to
  `repo.git_dir().join("config")`
  (`engine/native/core/src/config.rs:147`). In a linked worktree `git_dir()`
  is the private admin dir, so the map comes back empty (`:150`–`:153`).
- TypeScript: `resolveLocalGitConfigPath()`
  (`src/backend/utils/gitConfigPaths.ts:48`–`:64`) follows the `.git` file
  and appends `config`. `loadEngineConfig`
  (`src/backend/engine/repoInfo.ts:188`–`:217`) skips the local call when
  that file is missing. The CLI's `git config --list --local` is right.
  `isScopedGitConfigAbsent()` (`gitConfigPaths.ts:72`–`:80`) would also call
  a linked worktree's config "absent" on a CLI failure.
- A submodule's `.git` file names a full git dir with its own `config` and no
  `commondir`, so the current answer is right for submodules and must stay
  so.

## Steps

1. Rust: map the local scope to `repo.common_dir().join("config")`. It equals
   `git_dir()` outside linked worktrees. Add a Rust test with a linked
   worktree fixture (the first `TestRepo` worktree helper; W40 reuses it).
2. TypeScript: `resolveLocalGitConfigPath()` follows the admin dir's
   `commondir` when there is one, using W04's `resolveGitDirs()` if it is
   already integrated, otherwise reading `commondir` directly. Fix
   `isScopedGitConfigAbsent()` to match.
3. A parity test: on a linked worktree with a local `user.name` and
   `user.email`, the engine and the CLI give identical repository info. Do
   the same for a submodule, unchanged.
4. Bump the engine version (`engine/Cargo.toml`, `engine/package.json` and
   `EXPECTED_ENGINE_VERSION` together). TypeScript now relies on the fix, and
   an older binary would silently return an empty local config.

## Touch

`engine/native/core/src/config.rs`, `engine/native/core/tests/**`,
`engine/Cargo.toml`, `engine/package.json`, `src/backend/engine/addon.ts`
(the version constant), `src/backend/utils/gitConfigPaths.ts`,
`tests/backend/**` (parity and config path tests)

## Acceptance

The parity test passes on a linked worktree and on a submodule, and the Rust
arm and the TypeScript gates pass on a rebuilt engine.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05
- **Branch and commits:** `wt-1.10.0/W07` — `a1dabd9 G fix(engine): read a linked worktree's local config from the common dir`; `57917ee G fix(config): resolve a linked worktree's local config from the common dir`; `133c621 G fix(engine): bump the engine to 1.0.27`; `27c88c8 G test(engine): linked worktree and submodule config parity` (plus the claim `3fa437c`)
- **Files changed:** `engine/native/core/src/config.rs` (local scope reads `common_dir()/config`), `src/backend/utils/gitConfigPaths.ts` (uses `resolveGitDirs().commonDir`; `isScopedGitConfigAbsent` follows), version `1.0.27` in `engine/Cargo.toml`, `engine/package.json`, `engine/Cargo.lock`, `EXPECTED_ENGINE_VERSION`; tests in `engine/native/core/tests/{common/mod.rs,queries.rs}`, `tests/backend/engine/{parity,repoInfo}.test.ts`.
- **Tests added or changed:** Rust `lists_a_linked_worktrees_local_configuration_from_the_common_dir` and `TestRepo::add_worktree`; TS `resolves a linked worktree to the common dir's config` and parity cases for a linked worktree (space and non-ASCII folder, engine-served) and a submodule. Both new TS cases and the Rust case fail without their fix. Backend 1237 and webview 802 pass, no skips.
- **Gates:** Rust fmt, lint, check, test pass (one run hit a pre-existing env-race flake in `lists_initialised_submodules_only`, where tests that set `GIT_CONFIG_GLOBAL` race other tests' `git`; the rerun passed); `engine:build` and `engine:smoke` report 1.0.27; biome strict clean on touched files; typecheck clean; test backend 1237/1237, webview 802/802; l10n n/a; kb:check ok; Sonar: integrator
- **Acceptance:** met. Parity passes on a linked worktree and a submodule on a rebuilt engine.
- **Deviations from the slice:** `resolveLocalGitConfigPath` still returns null when `<repo>/.git` is missing (checked before `resolveGitDirs`, which would otherwise fall back to `<repo>/.git`), keeping the "unresolvable is never absent" rule. A `.git` file with a bad `gitdir:` line now resolves through `git rev-parse` rather than null.
- **Open questions / follow-ups:** `config.worktree` (`extensions.worktreeConfig`) is not read by either path; out of scope.
