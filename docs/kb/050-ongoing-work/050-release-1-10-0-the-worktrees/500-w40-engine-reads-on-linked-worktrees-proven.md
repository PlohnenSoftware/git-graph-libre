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

Status: claimed by Claude Sonnet 5.5 on 2026-11-05 12:00
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

Not started.
