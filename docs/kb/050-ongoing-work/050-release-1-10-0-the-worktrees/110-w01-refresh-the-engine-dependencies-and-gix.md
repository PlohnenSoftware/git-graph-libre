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

Status: integrated `be1d870` (`2026-11-05`)
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

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05
- **Branch and commits:** `wt-1.10.0/W01` — claim; `build(engine)` move gix to gitoxide `39e093fb541f` and refresh the lockfile; `docs(engine)` NOTICE names the new pin; this report
- **Pinned gitoxide:** `39e093fb541fc7a7acf6d7fef58f30827150cb00`, `main` on `2026-11-05` 15:21 UTC (newer than the slice's `e07e9c7`). gix `0.90.0`, highest gix-crate `rust-version` 1.88.
- **Files changed:** `engine/Cargo.toml` (patch rev, gix `0.90`, `rust-version` 1.88), `engine/native/core/Cargo.toml` (gix `0.90`), `engine/Cargo.lock`, `engine/NOTICE.md` (line 61, pinned commit). No Rust source changed: gix 0.90 compiled with no API migration. `rust-toolchain.toml` untouched; engine version stays `1.0.26`.
- **Cargo.lock:** 53 `gix*` packages (53 before), all from `git+https://github.com/GitoxideLabs/gitoxide?rev=39e093f…`, none from the registry. No unused-patch warning. gix bumps (all moved): gix 0.89.0 → 0.90.0 plus every gix-* crate (for example gix-object 0.66.0 → 0.66.1, gix-odb 0.86.0 → 0.87.0, gix-pack 0.76 → 0.77, gix-ref 0.69.0 → 0.69.1, gix-revision 0.51 → 0.52, gix-revwalk 0.37 → 0.38, gix-status 0.36 → 0.37, gix-worktree 0.58 → 0.59, gix-tempfile 26 → 27, gix-zlib 0.3 → 0.4, gix-protocol 0.67 → 0.68, gix-transport 0.61 → 0.62, gix-traverse 0.63 → 0.64; the rest patch bumps; gix-error 0.5.2 new). Registry updates: jiff 0.2.35 → 0.2.39, jiff-core 0.1.0 → 0.1.2, jiff-static → 0.2.39, jiff-tzdb 0.1.8 → 0.1.9, libc 0.2.189 → 0.2.191, log 0.4.33 → 0.4.35, memmap2 0.9.11 → 0.9.12, napi 3.15.0 → 3.16.1, napi-derive 3.6.13 → 3.7.0, napi-derive-backend 6.1.6 → 7.0.0, portable-atomic-util 0.2.7 → 0.2.8, rustix 1.1.4 → 1.1.6, smallvec 1.15.2 → 1.16.4, syn 3.0.3 → 3.0.9, tinyvec 1.12.0 → 1.13.3, tokio 1.53.1 → 1.54.1, unicode-ident 1.0.24 → 1.0.27, unicode-normalization 0.1.25 → 0.1.26, zlib-rs 0.6.7 → 0.6.8; added multiversion_no_op 1.0.0, simdutf8 0.1.5, winreg 0.56.0; removed tinyvec_macros. The Dependabot napi bump already on `main` was the npm CLI, so the Rust napi crates did move here. The full list is in `git diff 472a7f8 HEAD -- engine/Cargo.lock`.
- **Behavior changes:** none observed. The 196 Rust tests (including the git parity, rename-limit and replacement-object tests) and the TypeScript parity tests pass unchanged, so no new test was needed.
- **Tests added or changed:** none. Rust workspace: 196 passed before and after.
- **Gates:** biome n/a (no TS touched); typecheck pass; `pnpm run test` backend 1204/1204 (93 files), webview 791/791 (64 files), no skips; engine built first (`engine:build` debug, `engine:smoke` OK, engineVersion 1.0.26); l10n n/a; kb:check not run (slice file edited, status line and report only); Rust arm: fmt, lint (clippy `-D warnings`), check, test (196/196) all pass; Sonar: integrator
- **Note on skips:** the first run showed 60 skipped, all in `vscodeDiffDifferential.test.ts`, because `engine/target/diff-wasm` was missing and `wasm-bindgen` is not installed here. `git-graph-diff` has no gix dependency, so I copied the prebuilt wasm from the main checkout's gitignored `engine/target/diff-wasm` (read only) and the 60 then ran and passed.
- **Acceptance:** Rust arm and TS gates pass on a rebuilt engine with every parity test run: met. Lockfile all-gix from the pinned commit, count 53: met. Report lists package changes: met. No "patch was not used" warning: met.
- **D07 measurements (step 6):** not run.
- **Deviations from the slice:** pinned `39e093f` rather than the slice's `e07e9c7`, as the slice's step 1 directs (newest `main` at run time).
- **Open questions / follow-ups:** none.
