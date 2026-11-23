---
summary: >-
  F3-08: A VS Code Timeline provider over F3-07's per-file history, registered
  only if TQ1 selects Timeline and after the API is checked against the
  repository's `@types/vscode`.
---

# F3-08 — VS Code Timeline provider

Status: waiting on F3-07 integration and on TQ1 selecting Timeline

Needs: F3-07 integrated; TQ1 selects Timeline

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`), TQ1; the
research (`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 4 and 6 (F3-08); F3-07's Report for the history read's shape.

Rules for every slice: implement from Git's documentation, the VS Code API
types in the repository's `@types/vscode`, and this project's patterns; never
read or copy Git Graph+ code (TQ3). Tests ship with behavior, with fakes for
the VS Code API. Strict Biome on touched files, no `var`, American English.
No new telemetry events or declarations. Do not bump versions or edit
CHANGELOG, README or notices; the integrator does. Report Sonar: integrator.

## Touch

New `src/extension/timeline/` (the provider and its registration); the
`package.json` contribution that the Timeline provider needs, and only that;
`src/extension/extension.ts` for the registration call; new tests under
`tests/` for the provider; the slice file's Status and Report.

## Task and acceptance

- Before writing code, confirm the Timeline provider namespace and signature
  against `node_modules/@types/vscode` in the worktree, and record the
  declaration's location in the Report. The research did not verify it.
- The provider serves F3-07's history for the active file, mapping each commit
  to a timeline item with its date, author and message, and the Git Graph
  command for an item.
- The provider is registered only when the Statistics engine gate (F3-03's
  key) allows it. Without the engine the file history is not offered. This
  is a decision to confirm in the Report, not one to make silently.
- Tests: the item mapping from fake history; an empty history; a missing
  file; registration is skipped when the gate is false.

## Checks

- Strict Biome on each touched file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend <touched test files>`
- `pnpm run l10n:check` if strings changed.
- Record each command and its counts in the Report.

## Report

Not started.
