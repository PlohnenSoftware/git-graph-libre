---
summary: >-
  F3-05: Applies the repository's mailmap in the engine's `author_stats`, so the
  contributors list matches `git shortlog -sne --all --no-merges`, proven by an
  engine test against shortlog in temporary repositories. Decision-dependent on
  TQ5.
---

# F3-05 — Mailmap parity in `author_stats`

Status: done — awaiting integration

Needs: F3-01 integrated; TQ5 confirmed

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree (Rust and TypeScript)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`), TQ5; the
research (`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 2.3, 6 (F3-05) and TQ5; `engine/native/core/src/stats.rs` (its
module header names the shortlog it mirrors); the Phase 16 design rules and
the parity rule in the Phase 16 section of the roadmap; `addon.ts`'s comment
on `EXPECTED_ENGINE_VERSION`.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). Tests ship with
behavior, and touch only temporary directories. Strict Biome on touched
files, no `var`, American English. No new telemetry events or declarations.
Do not edit CHANGELOG, README or notices; the integrator does. Report Sonar:
integrator. Build the addon before the TypeScript tests run, or they load a
stale binary.

## Touch

`engine/native/core/src/stats.rs`; new `engine/native/core/tests/stats.rs`
(or the existing engine test layout, whichever it uses); `engine/Cargo.toml`
and `src/backend/engine/addon.ts` (`EXPECTED_ENGINE_VERSION`) only if the
mailmap change alters what an older binary answers, as the bump rule in
`addon.ts` requires, and only with TQ5 recorded as applied; new cases in
`tests/backend/engine/stats.test.ts` (F3-01's file); the slice file's Status
and Report.

## Task and acceptance

- `author_stats` applies `.mailmap` (the worktree's and the repository's
  mailmap as Git reads them, `mailmap.file` and `mailmap.blob` included, as
  `git shortlog` does by default). Record in the Report exactly which mailmap
  sources the engine reads and how each was checked.
- Parity: in temporary repositories with and without a `.mailmap`, with two
  identities for one person, with a name-only mapping and an email-only
  mapping, the engine's counts equal the counts from
  `git shortlog -sne --all --no-merges` run on the same repository.
- A divergence is a bug to fix, never a test to relax.
- If the mailmap change needs an engine version bump, the Report says so and
  the bump is made in this slice; the maintainer decides it under TQ5 before
  dispatch.
- Measure the read on this repository with a release build; record the time.

## Checks

- Rust arm: `pnpm run engine:fmt && pnpm run engine:lint && pnpm run engine:check && pnpm run engine:test`, and the addon rebuild the release notes describe.
- Strict Biome on each touched `.ts` file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend tests/backend/engine/stats.test.ts`
- Record each command and its counts in the Report.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 12:15
- **Branch and commits:** `stats/F3-05` — `97542f70` G docs(stats): claim slice F3-05 (F3-05); `2acae877` G feat(engine): apply the mailmap in author_stats (F3-05); `7a28b1e5` G style(engine): rustfmt the mailmap code (F3-05); `4240f9a1` G build(engine): bump the engine to 1.0.33 for mailmap stats (F3-05); `ed33f62f` G test(stats): author counts against shortlog with a mailmap (F3-05) (plus this report commit)
- **Files changed:** `engine/native/core/src/stats.rs` +228/−5 (the mailmap load and lookup, inside the slice's named file); `engine/native/core/tests/stats.rs` +295/−0; `tests/backend/engine/stats.test.ts` +43/−0; `engine/Cargo.toml`, `engine/Cargo.lock`, `engine/package.json`, `src/backend/engine/addon.ts` (version 1.0.32 → 1.0.33); this slice file. Total at the pre-report commit: 8 files, +571/−12.
- **Mailmap sources the engine reads, and how each was checked:** (1) the working tree's `.mailmap`, read without following symlinks, or `HEAD:.mailmap` in a bare repository when `mailmap.blob` is not configured; (2) the blob `mailmap.blob` names (raw object id and `HEAD:path` specs both); (3) the file `mailmap.file` names (via the trusted config path, symlinks followed, relative paths resolved from the working tree's top level, or the git directory when bare). Later sources override earlier ones (default < blob < file, verified against Git 2.56.1). Each source has a parity test in `engine/native/core/tests/stats.rs` asserting the engine's counts equal `git shortlog -sne --all --no-merges` on the same temporary repository: worktree file (committed, uncommitted, then deleted), bare `HEAD:.mailmap`, blob by id, blob by `HEAD:m.map`, file by absolute path, file by relative path, file+blob+default precedence, and a linked worktree's own `.mailmap`. Sources are re-read on every `author_stats` call (no new cache); configuration changes reopen the handle through the existing `ConfigStamp` path.
- **Tests added or changed:** engine `tests/stats.rs`: 17 new tests (6 existing → 23 in the file) — baseline without a mailmap, two identities merged, name-only, email-only, name-and-email keyed, commit email letter case preserved under a name-only entry, uncommitted-then-deleted, malformed lines, later-duplicate and partial entries, no transitive mapping, precedence, blob rev spec, relative file, missing file and bad blob skipped, bare, linked worktree, symlinked worktree `.mailmap` skipped (unix), and a non-UTF-8 canonical name declining with `Unsupported`. Every case except the decline asserts exact equality with shortlog on the same repository. TypeScript `stats.test.ts`: 1 new real-addon case (26 → 27 in the file) comparing `readAuthorStats` row for row with shortlog. Mutation check: disabling the mapping fails 15 of the 17 new engine tests (the no-mailmap baseline and the symlink-skip case are correctly unaffected).
- **Gates:** all with `CARGO_TARGET_DIR=/home/zam/Desktop/prog/_GGL/.ggl-wt/.cargo-target-f3-05`. `pnpm run engine:fmt` clean (after one `cargo fmt` fix, its own commit); `pnpm run engine:lint` clean (clippy `-D warnings`); `pnpm run engine:check` clean; `pnpm run engine:test` all workspace suites passed, 0 failed (stats suite 23 passed); `pnpm run engine:build` and `engine:build:release` built, `engine:smoke` reports 1.0.33; `pnpm exec vitest run --project backend tests/backend/engine/stats.test.ts` 27 passed (new case ran, not skipped), with `addon.test.ts` 66 passed together; `pnpm run typecheck` clean; strict Biome on `src/backend/engine/addon.ts` and `tests/backend/engine/stats.test.ts` clean (`engine/package.json` is outside Biome's allowlist); full `pnpm run test` passed (backend 120 files, 1,677 passed, 60 skipped as expected in linked worktrees; webview 85 files, 1,116 passed); `node ./docs/kb/housekeeping.mjs --check` clean before this report edit and re-run after it. No user-visible strings changed, so no `l10n:check`. No visual change, so no renders. Sonar: integrator.
- **Release-build measure:** on this repository (1,670 commits on `--all`, 1,633 non-merge, a real `.mailmap` at the root) with the release addon: `authorStats` 37.5 / 37.4 / 36.1 ms over three calls in one process, 20 authors; the same counts as `git shortlog -sne --all --no-merges` with 0 mismatches (shortlog itself took 26 ms). Method: a throwaway Node script under `/tmp` calling the rebuilt addon directly.
- **Acceptance:** mailmap applied in `author_stats` from all sources Git reads (met, per-source evidence above); parity in temporary repositories with and without a `.mailmap`, two identities for one person, name-only and email-only mappings (met, exact-equality tests); divergence treated as a bug, never a relaxed test (met — the one deliberate non-answer is a decline, below); engine version bump made in this slice (met: 1.0.33, because a 1.0.32 binary answers this read unmapped — behavior TypeScript would silently lack; TQ5 recorded as applied by the integrator's dispatch); release-build measure recorded (met, above).
- **Deviations from the slice:** `engine/package.json` and `engine/Cargo.lock` are outside the Touch list's letter but move with the version bump it authorizes (the Phase 16 rule moves the Cargo version, `engine/package.json` and `EXPECTED_ENGINE_VERSION` together; the lockfile follows the workspace version). Two deliberate bounds where shortlog would answer and the engine declines instead of risking a wrong or unbounded answer, both recorded in code comments: a mailmap source above the existing 64 MiB read ceiling fails as too large, and a *matched* canonical name or email that is not UTF-8 declines with `Unsupported` (pinned by test). Git's lenient cases are mirrored, not declined: missing `mailmap.file`, unresolvable `mailmap.blob`, malformed lines, and a symlinked worktree `.mailmap` (Git 2.56.1 refuses to follow it) are skipped exactly as shortlog skips them, each pinned by a parity test. One gix behavior corrected rather than inherited: gix's resolve normalizes a matched email's letter case to the mailmap's spelling; Git keeps the commit's spelling, so the lookup here replaces only the fields an entry provides (pinned by the letter-case test).
- **Open questions / follow-ups:** the graph's `load_commits` mailmap handling (its whole-load decline when `.mailmap` exists) and the `authors` filter read are unchanged and outside this slice — whether they should now share this mailmap code is an integrator/maintainer call for a follow-up slice. Integration note: any parallel slice that also bumps the engine version to 1.0.33 will conflict textually on `engine/Cargo.toml`, `engine/Cargo.lock`, `engine/package.json` and `addon.ts`; renumber on rebase if one landed first.
