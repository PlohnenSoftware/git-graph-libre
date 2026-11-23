---
summary: >-
  F4-03: The Blame editor-tab panel and read-only GitHub-inspired grouped-hunk
  view, modeled on GGL Diff tab and Reflog tab, reusing `abbrevCommit`/
  `shortHashLength`, `dateFormat` + shared date utils, editor typography, and
  resizable gutter width from day one.
---

# F4-03 — Blame editor-tab panel and read-only view

Status: done — awaiting integration

Needs: F4-01, F4-02 (and maintainer confirmation of BQ1, BQ3, BQ4, BQ7)

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`070-history/240-blame-view.md`) for decisions in force; "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`);
the Webview UI Styling Guide (Reference) and **One name and one shape for a
shared concept** (`040-reference/030-webview-ui-styling-guide/020-one-name-and-one-shape-for-a-shared-concept.md`).

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy third-party code. Tests ship with behavior, using
real-Git fixtures in temporary directories only. Strict Biome on touched
files, no `var`, American English, OKLCH colors through `--ngg-*` tokens with
VS Code theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: registering
`git-graph-libre.showBlame` through `commandManager.register()` uses the
already-declared `feature` event, so `telemetry.json` stays untouched. Do not
bump versions or edit `CHANGELOG.md`, `README.md`, or `NOTICE.md`; the
integrator does. Report Sonar: integrator.

## Touch

New `src/blameTabTypes.ts` (shared host/webview message, display, typography,
and payload types, mirroring `src/reflogTabTypes.ts` and `src/diffTabTypes.ts`);
new `src/extension/blameTab/blameData.ts` (creates a `BlameSource` backed by
`loadBlame` and `computeBlameHotspots`, reading live `config.gitPath()`);
new `src/extension/blameTab/blameTabHtml.ts` (CSP-safe HTML loading
`media/tokens.css`, `media/blame-tab/blame-tab.css`, and `out/blameTab.min.js`);
new `src/extension/blameTab/blameTabPanel.ts` (singleton `WebviewPanel`
`git-graph-libre.blameTab` with `retainContextWhenHidden: true`, monotonic
`requestId` race guard, live `shortHashLength`/`dateFormat`/`editor.*`
settings subscription); new `src/webview/blameTab/{main,rowModel,view,columnResize}.ts`;
new `media/blame-tab/blame-tab.css`; `esbuild.js` (add `blameTab.min` webview
entry point); `package.json` and `package.nls*.json` (command
`git-graph-libre.showBlame` — "Show Blame for Current File");
`src/extension/commandManager.ts` (register `git-graph-libre.showBlame`,
resolving the active editor's file to its known repo via `findKnownRepoForPath`
and passing the active cursor line as `targetLine`);
`l10n/bundle.l10n*.json` (all five bundles); tests under
`tests/webview/blameTab/` (rowModel, view, main, columnResize, blameTabCss,
blameData real-Git), `tests/webview/blameTabPanel.test.ts`, and command
registration coverage in `tests/webview/commandManager.test.ts` (or existing
commandManager test path); this slice file's Status and Report.

## Task and acceptance

- **Command & panel lifecycle:**
  - `git-graph-libre.showBlame` resolves the active text editor's file path to
    its repository (using `findKnownRepoForPath`, falling back to
    `resolveGitRoot` like `viewActiveEditorRepo`), opens or reveals/retargets
    the singleton Blame tab (`git-graph-libre.blameTab`), and scrolls to the
    active editor's 1-based cursor line when available.
  - When no editor is active or the file is not in a Git repository, shows a
    localized warning message and opens nothing.
- **GitHub-inspired grouped-hunk layout (read-only core):**
  - Sticky header (`position: sticky; top: 0` with opaque
    `--vscode-editor-background`) showing folder/repo name, repo-relative file
    path, revision badge (`Working Tree` or abbreviated hash), and line count.
  - Each `GitBlameHunk` renders as one grouped visual band with a clean border
    between hunks:
    - Left blame gutter (draggable right edge to widen/narrow, 40px minimum
      floor, width saved in webview state per repo, mirroring
      `src/webview/reflogTab/columnResize.ts`): commit summary (truncated with
      full summary tooltip), author name, short commit hash formatted via
      `abbrevCommit(hash, display.shortHashLength)` (full hash on hover), and
      date formatted via `src/webview/utils/date.ts` obeying `dateFormat`
      (full local date+time on hover). Uncommitted hunks show localized
      "Uncommitted changes" with `--ngg-uncommitted` styling and no fake hash.
    - Right source area: right-aligned `tabular-nums` 1-based line numbers +
      monospaced source text obeying `editor.fontSize`, `editor.lineHeight`
      (same `lineHeightInPixels` rule as `diffTabPanel.ts`), and
      `editor.tabSize`.
    - Each hunk carries `data-commit`, `data-heat` (from `F4-02` — `0`..`9` or
      `uncommitted` / `none`), and `data-start-line` hooks ready for `F4-04`
      and `F4-05`.
- **One name and one shape for a shared concept:**
  - Reuse `ui.commit`, `ui.date`, `time.dateformat`, `time.needFormatMonth`,
    `month.*` from the existing bundles, `abbrevCommit` +
    `config.shortHashLength()`, and `src/webview/utils/date.ts`. Live
    configuration changes to `shortHashLength`, `dateFormat`, or editor font
    settings refresh the retained tab cleanly.
- **States & race safety:**
  - Distinct localized states for: `loading`, `empty`, `binary`, `tooLarge`,
    `untracked`, `unborn`, and `error` (distinct from empty).
  - Monotonic `requestId` on every host message; the panel drops superseded
    loads and the webview ignores any reply with `requestId < latestSeen`.
- **Styling & visual verification:**
  - VS Code theme tokens first, `--ngg-*` OKLCH fallbacks second; zero raw
    hex/RGB/HSL/named literals; guarded by `blameTabCss.test.ts`.
  - Render the tab headlessly (PyQt6 QtWebEngine under `xvfb-run`) in both
    dark and light themes using the real `media/tokens.css`,
    `media/blame-tab/blame-tab.css`, and built `out/blameTab.min.js` fed a
    multi-hunk file (including an uncommitted hunk) plus empty/error states;
    record output paths and verification findings in Report.
- **Tests:**
  - Webview unit tests: grouped hunk rendering, `shortHashLength` & `dateFormat`
    alignment, `targetLine` scroll/highlight, gutter resize + clamp + saved
    state, request-id race drop, all non-line states (`loading`, `empty`,
    `binary`, `tooLarge`, `untracked`, `unborn`, `error`), CSS token guard.
  - Extension/panel tests: reveal & reuse, live settings refresh,
    `git-graph-libre.showBlame` command resolution & telemetry (`feature` only),
    real-Git `blameData` loader test.

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `node esbuild.js --production`,
relevant `vitest` suites, `pnpm run l10n:check`, and
`node ./docs/kb/housekeeping.mjs --check`) and record each command and result.
Claim and changes are separate signed commits; never push.

## Report

- **Agent / date:** Muse Code (claimed 2026-11-23 12:05, interrupted by HTTP 429 quota error after 6 signed commits and partial test files), continued and completed by Gemini 4 Argon (agy), 2026-11-23 12:38
- **Branch and commits:** `blame/F4-03` (from base `b52acee0`)
  - `b418c8d4 G docs(blame): claim slice F4-03 (F4-03)`
  - `44fd89a8 G feat(blame): add the blame tab shared types (F4-03)`
  - `f3d823d6 G feat(blame): add the blame tab data source (F4-03)`
  - `c93313b1 G feat(blame): add the blame tab panel and document (F4-03)`
  - `4f7265b5 G feat(blame): add the blame tab webview view (F4-03)`
  - `848ba203 G feat(blame): register Show Blame for Current File (F4-03)`
  - `5d37ad56 G test(blame): cover blame tab row model, view, gutter resize and CSS tokens (F4-03)`
  - `9e044b62 G test(blame): cover blameData real-Git loader and blameTabPanel lifecycle (F4-03)`
  - `78aa851f G test(blame): cover git-graph-libre.showBlame command resolution (F4-03)`
  - plus the report commit that follows this text
- **Files changed:** 32 files, +2701/−13 against `b52acee0` before this report (`git diff --stat b52acee0..HEAD`):
  - `docs/kb/070-history/240-blame-view/120-f4-03-blame-tab-read-only.md` (+1/−1 before report)
  - `esbuild.js` (+2/−1)
  - `l10n/bundle.l10n.json`, `l10n/bundle.l10n.nl.json`, `l10n/bundle.l10n.pl.json`, `l10n/bundle.l10n.zh-cn.json`, `l10n/bundle.l10n.zh-tw.json` (+15/−1 each; 14 keys appended at the end of each bundle)
  - `media/blame-tab/blame-tab.css` (+140)
  - `package.json` (+5)
  - `package.nls.json`, `package.nls.nl.json`, `package.nls.pl.json`, `package.nls.zh-cn.json`, `package.nls.zh-tw.json` (+2/−1 each; `command.showBlame`)
  - `src/blameTabTypes.ts` (+151)
  - `src/extension/blameTab/blameData.ts` (+75)
  - `src/extension/blameTab/blameTabHtml.ts` (+31)
  - `src/extension/blameTab/blameTabPanel.ts` (+263)
  - `src/extension/commandManager.ts` (+87)
  - `src/webview/blameTab/columnResize.ts` (+39)
  - `src/webview/blameTab/main.ts` (+61)
  - `src/webview/blameTab/rowModel.ts` (+199)
  - `src/webview/blameTab/view.ts` (+249)
  - `tests/webview/blameTab/blameData.test.ts` (+123)
  - `tests/webview/blameTab/blameTabCss.test.ts` (+61)
  - `tests/webview/blameTab/columnResize.test.ts` (+48)
  - `tests/webview/blameTab/fixtures.ts` (+152)
  - `tests/webview/blameTab/main.test.ts` (+95)
  - `tests/webview/blameTab/rowModel.test.ts` (+128)
  - `tests/webview/blameTab/view.test.ts` (+300)
  - `tests/webview/blameTabPanel.test.ts` (+323)
  - `tests/webview/commandManager.test.ts` (+83/−1)
- **Tests added or changed:** 48 new tests in the webview project (webview total 1,121 → 1,169 across 85 → 92 test files):
  - `tests/webview/blameTab/columnResize.test.ts` (5 tests: 40px floor, widen/narrow, bounds clamp, restored saved width validation)
  - `tests/webview/blameTab/rowModel.test.ts` (8 tests: initial loading, first data apply, `requestId` race drop for data and loading, same-target vs new-target loading behavior, `targetLine`, display & typography carry, `heatAttribute` values, `commitDate` formats and hover title)
  - `tests/webview/blameTab/view.test.ts` (11 tests: pre-label blank render, loading state, grouped hunk DOM & header badges, `shortHashLength` & `dateFormat` alignment, revision badge short hash, uncommitted hunk styling without fake hash, distinct non-line states and error state, `targetLine` highlight and `scrollIntoView`, editor typography CSS custom properties, gutter drag resize + 40px floor + line retention, stray mousemove ignore)
  - `tests/webview/blameTab/main.test.ts` (5 tests: initial `ready` post, loading-to-data flow, stale `requestId` ignore, per-repo dragged gutter width persistence via `getState`/`setState`, cross-origin message ignore)
  - `tests/webview/blameTab/blameTabCss.test.ts` (5 tests: VS Code theme tokens + `--ngg-*` OKLCH fallbacks with zero raw hex/RGB/HSL/named color literals, `.ggl-blame` scoping + sticky header + `overflow-wrap: anywhere` + `@media (forced-colors: active)`, resizable gutter + `tabular-nums` + editor typography variables, `--ngg-uncommitted` + `color-mix(in oklab, ...)` target line, non-line state and error foreground tokens)
  - `tests/webview/blameTab/blameData.test.ts` (5 real-Git tests in temporary directories: two-commit scored hunks with live `gitPath()` and command recorder, uncommitted working-tree lines with neutral committed heat, revision blame `HEAD~1` with `resolvedRev`, distinct `empty`/`binary`/`untracked` states, bad revision error payload)
  - `tests/webview/blameTabPanel.test.ts` (9 tests: singleton retained panel creation, nonce-only CSP without `unsafe-eval`, loading-then-data flow + shared `ui.commit`/`ui.date` labels + `reportBlameOpened` single-call per open, live `shortHashLength` reload, live `editor.fontSize`/`tabSize` reload with `lineHeightInPixels`, panel reuse and retitle across files, superseded load drop, failed load error payload + `reportBlameOpened({ ok: false })`, invalid `targetLine` normalization, re-creation after dispose)
  - `tests/webview/commandManager.test.ts` (4 new tests in `describe("show blame (F4-03)")` plus updated command surface expectations: active editor resolution in longest-matching known repo with 1-based cursor `targetLine` and `feature` telemetry, unknown repo discovery via `resolveGitRoot`, no-active-editor warning, outside-Git-repository warning)
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 30 touched `.ts/.js/.json/.css` files: clean (0 errors, 0 warnings; only the informational `$schema` 2.5.13 vs CLI 2.6.8 notice).
  - `pnpm run typecheck`: clean (`tsc -p ./src --noEmit && tsc -p ./src/webview --noEmit && tsc -p ./tests --noEmit`).
  - `node esbuild.js --production`: clean (builds `out/blameTab.min.js`).
  - `npx vitest run --project webview tests/webview/blameTab/ tests/webview/blameTabPanel.test.ts tests/webview/commandManager.test.ts`: 8 files, 109 passed.
  - `pnpm run test`: backend 116 files, 1,571 passed | 60 skipped (expected in linked worktree); webview 92 files, 1,169 passed.
  - `pnpm run l10n:check`: 100.0% complete across `nl`, `pl`, `zh-cn`, `zh-tw` for both `bundle.l10n.*` (879 keys) and `package.nls.*` (134 keys).
  - `node ./docs/kb/housekeeping.mjs --check`: clean (exit 0).
  - Headless visual renders (`xvfb-run -a python3 /home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/render.py` with `QT_QPA_PLATFORM=xcb`, `WAYLAND_DISPLAY` unset, `QT_SCALE_FACTOR=2`, loading the real `media/tokens.css`, `media/blame-tab/blame-tab.css`, and built `out/blameTab.min.js`):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/blame-dark-lines.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/blame-light-lines.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/blame-dark-wide-gutter.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/blame-dark-empty.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-03/blame-light-error.png`
    - Inspected all 5 PNGs directly: verified sticky header (`git-graph-libre`, `src/webview/blameTab/view.ts`, `Working Tree` pill badge, `10 lines`), grouped hunk bands with crisp borders, truncated commit summary + author + 8-char hash + formatted date in the 280px (and 360px widened) gutter, `Uncommitted changes` rendered in `--ngg-uncommitted` with no fake hash or date, right-aligned `tabular-nums` line numbers, highlighted target line 5, and distinct empty/error states in dark and light themes.
  - Sonar: integrator
- **Acceptance:**
  - Command & panel lifecycle (`git-graph-libre.showBlame`, `findKnownRepoForPath` + `resolveGitRoot` fallback, singleton `git-graph-libre.blameTab` with `retainContextWhenHidden: true`, 1-based cursor `targetLine`, localized warnings when no editor or outside Git repo): met (`src/extension/commandManager.ts`, `src/extension/blameTab/blameTabPanel.ts`, `tests/webview/commandManager.test.ts`, `tests/webview/blameTabPanel.test.ts`). Per maintainer decision of `2026-11-23`, no `editor/title` menu item was added.
  - GitHub-inspired grouped-hunk layout (sticky header with opaque `--vscode-editor-background`, folder name, repo-relative path, revision badge, line count; grouped hunk bands with draggable gutter right edge, 40px floor, per-repo width saved in webview state; commit summary, author, `abbrevCommit(hash, display.shortHashLength)`, date via `src/webview/utils/date.ts`, localized "Uncommitted changes" with `--ngg-uncommitted` and no fake hash; `tabular-nums` 1-based line numbers + monospaced source text obeying `editor.fontSize`/`lineHeight`/`tabSize`; `data-commit`, `data-heat`, `data-start-line` hooks): met (`src/webview/blameTab/{view,rowModel,columnResize,main}.ts`, `media/blame-tab/blame-tab.css`).
  - One name and one shape for a shared concept (`ui.commit`, `ui.date`, `time.dateformat`, `time.needFormatMonth`, `month.*`, `abbrevCommit` + `config.shortHashLength()`, `config.dateFormat()` + `src/webview/utils/date.ts`, live `onDidChangeConfiguration` refresh): met.
  - States & race safety (distinct localized `loading`, `empty`, `binary`, `tooLarge`, `untracked`, `unborn`, and `error` states; monotonic `requestId` on host messages dropped when superseded on both host and webview): met.
  - Styling & visual verification (VS Code theme tokens first, `--ngg-*` OKLCH fallbacks second, zero raw hex/RGB/HSL/named literals guarded by `blameTabCss.test.ts`, dark & light headless renders inspected): met.
  - Localization: all 14 new `blame.*` / `command.showBlame.*` keys appended at the end of all five `l10n/bundle.l10n*.json` files and `command.showBlame` added to all five `package.nls*.json` files (`l10n:check` 100%). The `nl`, `pl`, `zh-cn`, and `zh-tw` strings were translated by the agent; a native speaker review would help.
  - Telemetry hook for T1: registering `git-graph-libre.showBlame` through `commandManager.register()` uses the existing `feature` event (`telemetry.json` untouched). For slice T1's open-and-outcome telemetry, `BlameTabDeps` in `src/extension/blameTab/blameTabPanel.ts` (line 32) provides one injectable callback `reportBlameOpened?: (outcome: { ok: boolean }) => void`, invoked at lines 132–134 once when the initial blame load for an `openBlameTab` call completes (`ok: payload.error === null`, never on a subsequent refresh). In `src/extension/commandManager.ts` (line 675), `openBlamePanel` is called with `reportBlameOpened` unset so the integrator can wire T1's helper there at integration.
- **Deviations from the slice:** none. All touched files are inside the slice's Touch list. Note that `src/extension/blameTab/blameData.ts` calls F4-02's integrated `scoreBlameHunks` export from `src/blameHotspot.ts` (the slice prompt's Additional notes noted the integrated name `scoreBlameHunks(hunks, commits, mode, nowSeconds)` where the slice prose wrote `computeBlameHotspots`).
- **Open questions / follow-ups:**
  - Integrator: wire slice T1's tab-open telemetry helper into `reportBlameOpened` in `src/extension/commandManager.ts` (`openBlame`, line 675) once T1 is integrated.
  - Native review recommended for the `nl`, `pl`, `zh-cn`, and `zh-tw` translations of the 14 `blame.*` / `command.showBlame.*` bundle keys and `command.showBlame` in `package.nls*.json`.
