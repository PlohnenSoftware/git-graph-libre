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

Status: ready once W01 is integrated
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

Not started.
