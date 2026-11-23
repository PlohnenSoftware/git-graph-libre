---
summary: >-
  Q1: give the Diff, Reflog and Blame tabs the same Git Graph Libre tab icon
  as the graph tab (honoring `tabIconColorTheme`), through one shared helper
  instead of a copy per panel. From the maintainer's test on `2026-11-23`.
---

# Q1 — Git Graph Libre icon on every GGL tab

Status: done — awaiting integration

Needs: —

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`070-history/260-release-1-11-0-looking-back.md`);
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

- **Agent / date:** Claude Haiku 5.5 (claude-haiku-5-5), 2026-11-23 17:33
- **Branch and commits:** `rel-1.11.0/Q1` (base `d8ef44a0`)
  - `d35aab88` G docs(kb): claim slice Q1 (tab icons)
  - `b70b7c66` G refactor(extension): one shared helper for the GGL tab icon (Q1)
  - `1a5f0785` G feat(tabs): GGL icon on the Diff, Reflog and Blame tabs (Q1)
  - this report commit (see `git log`)
- **Files changed:** `src/extension/tabIcon.ts` (new, +25), `src/extension/webviewPanel.ts` (+3/−14), `src/extension/diffTab/diffTabPanel.ts` (+3), `src/extension/reflogTab/reflogTabPanel.ts` (+2), `src/extension/blameTab/blameTabPanel.ts` (+2), `tests/backend/extension/tabIcon.test.ts` (new, +28), `tests/webview/diffTabPanel.test.ts` (+10), `tests/webview/reflogTabPanel.test.ts` (+10), `tests/webview/blameTabPanel.test.ts` (+10), this file (Status and Report).
- **Tests added or changed:** `tabIcon.test.ts` (2: color and grey pairs); one `shows the GGL tab icon, following tabIconColorTheme` test in each of the Diff, Reflog and Blame panel suites (grey setting). After the slice: backend 1,594 passed (the integration log's last recorded backend count was 1,592, so +2 is inferred, not measured on `d8ef44a0`); webview 1,317 passed. No webview count before the slice was measured on `d8ef44a0`, so no "before" webview figure is given.
- **Gates:**
  - `pnpm run test`: backend `1594 passed | 60 skipped (1654)`, 120 files; webview `1317 passed (1317)`, 94 files. Exit 0. The 60 skips are the linked-worktree skips.
  - `pnpm run typecheck`: exit 0.
  - Strict Biome on the 9 touched `.ts` files: `Checked 9 files ... No fixes applied`, exit 0 (see the Deviation note on how it ran).
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Focused Vitest runs before commit: `tabIcon.test.ts` 2 passed; the Diff, Reflog, Blame and webviewPanel suites 106 passed.
  - `pnpm run l10n:check`: not run, no user-visible strings changed.
  - Renders: not run. The slice changes only which icon files a tab's `iconPath` points at; no CSS or webview markup changed.
  - Sonar: integrator.
- **Acceptance:**
  - All four tabs use the same GGL icon pair from `resources/webview-icon-<color|grey>-<light|dark>.svg`, chosen by `config.tabIconColorTheme()`: met (graph tab through the helper; Diff, Reflog and Blame set `panel.iconPath` right after `createWebviewPanel`).
  - Follows the setting the way the graph tab does, set once at creation with no re-apply on a settings change: met. The graph tab only sets it at creation (verified in `src/extension/webviewPanel.ts`), so the other tabs do the same.
  - One helper used by all four panels, no per-panel path logic: met (`tabIconPaths` in `src/extension/tabIcon.ts`).
  - Tests for the helper's light/dark URIs for both variants, and each of the three panels setting `iconPath`: met.
  - No new strings, settings or telemetry: met.
- **Deviations from the slice:**
  - `config` is imported from `@/config` in `diffTabPanel.ts`, the same way `reflogTabPanel.ts` and `blameTabPanel.ts` already do; the Diff panel's deps had no config. This is the least invasive route and stays inside the Touch list.
  - **Biome config mismatch (environment, not changed):** `biome.strict.jsonc` declares `$schema` 2.5.13, but the installed CLI (`node_modules/.bin/biome`) is 2.6.8, so `biome check --config-path biome.strict.jsonc` aborts with a config error and checks nothing. To run the rules, I made a temporary copy of the config with only the `$schema` line removed and `vcs` turned off (the `vcs` git client needs the ignore file), ran Biome with `--config-path` on it, and deleted the copy afterwards. The rules and their values are unchanged, and no repository config file was edited. The integrator should fix the version pin (schema or CLI) before the integration gate.
  - **Stray trailer in `b70b7c66`:** its message has a bogus `Refs PlohnenSoftware/git-graph-libre#0` line that I wrote by mistake. I tried to amend it away, but the amend was refused by the environment's destructive-command gate, so the commit is unchanged. The integrator should strip that line when rebasing or rewording this commit. No issue number applies to Q1; no closing keyword was written.
- **Open questions / follow-ups:** none for the maintainer. A native-speaker review is not relevant (no strings). The icon is set at creation, as the graph tab does, so a `tabIconColorTheme` change applies to tabs opened after it, not to tabs already open; this follows the slice rule that the other tabs match the graph tab.
