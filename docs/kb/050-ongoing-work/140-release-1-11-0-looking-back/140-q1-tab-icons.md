---
summary: >-
  Q1: give the Diff, Reflog and Blame tabs the same Git Graph Libre tab icon
  as the graph tab (honoring `tabIconColorTheme`), through one shared helper
  instead of a copy per panel. From the maintainer's test on `2026-11-23`.
---

# Q1 — Git Graph Libre icon on every GGL tab

Status: claimed by Claude Haiku on 2026-11-23 17:31

Needs: —

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`);
`src/extension/webviewPanel.ts` around `panel.iconPath` (the graph tab's
icon, light/dark pair chosen by `config.tabIconColorTheme()`).

## Touch

A new `src/extension/tabIcon.ts` (one exported helper returning the
`{ light, dark }` icon pair for an extension path and icon variant);
`src/extension/webviewPanel.ts` (use the helper, no behavior change);
`src/extension/diffTab/diffTabPanel.ts`, `src/extension/reflogTab/reflogTabPanel.ts`,
`src/extension/blameTab/blameTabPanel.ts` (set `panel.iconPath` right after
`createWebviewPanel`); tests for those (a new `tests/backend/extension/tabIcon.test.ts`
or the panels' existing tests); this file's Status and Report.

## Task and acceptance

- The maintainer saw the graph tab with the GGL icon while the Diff
  (`a.ipynb (531e77b4^ ↔ 531e77b4)`), Reflog (`Reflog: <repo>`) and Blame
  (`Blame: <file>`) tabs show VS Code's generic file icon. All four tabs must
  show the same GGL icon, the light/dark pair from
  `resources/webview-icon-<color|grey>-<light|dark>.svg`, following the
  `tabIconColorTheme` setting exactly as the graph tab does.
- If the graph tab re-applies its icon when the setting changes, the other
  tabs follow the same rule; if it only sets it at creation, so do they.
- One helper, used by all four panels; no copy of the path logic per panel.
- Tests: the helper returns the right light/dark URIs for both variants; each
  of the three tab panels sets `iconPath` on its panel (panel stubs as the
  existing panel tests use).
- No new strings, settings or telemetry.

Checks: strict Biome on touched files, `pnpm run typecheck`, the touched
Vitest suites, the full `pnpm run test` once (record counts), KB check.
Claim and changes are separate signed commits; never push.

## Report

Not started.
