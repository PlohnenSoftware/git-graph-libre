---
summary: >-
  F3-02: The Statistics tab in the webview, a plain TypeScript view with a
  contributors list and a 7 x 24 weekday-by-hour heatmap over the F3-01 reads,
  OKLCH colors, and English copies of its strings in every bundle until F3-04.
---

# F3-02 — Statistics tab, webview

Status: waiting on F3-01 integration, and on the maintainer confirming TQ1 and TQ2 (register, Decisions)

Needs: F3-01 integrated; TQ1 and TQ2 confirmed

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree; it is
not a Haiku slice because it spans the message bus, the toolbar and the view.

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`); the research
(`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 2.1, 2.2 and 6; the Webview UI Styling Guide (Reference); the reflog
tab's panel and bundle (`src/extension/reflogTab/`, `src/webview/reflogTab/`)
as the pattern for an editor-tab view.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). Tests ship with
behavior, and touch only temporary directories or fakes. Strict Biome on
touched files, no `var`, American English, OKLCH colors through `--ngg-*`
tokens with VS Code theme tokens first. No new telemetry events or
declarations. Do not bump versions or edit CHANGELOG, README or notices; the
integrator does. Report Sonar: integrator.

## Touch

New `src/extension/statsTab/` (the panel and its reads, modeled on
`src/extension/reflogTab/`); new `src/webview/statsTab/` (the view and its
bundle entry); `src/types.ts` and `src/extension/messageHandler.ts` for the
message shape; `src/webview/` toolbar wiring where the view mode switch lives
(found by grep for the reflog tab's command); `l10n/bundle.l10n.json` and the
four `l10n/bundle.l10n.{nl,pl,zh-cn,zh-tw}.json` files, adding only the new
keys with English copies; new tests under `tests/webview/` and
`tests/backend/` for this slice; the slice file's Status and Report.

## Task and acceptance

- A command opens the Statistics tab (command id and toolbar placement follow
  the reflog tab). The panel is a singleton, reads through F3-01's
  `readAuthorStats` and `readActivityHeatmap`, and sends the payload to the
  webview as project-owned types only.
- Contributors: ranked by commit count; each row shows the name, a bar
  relative to the top author, the count and the percentage.
- Heatmap: 7 rows (Sunday to Saturday) by 24 hour columns; one cell per
  weekday and hour, with a hover title giving the weekday, the hour and the
  count, and a five-step legend. Cell color is an OKLCH ramp derived from a
  `--ngg-*` token; no literal hex.
- Every user-visible string uses a new `stats.*` key, added to all five
  bundles with English copies. F3-04 replaces the copies with translations.
  Say so in the Report.
- When the reads return `unavailable`, the view shows its unavailable state
  and does not fall back to the CLI (TQ2). F3-03 decides the entry point.
- Loading state while the first payload is pending; each open reloads (TQ7).
- Tests: a DOM test for 7 rows, 24 columns per row and 5 legend cells; the
  empty state; the unavailable state; the message shape; and the panel
  against a fake reader.
- Do not match Git Graph+ identifiers or magic constants (TQ3); derive sizes
  from GGL's own geometry.

## Checks

- Strict Biome on each touched file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend <touched backend files>` and
  `pnpm exec vitest run --project webview <touched webview files>`
- `pnpm run l10n:check` (expected to pass with English copies)
- Record each command and its counts in the Report.

## Report

Not started.
