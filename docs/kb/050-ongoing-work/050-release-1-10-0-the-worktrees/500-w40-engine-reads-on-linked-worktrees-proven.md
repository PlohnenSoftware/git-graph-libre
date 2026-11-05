---
summary: >-
  W40 · wave B · needs W01, W07 · Rust + TypeScript · ~250 lines: prove every
  wired engine read on a linked worktree with parity tests (repository info,
  commits, details, comparisons, the uncommitted row, staged files, search,
  stashes). Fix what differs: other worktrees' HEADs in authors and stats,
  matching the CLI's `--all`; a decline when the worktree has vanished, so a
  stale handle no longer answers; and two stale doc comments.
---

# W40 — Engine reads on linked worktrees, proven

Status: integrated `f1dcbb6` (`2026-11-05`)
Needs: W01, W07
Decisions: —
Kind: Rust and TypeScript, the Rust arm applies · Size budget: ~250 changed
lines outside tests
Source: Engine changes for worktrees (the export table and the handle risk);
Phase 16's design rule 3 (two implementations, proven to agree)

## Goal

Opening a graph on a linked worktree through the engine gives exactly what
the CLI gives, and a removed or moved worktree can never be served from a
stale handle.

## Steps

1. Fixtures:
   - a parity fixture whose repository path is a linked worktree, with a
     local commit, a stash made there, a dirty index, its own `refs/worktree/*`
     ref, and `extensions.worktreeConfig` with a `config.worktree` value;
   - a second linked worktree, detached, so other worktrees' HEADs exist.
2. Run every read the reader wires to the engine over it, against the CLI.
   Any divergence is an engine bug; fix it rather than relax the test.
3. Known divergence: `authors`, `author_stats` and `activity_heatmap` miss
   other worktrees' HEADs, which the CLI's `git log --all` includes
   (`src/backend/queries/loadRepoInfo.ts:201`). Add those HEADs as tips,
   read through `worktrees/<id>/HEAD` without opening the siblings.
4. Freshness: when the worktree's `.git` file or admin dir no longer exists,
   `RepoManager::get` evicts the handle and returns `NotARepository`, instead
   of answering from the shared refs with no HEAD (`refs.rs:32`).
5. Fix the stale comments at `repository.rs:28` (the shared handle does
   expose the git dir) and `api.rs:143` (`git_dir()` is the private dir in a
   linked worktree).
6. Bump the engine version if TypeScript relies on the freshness decline, or
   on the authors change, which an older binary silently lacks.

## Touch

`engine/native/core/src/{repository,log,stats,refs,api}.rs` (only where a
divergence or the freshness check needs it), `engine/native/core/tests/**`,
`engine/Cargo.toml`, `engine/package.json`, `src/backend/engine/addon.ts`
(version), `tests/backend/engine/**`

## Acceptance

Every wired read is identical on the linked-worktree fixture. A removed
worktree's handle declines, and the reader falls back or reports the
repository gone.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05
- **Branch and commits:** `wt-1.10.0/W40`: `fix(engine): count other worktrees' HEADs in authors and stats`; `fix(engine): decline a linked worktree that no longer exists`; `test(engine): every wired read on a linked worktree against git`; `fix(engine): bump the engine to 1.0.28`; `test(engine): the reader's reads on a linked worktree against the CLI` (plus the claim).
- **Files changed:** `engine/native/core/src/{log,stats,repository,api}.rs`; version `1.0.28` in `engine/Cargo.toml`, `engine/package.json`, `engine/Cargo.lock`, `EXPECTED_ENGINE_VERSION`; tests `engine/native/core/tests/{linked_worktree.rs,common/mod.rs}` (`TestRepo::git_in`), `tests/backend/engine/linkedWorktree.test.ts`.
- **Divergences found:** (1) `authors`, `author_stats` and `activity_heatmap` missed commits reachable only from another worktree's HEAD, which `git log --all` and `git shortlog --all` include. Fixed: `log::every_tip` adds `worktrees/<id>/HEAD` and `main-worktree/HEAD` read through the ref store (no sibling is opened), shared by authors and stats. (2) A removed or moved linked worktree kept being served; worse, `Repo::discover` from the missing folder found an enclosing repository when the worktree sat inside the main work tree. Fixed: `RepoManager::get` evicts and returns `NotARepository` when the `.git` file or admin dir is gone. Every other read matched Git unchanged: repository info and refs (the `refs/worktree/*` ref stays hidden, as in the CLI scans), the commit walk, details, comparisons, the uncommitted row, staged file, stashes, search, and `config.worktree` identity.
- **Declined by design (pinned by TS tests):** the `*` commit-details row and any comparison against the work tree stay on the CLI (existing reader rule).
- **Stale comments:** `Repo::git_dir` field comment and `Engine::git_dir` doc corrected (the shared handle caches it; in a linked worktree it is the private admin dir).
- **Version:** bumped to `1.0.28`: TypeScript's author filter relies on the authors change (a `1.0.27` binary omits those commits) and on the freshness decline. Author stats and the heatmap are not wired in TypeScript yet.
- **Gates:** Rust fmt, lint, check pass; `engine:test` all pass (the diff crate's `vscode_fixtures` first failed on a stale baked manifest path in the recycled `engine/target`; `touch` of the test file rebuilt it, no code change); `engine:build` and `engine:smoke` report 1.0.28; typecheck clean; `pnpm run test` backend 1311/1311 and webview 836/836, nothing skipped; biome strict clean on the touched TS files; l10n n/a; Sonar: integrator.
- **Acceptance:** met.
- **Open questions:** a bare main repository's own HEAD is included by Git among a linked worktree's siblings; the engine reads `main-worktree/HEAD` there too but this was not tested with a bare main.
