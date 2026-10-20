---
summary: >-
  D07 · wave A · blocked on a gix release · Rust · ≤100 lines: when a gix
  release contains the rename-limit fix `e571a9273`, the replacement-ref fix
  `1b6d8da7a` and the Myers xdiff-parity fix (fork branch
  `fix/imara-myers-whole-file-occurrences`, if merged), upgrade the engine,
  delete `decline_replace_refs`, and rerun the parity sweep.
---

# D07 — Upgrade gix for the upstream diff fixes

Status: blocked (external) — waiting on a gix release containing the fixes below. Checked `2026-10-20`: all three are on gitoxide `main` (`1b6d8da7a` `2026-10-10`, `e571a9273` `2026-10-14`, the Myers fix as `ad129e12f2` `2026-10-19`, from the maintainer's gitoxide#3069 via #3074), and none is in a release: crates.io's newest gix is `0.89.0`, the version the engine uses
Needs: a crates.io release of `gix` newer than `0.89`
Decisions: —
Kind: Rust (the Rust arm applies) · Size budget: ≤ 100 changed lines outside tests and `Cargo.lock`
Source: the "Diff parity against real history" record under Phase 16, root causes 2, 3 and 7

## Goal

Take three upstream fixes the engine is waiting on.

## Read first

- [The agent protocol](010-agent-protocol.md)
- The diff-parity record under Phase 16: "Root causes" and "The gix
  contribution"
- `engine/Cargo.toml`, `engine/native/core/Cargo.toml`
- `engine/native/core/src/repository.rs`: `uses_replace_refs`,
  `decline_replace_refs`

## Before starting: check the release

- `cargo search gix --limit 1`, and the changelog of the release (in a
  `gitoxide` checkout: `git log gix-v0.89.0..gix-v<new> --oneline -- gix-diff
  gix/src/open gix-imara-diff`).
- Proceed only if `e571a9273` and `1b6d8da7a` are both included. Note
  whether the Myers fix is included too; the slice is still worth doing
  without it.

## Steps

1. Raise `gix` to the new version in both manifests, then `cargo update -p gix`.
2. If `1b6d8da7a` is in, delete `uses_replace_refs` and
   `decline_replace_refs` and their call sites. Turn the
   `replacement_objects_hand_history_reads_to_git` test into one asserting
   the engine now matches Git under replacements (both `core.useReplaceRefs`
   settings).
3. Run the Rust arm, then the TypeScript parity tests against a fresh
   `pnpm run engine:build`.

## Touch

`engine/Cargo.toml`, `engine/native/core/Cargo.toml`, `engine/Cargo.lock`,
`engine/native/core/src/repository.rs` and the call sites of
`decline_replace_refs` (`blob.rs`, `details.rs`, `diff.rs`, `graph.rs`,
`search.rs`), `engine/native/core/tests/git_parity.rs`

## Acceptance

- The Rust arm and the TypeScript gates pass.
- In the report: the rename-limit fixture (40 deletes × 30 adds of 90%
  similar files) now lists 30 renames.
- If the Myers fix is included: the share of files whose counts differ from
  Git, for a 500-commit sweep of this repository, before and after (method
  in the diff-parity record).

## Report

_(not started)_
