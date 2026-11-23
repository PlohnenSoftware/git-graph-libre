---
summary: >-
  F3-03: Offers the Statistics tab only when the engine can serve its reads,
  through a context key that mirrors the Diff tab's `diffTabAvailable`; hidden
  otherwise, never a CLI fallback.
---

# F3-03 — Engine-only availability

Status: claimed by Claude Haiku on 2026-11-23 12:18

Needs: F3-01 and F3-02 integrated; TQ2 confirmed

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`); the research
(`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
section 6 (F3-03) and TQ2; KB 170, "Planned: a Statistics tab" and "Wired: the
GGL Diff tab" (`050-ongoing-work/030-implementation-roadmap/010-phase-16-rust-engine-backend/170-the-engine-surface-what-is-wired-what-was-removed-what-is.md`).

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). Tests ship with
behavior, and touch only temporary directories or fakes. Strict Biome on
touched files, no `var`, American English. No new telemetry events or
declarations. Do not bump versions or edit CHANGELOG, README or notices; the
integrator does. Report Sonar: integrator.

## Touch

Where `git-graph-libre.diffTabAvailable` is set and where its `when` clauses
are declared: `src/extension/messageHandler.ts`, `src/extension/diffTab/scmCommands.ts`,
`src/extension/diffTab/engineSource.ts` (read only, as the pattern), and
`package.json` (the `when` clauses and the command's menu entries only); new
`src/extension/statsTab/availability.ts` if the logic needs its own module;
new `tests/backend/engine/statsAvailability.test.ts`; the slice file's Status
and Report.

## Task and acceptance

- A context key `git-graph-libre.statsTabAvailable` is true only when the
  engine is loaded, the backend setting is not `git-cli`, and the addon has
  both stats exports (F3-01's shape). Otherwise it is false.
- The Statistics command, its toolbar button and its menu entries are hidden
  when the key is false. Nothing falls back to a CLI-computed tab (KB 170).
- The key is recomputed when the backend setting changes, as the Diff tab's
  key is. The Report says how that was checked.
- Tests: the key with the engine loaded, with no addon, with an addon missing
  one export, and with the `git-cli` backend; the `when` clauses in
  `package.json` reference the key.

## Checks

- Strict Biome on each touched file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend tests/backend/engine/statsAvailability.test.ts`
- Record each command and its counts in the Report.

## Report

Not started.
