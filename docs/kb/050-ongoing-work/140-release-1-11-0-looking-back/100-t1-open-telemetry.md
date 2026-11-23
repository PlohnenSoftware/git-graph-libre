---
summary: >-
  T1: telemetry approved by the maintainer (`2026-11-23`): whether each tab
  (Reflog, GGL Diff, and later Blame and Statistics) was opened from its
  button or command and whether that went without errors, and the same for
  every worktree button; nothing about content or option use. Inside the
  existing `feature` event and the three chokepoints; `telemetry.json` and
  the README disclosure updated.
---

# T1 — Open-and-outcome telemetry for tabs and worktree buttons

Status: claimed by Muse Code on 2026-11-23 12:01

Needs: —

Agent: Muse Code

Read first: `AGENTS.md`; the KB index and every *always read* section;
Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`), its Telemetry
answer above all; Telemetry (Reference) and its three subsections, whole.

## The maintainer's words (`2026-11-23`)

"Please measure if a given feature, i.e. a tab, was opened, i.e. if the
person clicked the buttons to open it, and if that went without errors; same
for the buttons for worktrees; don't measure [what they did with it]."

## Touch

`src/telemetry/**`; `src/extension/commandManager.ts` and
`src/extension/messageHandler.ts` (their existing chokepoints only);
`src/extension/reflogTab/reflogTabPanel.ts` and the GGL Diff tab's panel
(`src/extension/diffTab*`), only to report whether opening succeeded;
`telemetry.json`; `README.md`'s Telemetry section only; tests under
`tests/**/telemetry*` and the touched panels' tests; this slice file's
Status and Report. If a worktree button's outcome is not already reported
by `registerAction()`, the worktree action handlers it routes to.

## Task and acceptance

- **Audit first** and record the result in the Report: which tab-opening
  commands and buttons, and which worktree buttons (Open in New Window, Open
  Here, Switch Graph, Copy Path, Create, Lock, Unlock, Move, Remove, Repair,
  Remove Stale Entry, Prune), already reach the ingest today through
  `register()` (palette commands) or `registerAction()` (webview actions,
  outcome included), with which feature id and whether the outcome
  (succeeded or failed) is included.
- **Fill only the gaps**, inside the existing event types: the ingest
  accepts only `activate` and `feature`. Feature ids follow the existing
  naming and the ingest pattern `^[a-z][a-zA-Z0-9._-]{0,63}$`, asserted in
  tests. A tab counts as opened when its panel was created or revealed and
  its first content load did not fail; a failed open (no repository, load
  error) reports a failure outcome. A worktree button reports one event with
  its outcome.
- **Never send** paths, branch names, hashes, file names, search text,
  options, counts of rows, or which entries were looked at; no per-use
  timing. Opening from the toolbar button and from the palette may share one
  feature id; do not add an entry-point property unless an existing
  chokepoint already carries one.
- Respect every existing rule: the `createTelemetryLogger` boundary, the
  tri-state `telemetry.enabled`, consent, no direct `fetch`.
- `telemetry.json` declares every new feature id/property; the README's
  Telemetry section (the user-facing disclosure) lists them in plain words,
  in step with `telemetry.json`.
- Leave a small, documented helper or pattern the Blame tab (F4-03 onward)
  and the Statistics tab (F3-02) will call when they open, and say in the
  Report how to use it.
- Check the sibling ingest repository read-only
  (`/home/zam/Desktop/prog/_GGL/git-graph-libre-telemetry`, if present) for
  any feature-id allowlist beyond the pattern; report, do not change it.
- Tests: each new signal fires once with the right id and outcome, never
  carries forbidden data, and nothing fires with telemetry disabled.

Focused checks: strict Biome on touched files, `pnpm run typecheck`, the
touched test files, `pnpm run l10n:check` if any string changed,
`node ./docs/kb/housekeeping.mjs --check`. Sonar: integrator.

## Report

Not started.
