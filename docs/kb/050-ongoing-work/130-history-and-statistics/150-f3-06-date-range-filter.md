---
summary: >-
  F3-06: A date-range filter for the Statistics tab, with `since` and `until`
  added to the engine reads. Only if TQ1 selects the date-scrubber reading of
  "timeline"; otherwise it is not dispatched.
---

# F3-06 — Date-range filter

Status: waiting on F3-02 integration, and on TQ1 selecting the date-scrubber reading

Needs: F3-02 integrated; TQ1 selects the scrubber reading

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`), TQ1 and TQ6; the
research (`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 1 (candidate a, the time dimension), 6 (F3-06) and TQ6; the Phase 16
design rules for engine reads.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). Tests ship with
behavior, and touch only temporary directories or fakes. Strict Biome on
touched files, no `var`, American English, OKLCH colors through `--ngg-*`
tokens with VS Code theme tokens first. Every user-visible string in all five
bundles. No new telemetry events or declarations. Do not bump versions or
edit CHANGELOG, README or notices; the integrator does. Report Sonar:
integrator.

## Touch

`engine/native/core/src/stats.rs`, `api.rs`, `types.rs` and
`engine/native/node/src/lib.rs` (optional `since` and `until` arguments);
`src/backend/engine/stats.ts` and its types (F3-01); the Statistics webview
and its panel (F3-02 files); `l10n/` keys for the range control, all five
bundles; tests under `engine/native/core/tests/` and `tests/`; the slice
file's Status and Report.

## Task and acceptance

- `since` and `until` filter by the commit's author date, with the same
  inclusive and exclusive rules `git log --since --until` uses; the Report
  records what was verified.
- The range control has a preset set and a free range, with no new settings.
- Parity: with and without a range, the engine equals `git shortlog` and the
  CLI-derived heatmap on the same temporary repository.
- Measure the filtered read on this repository; record the numbers.

## Checks

- Rust arm: `pnpm run engine:fmt && pnpm run engine:lint && pnpm run engine:check && pnpm run engine:test`, and the addon rebuild.
- Strict Biome on touched `.ts` files; `pnpm run typecheck`
- `pnpm run l10n:check`
- Record each command and its counts in the Report.

## Report

Not started.
