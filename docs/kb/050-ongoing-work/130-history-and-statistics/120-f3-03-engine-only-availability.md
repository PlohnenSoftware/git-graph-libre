---
summary: >-
  F3-03: Offers the Statistics tab only when the engine can serve its reads,
  through a context key that mirrors the Diff tab's `diffTabAvailable`; hidden
  otherwise, never a CLI fallback.
---

# F3-03 — Engine-only availability

Status: done — awaiting integration

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

**Widened by the integrator (`2026-11-23`)** after the first attempt stopped
correctly at this list: also `src/extension.ts` (set the key at activation
and on a `git-graph-libre.backend` change, where the GGL Diff tab's key is
set), `src/extension/commandManager.ts` (the palette command),
`src/extension/webviewToolbar.ts` and `src/webview/main.ts` (the
`statisticsBtn` toolbar button), and their tests.

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

- **Agent / date:** Claude Haiku 5.5 (Haiku, first attempt; no escalation yet), 2026-11-23 12:18
- **Branch and commits:** `stats/F3-03` from `af908f18` — `8bf3d3cd G docs(stats): claim F3-03 engine-only availability (F3-03)`; `7e91d021 G feat(stats): add the engine-only Statistics availability check (F3-03)`; `567e312e G test(stats): cover the Statistics availability key (F3-03)`; plus the signed blocked-status commit.
- **Files changed:** `src/extension/statsTab/availability.ts` (+40, new); `tests/backend/engine/statsAvailability.test.ts` (+78, new); this slice file (Status and Report).
- **Tests added or changed:** five backend cases in `statsAvailability.test.ts`: true on `auto` with both exports; false with no addon; false when either export is missing; false on `git-cli` without loading the addon; false with no backend given. Count before 0 (the file is new), after 5, all passing.
- **Gates:** `npx vitest run --project backend tests/backend/engine/statsAvailability.test.ts` — 5 passed; `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on both files — clean; `pnpm run typecheck` — exit 0; `node ./docs/kb/housekeeping.mjs --check` — run at the end of the session (see the commit body). `l10n:check` not run: no strings changed. Sonar: integrator.
- **Acceptance:**
  - Key true only with the engine loaded, the `auto` backend and both exports: **met in the module** (`isStatsTabAvailable`), tested. The key is **not set anywhere yet**.
  - Key set at activation and recomputed on `git-graph-libre.backend` change, as the Diff key is: **not met**. The Diff key is set in `src/extension.ts` (activation, around line 61, and the configuration handler, around line 271). `src/extension.ts` is not in the Touch list.
  - Command, toolbar button and menu entries hidden while false: **not met**. Needs `package.json` `commandPalette` and menu entries (in Touch), `src/extension/commandManager.ts` (palette command, not in Touch), `src/extension/webviewToolbar.ts` and `src/webview/main.ts` (the `statisticsBtn`, not in Touch), and the `showStatistics` message route in `src/extension/messageHandler.ts` (in Touch, but its tests live in `tests/webview/messageHandler.test.ts`, also not in Touch).
  - Tests that the `when` clauses reference the key: **not met**, because no `when` clause was added.
- **Deviations from the slice:** none made. The slice stopped at the Touch boundary (Agent protocol section 8) rather than editing outside it.
- **Open questions / follow-ups:** the slice's Touch list needs widening before this can be finished, or the maintainer chooses another route. Needed: `src/extension.ts` (set the key at activation and on backend change, as the Diff key is set); `src/extension/commandManager.ts` and `package.json` (palette hiding); `src/extension/webviewToolbar.ts` and `src/webview/main.ts` (button hidden or refused while false, which needs a state from the extension); `tests/webview/messageHandler.test.ts` if the message route is gated; and `package.json` `when` clauses. The first two items are the minimum for the key to exist at all. Without them the module is inert and nothing is wired. The module is safe to keep as it is.

## Report (second attempt)

- **Agent / date:** Gemini 4 Neon (agy), 2026-11-23 12:43
- **Branch and commits:** `stats/F3-03` from `8500c512` (building on first-attempt commits `8bf3d3cd`, `7e91d021`, `567e312e`, `5522f459`, and Touch widening `8500c512`):
  - `1f833c11 G feat(stats): set statsTabAvailable context key and gate command palette (F3-03)`
  - `aff43abf G feat(stats): refuse showStatistics command and bridge message when unavailable (F3-03)`
  - `4a8d7651 G feat(stats): hide Statistics toolbar button when engine is unavailable (F3-03)`
  - plus this signed report and final status commit.
- **Files changed (since `8500c512`):** `src/extension.ts` (+3); `package.json` (+4); `src/extension/commandManager.ts` (+11); `src/extension/messageHandler.ts` (+10/−1); `src/extension/webviewToolbar.ts` (+10/−2); `src/extension/webviewHtml.ts` (+3/−1); `media/toolbar.css` (+3); `src/webview/main.ts` (+27/−6); `tests/backend/engine/statsAvailability.test.ts` (+38); `tests/backend/extension/statsContextKey.test.ts` (+199, new); `tests/webview/commandManager.test.ts` (+12); `tests/webview/messageHandler.test.ts` (+28/−3); `tests/webview/statsAssembly.test.ts` (+19/−7); `tests/webview/webviewToolbar.test.ts` (+17); `tests/webview/webviewHtml.test.ts` (+44); `tests/webview/tableStyles.test.ts` (+1); `tests/webview/statisticsToolbar.test.ts` (+116, new); plus this slice file's Status and Report.
- **Tests added or changed:**
  - `tests/backend/engine/statsAvailability.test.ts`: +2 manifest `when`-clause tests (5 → 7 passing).
  - `tests/backend/extension/statsContextKey.test.ts`: +2 tests covering `activate()` setting `git-graph-libre.statsTabAvailable` on `auto` and `git-cli` and recomputing it on `git-graph-libre.backend` configuration changes (new, 2 passing).
  - `tests/webview/commandManager.test.ts`: +1 refusal test for `git-graph-libre.showStatistics` when unavailable (passing).
  - `tests/webview/messageHandler.test.ts`: +2 tests for `showStatistics` available/unavailable/unknown-repo handling (passing).
  - `tests/webview/statsAssembly.test.ts`: +1 test verifying both default routes refuse opening on `git-cli` (2 → 3 passing).
  - `tests/webview/webviewToolbar.test.ts`: +1 test for `{ statsTabAvailable: false }` hiding `statisticsBtn`, plus assertions for the visible default button (3 → 4 passing).
  - `tests/webview/webviewHtml.test.ts`: +1 test asserting `buildWebviewHtml` renders `statisticsBtn` hidden on `git-cli` and matching `isStatsTabAvailable` on `auto` (3 → 4 passing).
  - `tests/webview/tableStyles.test.ts`: +1 CSS regression assertion for `.toolbarIconButton[hidden] { display: none; }`.
  - `tests/webview/statisticsToolbar.test.ts`: +3 tests covering `main.ts` hiding/disabling `statisticsBtn` on boot when engine is `off`/`unavailable`, refusing clicks while unavailable, and toggling visibility live on `componentStatus` updates (new, 3 passing).
- **Gates:**
  - Strict Biome (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`) on all touched `.ts`/`.json`/`.css` files: clean.
  - `pnpm run typecheck`: exit 0.
  - Full `pnpm run test`: backend 123 test files passed — 1,688 passed, 60 skipped (1,748 total; expected linked-worktree skips); webview 93 test files passed — 1,161 passed.
  - `node ./docs/kb/housekeeping.mjs --check`: clean (run before committing this report).
  - `pnpm run l10n:check`: not run (no l10n strings changed).
  - Visual verification (PyQt6 QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, real `media/tokens.css`, `base.css`, `toolbar.css`, `dropdown.css`): inspected both dark and light renders confirming `statisticsBtn` shows beside Reflog when engine is active and disappears cleanly with no gap when hidden:
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F3-03/toolbar-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F3-03/toolbar-light.png`
  - Sonar: integrator.
- **Acceptance:**
  - Context key `git-graph-libre.statsTabAvailable` true only when engine loaded, backend != `git-cli`, and addon has both stats exports: **met** (`src/extension/statsTab/availability.ts`, 5 unit tests in `statsAvailability.test.ts`).
  - Statistics command, toolbar button, and menu entries hidden when false, with no CLI fallback: **met** (`package.json` `commandPalette` `when` clause; `commandManager.ts` and `messageHandler.ts` refuse and log `[statsTab] unavailable; refusing showStatistics`; `webviewHtml.ts` + `webviewToolbar.ts` + `media/toolbar.css` hide `statisticsBtn` on first paint; `main.ts` hides/disables it on boot and live on `componentStatus` updates and refuses clicks while unavailable).
  - Key recomputed when `git-graph-libre.backend` changes, as the Diff tab's key is: **met** (`src/extension.ts` calls `setStatsTabAvailableContext({ backend: config.backend })` at activation and inside the `e.affectsConfiguration("git-graph-libre.backend")` branch; verified by `tests/backend/extension/statsContextKey.test.ts` flipping `auto` → `git-cli` → `auto`).
  - Tests cover engine loaded, no addon, missing either export, `git-cli` backend, and `package.json` `when` clauses referencing the key: **met** (`tests/backend/engine/statsAvailability.test.ts` 7 cases, plus `statsContextKey.test.ts`, `commandManager.test.ts`, `messageHandler.test.ts`, `statsAssembly.test.ts`, `webviewToolbar.test.ts`, `webviewHtml.test.ts`, `tableStyles.test.ts`, `statisticsToolbar.test.ts`).
- **Deviations from the slice:** two minimal glue edits outside the widened Touch list, both required for the toolbar button to hide cleanly in real VS Code webviews:
  1. `src/extension/webviewHtml.ts` (+3/−1): passes `{ statsTabAvailable: isStatsTabAvailable({ backend: config.backend }) }` into `buildWebviewToolbar` so `statisticsBtn` is hidden on first paint without flash and honors the two-export check.
  2. `media/toolbar.css` (+3): adds `.toolbarIconButton[hidden] { display: none; }` because `.toolbarIconButton` sets `display: inline-flex`, which otherwise overrides the browser UA `[hidden]` rule and keeps hidden toolbar buttons (`statisticsBtn`, `fetchBtn`, `pushTagsBtn`) visually rendered.
- **Open questions / follow-ups:** none. All 1.0.33 engine binaries export both `authorStats` and `activityHeatmap`, so `componentStatus`'s `engine.state === "active"` matches `isStatsTabAvailable` on live backend toggles; even for a synthetic binary missing an export, `messageHandler.ts` and `commandManager.ts` still refuse to open the tab.
