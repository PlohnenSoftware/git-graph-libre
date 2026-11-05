---
summary: >-
  W01 · wave A · ready · Rust · ~150 lines: move gix and every `gix-*` crate
  to the newest gitoxide `main` from GitHub (gix 0.90; `e07e9c7` on
  `2026-11-04`, 200 commits past `0a49d46`), raise the `0.89` requirements
  to `0.90` and `rust-version` to gix's 1.88, refresh every registry crate in
  `Cargo.lock` (36 updates on `2026-11-04`), migrate any API change, and
  rerun the parity checks, as D07 did. Maintainer request, `2026-11-04`.
---

# W01 — Refresh the engine's dependencies and gix

Status: claimed by Claude Sonnet 5.5 on 2026-11-05 12:00
Needs: —
Decisions: Y2, answered by the maintainer on `2026-11-04`: "please also do
updates to cargo stuff including gix which we grab from GH". gix stays on the
GitHub source, pinned to one exact `main` commit.
Kind: Rust (the Rust arm applies) · Size budget: ~150 changed lines outside
tests and `Cargo.lock`. The gix API migration is unknown until it compiles.
Source: the maintainer's request; D07's method (Upgrade gix for the upstream
diff fixes, under Release 1.9.0)

## Goal

Start the worktree release on current dependencies. The engine's worktree
slices (W03, W40, W41) then build against today's gix, with its newest
worktree and revision fixes.

## Read first

- The Agent protocol for release 1.10.0, and through it 1.9.0's
- D07 — Upgrade gix for the upstream diff fixes: its steps, the
  `[patch.crates-io]` route, and its report (53 `gix*` packages, the
  rename-limit test, the Myers sweep)
- `engine/Cargo.toml`, `engine/native/core/Cargo.toml`, `engine/Cargo.lock`,
  `rust-toolchain.toml` (its comment on raising the channel)
- Phase 16's "Author Date through the engine" record, for the engine version
  rule

## Facts (checked `2026-11-04`)

- `engine/Cargo.toml` has `[workspace.dependencies] gix = { version = "0.89",
  default-features = false }` and `[patch.crates-io] gix = { git =
  "https://github.com/GitoxideLabs/gitoxide", rev =
  "0a49d46f6a0b08943930d5247693992b89e98c1b" }`. `engine/native/core/Cargo.toml:10`
  repeats `version = "0.89"`. The workspace has `rust-version = "1.82"` and
  version `1.0.26`.
- `engine/Cargo.lock` takes 53 packages from
  `git+https://github.com/GitoxideLabs/gitoxide?rev=0a49d46…`, gix `0.89.0`.
- gitoxide `main` is `e07e9c7ea9250020f28b172813774f08edf61c6d`
  (`2026-11-04`, 09:54 UTC), **200 commits** past `0a49d46` (`2026-10-20`).
  Its `gix/Cargo.toml` says version **`0.90.0`** and `rust-version = "1.88"`.
  gix `0.90.0` was released on `2026-10-22` in a release that bumped 21
  crates, and crates.io lists it. **The `0.89` requirements must become
  `0.90`**, or the patch matches nothing: Cargo then warns that the patch
  was not used and quietly resolves the registry's 0.89.
- Commits since the pin that touch what the engine does:
  - `370328b7a5`: skip dangling symbolic refs during revision lookup (#3090);
  - `9feeaa9a27`, `bc73cdf89d`, `aed3cf36e9`: gix-revision selector fixes;
  - `c2afcd1800`: gix-diff keeps staged deletions behind intent-to-add
    entries;
  - `4bc33465e2`: validate gitlinks before worktree removal safety probes;
  - `d6a45b2f1a`, `f1fdf6ec55`: gix-imara-diff performance.
- `rust-toolchain.toml` pins `1.98.1`, at or above 1.88, so the build itself
  is fine. Only the workspace's `rust-version = "1.82"` becomes untrue.
- `cargo update --dry-run --manifest-path engine/Cargo.toml` (registry only,
  patch unchanged) would update 36 packages within their requirements. Among
  them:
  - `napi` 3.15.0 → 3.16.1 and `napi-derive` 3.6.13 → 3.7.0, which pulls in
    `napi-derive-backend` 7.0.0;
  - `tokio` 1.53.1 → 1.54.1 and `syn` 3.0.3 → 3.0.9;
  - smaller moves in `libc`, `rustix`, `smallvec`, `zlib-rs`, `encoding_rs`
    and `jiff`;
  - `defmt` 0.3 and 1.1 and `tinyvec_macros` removed.

  Four dependencies stay behind their latest because of their requirements;
  `--verbose` names them.
- The maintainer's Dependabot merges of `2026-11-04` moved the npm
  `@napi-rs/cli` to 3.10.9, so the Rust `napi` crates and the CLI move
  together.

## Steps

1. Take the newest gitoxide `main` at the time of the slice
   (`git ls-remote https://github.com/GitoxideLabs/gitoxide refs/heads/main`)
   and record its hash and date. Pin `rev` to the full hash, never a branch.
2. Set the gix requirement to that commit's `gix` version (`0.90` on
   `e07e9c7`) in both manifests. Raise `rust-version` to the highest
   `rust-version` among the gix crates at that commit (1.88 on `e07e9c7`).
3. Run `cargo update --manifest-path engine/Cargo.toml` over the whole
   lockfile. Then check that every `gix` and `gix-*` package comes from the
   pinned commit and none from the registry. Add any stray one to the same
   `[patch.crates-io]` table at the same `rev`, and confirm there is no "patch
   was not used" warning.
4. Fix what gix 0.90 breaks, preserving behavior. If an upstream fix changes
   a result (a revision lookup, a diff), keep the new Git-compatible result
   and pin it with a test that compares against Git.
5. Run the Rust arm, `pnpm run engine:build` and `pnpm run engine:smoke`,
   then the TypeScript tests against that build, with every parity test and
   no skips.
6. If cheap, repeat D07's measurements (the rename-limit fixture and the
   Myers sweep over this repository) and report before and after.
7. Leave the engine version at `1.0.26`. A refresh alone gives TypeScript
   nothing new to rely on (Phase 16's engine version rule); W03 or W40 bump
   it when they do.
8. If `engine/NOTICE.md` names the gix commit, update it.

## Touch

`engine/Cargo.toml`, `engine/native/core/Cargo.toml`,
`engine/native/node/Cargo.toml` (only if the migration needs it),
`engine/Cargo.lock`, `engine/native/**/src/**/*.rs` (API migration only),
`engine/native/core/tests/**`, `engine/NOTICE.md`

## Acceptance

- The Rust arm and the TypeScript gates pass on a rebuilt engine, with every
  parity test run and passing.
- `Cargo.lock`: every `gix*` package from the pinned commit, none from the
  registry, and the count reported (53 before).
- The report lists every package whose version changed, and every behavior
  change with its test.
- No "patch was not used" warning.

## Report

Not started.
