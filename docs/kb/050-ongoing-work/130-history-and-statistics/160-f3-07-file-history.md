---
summary: >-
  F3-07: File History, an engine path-scoped log with a context-menu entry whose
  results feed the existing search list. Only if TQ1 selects File History; its
  `--follow` and limit are the maintainer's decisions.
---

# F3-07 — File History

Status: claimed by Gemini 4 Neon (agy) on 2026-11-23 12:34

Needs: TQ1 selects File History; `--follow` and the result limit decided

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`), TQ1; the
research (`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 1 (candidate b), 3 and 6 (F3-07); the search results path in
`src/backend/` and its webview (the existing search list this slice reuses);
the reflog read (F1-01, `src/backend/queries/reflog.ts`) as the pattern for a
bounded, path-validated Git read.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). The research notes
Git Graph+'s file-history limit and its missing `--follow`; neither value is
copied, and any constant is chosen from GGL's needs and recorded. Tests ship
with behavior, real-Git fixtures in temporary directories only. Strict Biome
on touched files, no `var`, American English. Every user-visible string in
all five bundles. No new telemetry events or declarations. Do not bump
versions or edit CHANGELOG, README or notices; the integrator does. Report
Sonar: integrator.

## Touch

New `src/backend/queries/fileHistory.ts`; `src/backend/types/queries.types.ts`;
`engine/native/core/src/log.rs` or a new `engine/native/core/src/file_history.rs`,
with the export in `engine/native/node/src/lib.rs` (only if the engine arm is
in scope, which the maintainer confirms); the context-menu entry in the file
explorer and editor menus in `package.json`; the command handler in
`src/extension/`; the existing search results path; `l10n/` keys in all five
bundles; tests under `tests/backend/queries/` and `tests/`; the slice file's
Status and Report.

## Task and acceptance

- A bounded read lists commits touching one path across all refs
  (`git log --all -- <path>`), newest first, with the same validation as the
  reflog read: refuse a path that starts with `-` or escapes the repository,
  and pass `--end-of-options` where Git supports it.
- `--follow` is on or off as the maintainer decided; the Report says what
  Git's documentation says about each choice.
- Results open in the existing search list, not a new view.
- Tests: a renamed file with and without `--follow`; a file in a linked
  worktree; a path refused; an empty history reported as empty, not an error.

## Checks

- Strict Biome on each touched `.ts` file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend tests/backend/queries/fileHistory.test.ts`
- `pnpm run l10n:check`; the Rust arm and addon rebuild if `engine/**` changed.
- Record each command and its counts in the Report.

## Report

Not started.
