---
summary: >-
  D07 · ready · Rust · ~100 lines: take gix, with every `gix-*` crate, from
  the gitoxide monorepo on GitHub at `main` `0a49d46f6a0b` (maintainer,
  `2026-10-20`) instead of the unreleased-fix-less crates.io `0.89.0`. That
  brings the rename-limit, replacement-ref and Myers fixes; then delete
  `decline_replace_refs` and rerun the parity checks.
---

# D07 — Upgrade gix for the upstream diff fixes

Status: claimed by Claude Sonnet 5.5 on 2026-10-20 18:16
Needs: — (the maintainer chose the GitHub source on `2026-10-20`, instead of
waiting for a crates.io release)
Decisions: the maintainer, `2026-10-20`: "lets grab gix (including deps)
from github". All gix crates come from the one gitoxide monorepo, pinned to
an exact commit.
Kind: Rust (the Rust arm applies) · Size budget: ~100 changed lines outside tests and `Cargo.lock`
Source: the "Diff parity against real history" record under Phase 16, root causes 2, 3 and 7

## Goal

Take three upstream fixes the engine is waiting on, from gitoxide `main`:
`1b6d8da7a` (replacement refs, `2026-10-10`), `e571a9273` (rename limit,
`2026-10-14`) and the Myers xdiff-parity fix, the maintainer's
gitoxide#3069, merged through #3074 as `ad129e12f2` (`2026-10-19`). All
three are in `0a49d46f6a0b08943930d5247693992b89e98c1b` (`main`,
`2026-10-20`), checked on GitHub. That commit's `gix` is still version
`0.89.0`, so it satisfies the existing `0.89` requirement.

## Read first

- [The agent protocol](010-agent-protocol.md)
- The diff-parity record under Phase 16: "Root causes" and "The gix
  contribution" (its second build used exactly this `[patch.crates-io]`
  route against a local gix checkout)
- `engine/Cargo.toml`, `engine/native/core/Cargo.toml`, `engine/Cargo.lock`
- `engine/native/core/src/repository.rs`: `uses_replace_refs`,
  `decline_replace_refs`, and their call sites in `blob.rs`, `details.rs`,
  `diff.rs`, `graph.rs`, `search.rs`
- `engine/NOTICE.md`, which documents `Repo::uses_replace_refs` (about line 58)
- `engine/scripts/build-all.mjs`: `--remap-path-prefix` already maps
  `$CARGO_HOME/git`, so a git source keeps builds reproducible

## Steps

1. In `engine/Cargo.toml` add
   ```toml
   [patch.crates-io]
   gix = { git = "https://github.com/GitoxideLabs/gitoxide", rev = "0a49d46f6a0b08943930d5247693992b89e98c1b" }
   ```
   Pin the `rev`; never a moving `branch`. Keep the `version = "0.89"`
   requirements as they are. Run `cargo update -p gix --manifest-path
   engine/Cargo.toml`.
2. Check `engine/Cargo.lock`: **every** `gix` and `gix-*` package must now
   have `source = "git+https://github.com/GitoxideLabs/gitoxide?rev=0a49d46…"`
   and none may remain from the registry. If one does, add it to the same
   `[patch.crates-io]` table at the same `rev`. Report any other package
   whose version moved and why; don't update anything else.
3. `1b6d8da7a` is in: delete `uses_replace_refs` and `decline_replace_refs`
   and their call sites. Turn the
   `replacement_objects_hand_history_reads_to_git` test into one asserting
   the engine now matches Git under replacements (both `core.useReplaceRefs`
   settings). Update `engine/NOTICE.md`'s line about `uses_replace_refs` to
   say the gix fix replaced it.
4. Run the Rust arm, then `pnpm run engine:build` and the TypeScript parity
   tests against that fresh build.

## Touch

`engine/Cargo.toml`, `engine/native/core/Cargo.toml` (only if the patch
needs it), `engine/Cargo.lock`, `engine/native/core/src/repository.rs` and
the call sites of `decline_replace_refs` (`blob.rs`, `details.rs`, `diff.rs`,
`graph.rs`, `search.rs`), `engine/native/core/tests/git_parity.rs`,
`engine/NOTICE.md`, the TypeScript parity tests if a replace-ref decline
expectation there must flip

## Acceptance

- The Rust arm and the TypeScript gates pass, with the engine rebuilt.
- `Cargo.lock`: every `gix*` package from the pinned GitHub commit, none
  from the registry.
- In the report: the rename-limit fixture (40 deletes × 30 adds of 90%
  similar files) now lists 30 renames.
- The Myers fix: the share of files whose counts differ from Git, for a
  500-commit sweep of this repository, before and after (method in the
  diff-parity record). If that record's tooling isn't in the repository,
  say so and give the closest measurement you can make.

## Report

_(not started)_
