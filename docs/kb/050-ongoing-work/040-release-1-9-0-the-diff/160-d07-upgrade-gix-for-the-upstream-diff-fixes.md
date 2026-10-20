---
summary: >-
  D07 · ready · Rust · ~100 lines: take gix, with every `gix-*` crate, from
  the gitoxide monorepo on GitHub at `main` `0a49d46f6a0b` (maintainer,
  `2026-10-20`) instead of the unreleased-fix-less crates.io `0.89.0`. That
  brings the rename-limit, replacement-ref and Myers fixes; then delete
  `decline_replace_refs` and rerun the parity checks.
---

# D07 — Upgrade gix for the upstream diff fixes

Status: done — awaiting integration
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

- **Agent / date:** Claude Sonnet 5.5, 2026-10-20 18:30
- **Branch and commits:** `diff-1.9.0/d07` — `3f0e66c G` claim; `dcfe212 G` gix and every gix-* crate from gitoxide `0a49d46`; `8950b91 G` drop the replacement-ref decline; `b50a886 G` NOTICE line; `dc50f05 G` rename-limit parity test; plus the report commit
- **Files changed:** `engine/Cargo.toml` +6; `engine/Cargo.lock` +59/−107; `engine/NOTICE.md` +6/−4; `engine/native/core/src/{blob,details,diff,graph,search}.rs` −2/−2/−2/−3/−3 (call sites); `engine/native/core/src/repository.rs` −30 (`uses_replace_refs`, `decline_replace_refs`); `engine/native/core/tests/git_parity.rs` +143/−31; this slice file. No TypeScript changed.
- **Cargo.lock:** `[patch.crates-io] gix = { git, rev = "0a49d46f6a0b08943930d5247693992b89e98c1b" }` was enough: all 53 `gix`/`gix-*` packages (same 53 as before) now carry `source = git+https://github.com/GitoxideLabs/gitoxide?rev=0a49d46…`; none from the registry; every version number unchanged (gix still 0.89.0). No other package changed version.
- **Tests added or changed:** `replacement_objects_hand_history_reads_to_git` replaced by `the_engine_matches_git_under_replacement_objects` (history, commit details, comparison, file at revision and search against git, with no replacement, a graft and `core.useReplaceRefs=false`); new `many_candidate_pairs_still_pair_every_inexact_rename_as_git_does` (40 deletes, 30 adds of 90% similar files: 30 renames, as git). Rust workspace: 195 passed before, 196 after (the new rename test). Verified that the rename test fails (0 renames, 70 add/delete rows) on the registry gix and passes on the pinned one.
- **Myers sweep (scratch harness, not kept: `diff_commit` + `line_counts` against `git diff-tree --numstat -M --diff-filter=AMDR`, last 500 non-merge commits, release build, same engine code, registry gix vs pinned gix):** this repository 12 of 2,001 files differ before, 9 after (all 9 remaining are `graphify-out/graph.json`, a huge generated file; the one list difference is the T type change, excluded by the harness's diff-filter); git.git (`6de20f6092`) 16 of 1,315 before, 0 after; gitoxide checkout (`../gix`, HEAD `abdfc45db`) 17 of 7,835 before, 1 after.
- **Gates:** biome n/a (no TS touched); typecheck pass; test backend 1169/1169 (91 files), webview 781/781 (63 files), no skips, counts unchanged by construction (no TS test changed), engine rebuilt first; l10n n/a; kb:check pass; Rust arm: fmt, lint, check, test all pass; `engine:build` and `engine:smoke` (1.0.26) pass; Sonar: integrator
- **Acceptance:** Rust arm and TS gates pass on a rebuilt engine: met. Cargo.lock all-gix from the pinned commit: met (53/53). Rename-limit fixture lists 30 renames: met (`dc50f05`). Myers share before/after: met, numbers above.
- **Deviations from the slice:** none. `native/core/Cargo.toml` and the TypeScript parity tests needed no change.
- **Open questions / follow-ups:** The remaining `graph.json` differences look like git's non-minimal Myers heuristic on a very large file versus gix's bounded `MyersMinimal`; not investigated.
