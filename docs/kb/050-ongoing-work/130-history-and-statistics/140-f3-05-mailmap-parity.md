---
summary: >-
  F3-05: Applies the repository's mailmap in the engine's `author_stats`, so the
  contributors list matches `git shortlog -sne --all --no-merges`, proven by an
  engine test against shortlog in temporary repositories. Decision-dependent on
  TQ5.
---

# F3-05 — Mailmap parity in `author_stats`

Status: claimed by Muse Code on 2026-11-23 12:03

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

Not started.
