---
summary: >-
  F1-03: The Reflog tab: its own editor-tab panel and webview bundle, modeled
  on the GGL Diff tab, opened by a command and a graph toolbar button, showing
  the reflog read-only with loading, empty and error states and paging.
---

# F1-03 — Reflog tab (read-only)

Status: claimed by Muse Code subagent on 2026-11-09 02:49

Needs: F1-02

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

New `src/extension/reflogTab/*` (panel, HTML builder, message handling with
request ids); new `src/webview/reflogTab/*` (bundle); new `media/reflog-tab/*`
(styles); `esbuild.js` (one entry point); `package.json` and `package.nls*.json`
(the command and its menu contributions); `src/extension/commandManager.ts`
(registration); the graph toolbar button (`src/extension/webviewToolbar.ts`
and the matching webview code); `src/extension/webviewL10n.ts` or a
reflog-specific strings module; `l10n/bundle.l10n*.json`; tests under
`tests/extension/`, `tests/webview/reflogTab/` and a CSS regression test; the
slice file's Status and Report.

## Task and acceptance

- Command "Git Graph Libre: Show Reflog" and a toolbar button on the graph
  open (or reveal and reuse) a Reflog tab for the selected repository.
- Columns: index, action, sub-action, message, short hash, relative time with
  the full date on hover, and the F1-02 state ("Only in the reflog", "Object
  no longer exists"). The ref shown is HEAD for now; F1-05 adds the picker.
- States: loading; empty, explaining that Git keeps no reflog when
  `core.logAllRefUpdates` is off and that old entries expire; error, distinct
  from empty. "Load more" fetches only the next page of 200 (a constant).
- Replies carry request ids so a slow old reply never overwrites a newer one.
  The panel follows the repository's refresh (`repoFileWatcher`) without a
  full reload.
- Styles use theme tokens with `--ngg-*` OKLCH fallbacks, no raw colors; a
  CSS regression test guards that. Render the tab headlessly in light and
  dark themes as the styling guide requires, and record where the images are.
- Tests: webview rendering, states, paging and the request-id race; the
  command and panel reveal and reuse; the handler.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
