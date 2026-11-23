---
summary: >-
  F4-03: The Blame editor-tab panel and read-only GitHub-inspired grouped-hunk
  view, modeled on GGL Diff tab and Reflog tab, reusing `abbrevCommit`/
  `shortHashLength`, `dateFormat` + shared date utils, editor typography, and
  resizable gutter width from day one.
---

# F4-03 — Blame editor-tab panel and read-only view

Status: waiting

Needs: F4-01, F4-02 (and maintainer confirmation of BQ1, BQ3, BQ4, BQ7)

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for decisions in force; "Blame view"
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

Not started.
