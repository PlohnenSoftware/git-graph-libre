---
summary: >-
  F4-07: Wire every natural entry point for the Blame view — Editor title bar
  and editor context menu, Explorer file context menu, Source Control resource
  context menu, and the Graph's Commit Details file context menu (with
  `commitDetailsViewFile.showBlame` visibility setting and deleted-file parent
  blame).
---

# F4-07 — Editor, Explorer, SCM and Commit Details entry points

Status: done — awaiting integration

**Maintainer override (`2026-11-23`, release 1.11.0): no editor title-bar
icon.** Wire the Command Palette and the `editor/context`,
`explorer/context`, `scm/resourceState/context` and Commit Details file
menus only; drop the `editor/title` contribution this slice lists.

Needs: F4-06

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`); "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`),
section 1.5; the Webview UI Styling Guide (Reference), especially context-menu
dividers (`undefined` vs `null`).

Rules for every slice: implement from VS Code APIs and this project's own
patterns (`src/extension/diffTab/scmCommands.ts`, `src/contextMenuVisibility.ts`,
`src/webview/main.ts`); never copy third-party code. Tests ship with behavior.
Strict Biome on touched files, no `var`, American English, every user-visible
string in all five l10n bundles (`l10n:check` at 100%) and `package.nls*.json`,
no new telemetry events or declarations (commands registered via
`commandManager.register()` use the existing `feature` event; the graph bridge
route is a plain `bridge.onMessage` like `openDiffTab` and `showReflog`,
emitting nothing). Do not bump versions or edit `CHANGELOG.md`, `README.md`,
or `NOTICE.md`; the integrator does. Report Sonar: integrator.

## Touch

`package.json` and `package.nls*.json` (menu contributions for `editor/title`,
`editor/context`, `explorer/context`, `scm/resourceState/context` for
`workingTree` and `index`, plus `git-graph-libre.contextMenuActionsVisibility`
schema property `commitDetailsViewFile.showBlame`, default `true`);
`src/contextMenuVisibility.ts` (add `commitDetailsViewFile.showBlame: true`);
`src/types.ts` (add `showBlame` to `CommitDetailsViewFileContextMenuActionsVisibility`
and new `RequestShowBlame` webview->host message);
`src/extension/commandManager.ts` (accept optional `vscode.Uri` or
`SourceControlResourceState` argument on `git-graph-libre.showBlame` so one
clean command handles Palette, Editor title/context, Explorer, and SCM);
`src/extension/messageHandler.ts` (handle `showBlame` from Commit Details,
validating known repository and safe path); `src/extension/webviewL10n.ts`
(label for Commit Details file menu item); `src/webview/main.ts` (add "Show
Blame at Commit" / "Show Blame Before Deletion" to `buildGitFileContextMenu`,
skipping binary files where `additions === null || deletions === null`);
`l10n/bundle.l10n*.json` (all five bundles); tests covering command argument
resolution (`Uri`, `SourceControlResourceState`, active editor), menu
visibility normalization (`tests/backend/contextMenuVisibility.test.ts` or
equivalent), `messageHandler` `showBlame` route, and `buildGitFileContextMenu`
visibility & deleted-file parent resolution; this slice file's Status and
Report.

## Task and acceptance

- **VS Code menus (`package.json` + `commandManager.ts`):**
  - `editor/title` (navigation/secondary icon button) and `editor/context`
    show `git-graph-libre.showBlame` when `resourceScheme == file` (never on
    untitled/output/virtual docs). Uses active cursor line as `targetLine`
    when the target matches the active editor.
  - `explorer/context` shows `git-graph-libre.showBlame` when
    `!explorerResourceIsFolder && resourceScheme == file`.
  - `scm/resourceState/context` shows `git-graph-libre.showBlame` for
    `scmProvider == git && (scmResourceGroup == workingTree || scmResourceGroup == index)`
    (omitted on `untracked`, where no blame history exists).
  - `git-graph-libre.showBlame` cleanly normalizes its first argument:
    `vscode.Uri`, `SourceControlResourceState` (`resourceUri`), or omitted
    (active text editor), resolving the repository via `findKnownRepoForPath`
    (longest root wins) with `resolveGitRoot` fallback.
- **Graph Commit Details file context menu:**
  - Adds `commitDetailsViewFile.showBlame` (default `true`) to
    `src/contextMenuVisibility.ts`, `src/types.ts`, and `package.json`.
  - In `buildGitFileContextMenu` (`src/webview/main.ts`), offers "Show Blame"
    for non-binary files (`fileChange.additions !== null && fileChange.deletions !== null`):
    - For added/modified/renamed files (`type !== "D"`): opens blame at the
      expanded commit's hash and `fileChange.newFilePath`.
    - For deleted files (`type === "D"`): if the commit has a parent, opens
      blame at `commitDetails.parents[0]` and `fileChange.oldFilePath`
      (labeled clearly, e.g. "Show Blame Before Deletion"); if no parent
      exists, omits the item using `undefined` (never `null`, so no stray
      divider appears).
    - Respects `this.isContextMenuActionVisible("commitDetailsViewFile", "showBlame")`.
- **Tests:**
  - Unit tests for `git-graph-libre.showBlame` called from all four VS Code
    surfaces (no arg / active editor with cursor line, Explorer `Uri`, SCM
    `SourceControlResourceState`, unknown non-Git file warning).
  - Context-menu visibility test confirming `commitDetailsViewFile.showBlame`
    defaults to `true` and can be toggled `false`.
  - Webview test for `buildGitFileContextMenu` (normal file, renamed file,
    deleted file with parent, binary file omitted, hidden by setting produces
    no stray divider).
  - `messageHandler` test confirming `showBlame` rejects unknown repositories
    and forwards valid requests without emitting unapproved telemetry.

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `node esbuild.js --production`,
relevant backend and webview `vitest` suites, `pnpm run l10n:check`, and
`node ./docs/kb/housekeeping.mjs --check`) and record each command and result.
Claim and changes are separate signed commits; never push.

## Report

- **Agent / date:** Gemini 4 Neon (agy), 2026-11-23 12:57
- **Branch and commits:** `blame/F4-07` —
  - `64201b3c G docs(blame): claim slice (F4-07)`
  - `0d33277c G feat(blame): wire VS Code context menus and target resolution (F4-07)`
  - `9f277159 G feat(blame): add Commit Details file blame menu and bridge route (F4-07)`
  - plus this report commit
- **Files changed:** (excluding this report commit, `git diff --stat 5971f0b4..9f277159`: 24 files, +678/−41):
  - `package.json` (+27/−1), `package.nls.json`, `package.nls.nl.json`, `package.nls.pl.json`, `package.nls.zh-cn.json`, `package.nls.zh-tw.json` (+2/−1 each)
  - `l10n/bundle.l10n.json`, `l10n/bundle.l10n.nl.json`, `l10n/bundle.l10n.pl.json`, `l10n/bundle.l10n.zh-cn.json`, `l10n/bundle.l10n.zh-tw.json` (+4/−1 each)
  - `src/contextMenuVisibility.ts` (+1), `src/types.ts` (+22/−10), `src/extension/commandManager.ts` (+57/−11), `src/extension/messageHandler.ts` (+67/−1), `src/extension/webviewL10n.ts` (+2), `src/webview/main.ts` (+55)
  - `tests/backend/manifest.test.ts` (+52/−1), `tests/webview/commandManager.test.ts` (+97), `tests/webview/contextMenuVisibility.test.ts` (+11), `tests/webview/contextMenuVisibilityRendering.test.ts` (+179), `tests/webview/diffTab/scmCommands.test.ts` (+3/−1), `tests/webview/messageHandler.test.ts` (+78/−1)
  - `docs/kb/050-ongoing-work/110-blame-view/160-f4-07-entry-points-and-menus.md` (Status and Report)
- **Tests added or changed:** +12 new tests across `tests/backend/manifest.test.ts` (+1), `tests/webview/commandManager.test.ts` (+5), `tests/webview/contextMenuVisibility.test.ts` (+1), `tests/webview/contextMenuVisibilityRendering.test.ts` (+3), `tests/webview/messageHandler.test.ts` (+2); 1 existing assertion in `tests/webview/diffTab/scmCommands.test.ts` scoped to `openDiffTab.*` entries. Full suite: backend 1,579 → 1,580 passed (60 skipped in linked worktree, expected); webview 1,210 → 1,221 passed.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings <23 touched code/json files>`: clean (0 errors, 0 warnings)
  - `pnpm run typecheck`: clean
  - `node esbuild.js --production`: clean
  - `pnpm run l10n:check`: 100.0% complete across `nl`, `pl`, `zh-cn`, `zh-tw` (`bundle.l10n.*.json`: 885 keys; `package.nls.*.json`: 135 keys)
  - `node ./docs/kb/housekeeping.mjs --check`: clean
  - `pnpm run test`: backend 118 files / 1,580 passed, 60 skipped; webview 92 files / 1,221 passed
  - Headless renders: not applicable (no CSS or Blame webview visual changes)
  - Sonar: integrator
- **Acceptance:**
  - **VS Code menus (`package.json` + `commandManager.ts`):** met — per the `2026-11-23` maintainer override, `editor/title` is intentionally omitted; `editor/context` (`resourceScheme == file`), `explorer/context` (`!explorerResourceIsFolder && resourceScheme == file`), and `scm/resourceState/context` (`scmProvider == git && (scmResourceGroup == workingTree || scmResourceGroup == index)`) are wired and verified in `tests/backend/manifest.test.ts`. `git-graph-libre.showBlame` normalizes `vscode.Uri`, `SourceControlResourceState` (`resourceUri`), or omitted (active editor), rejects non-`file` schemes, resolves the longest known repo with `resolveGitRoot` fallback, preserves the active cursor line only when the target matches the active editor, and reports `tab.blame` `ok: false` on early returns (verified in `tests/webview/commandManager.test.ts`).
  - **Graph Commit Details file context menu:** met — `commitDetailsViewFile.showBlame` (default `true`) added to `src/contextMenuVisibility.ts`, `src/types.ts`, and `package.json` schema (`tests/webview/contextMenuVisibility.test.ts`, `tests/backend/manifest.test.ts`). `buildGitFileContextMenu` in `src/webview/main.ts` adds "Show Blame at Commit" (modified/added/renamed, `newFilePath` at commit hash) and "Show Blame Before Deletion" (deleted files with parent, `oldFilePath` at `parents[0]`), omits binary files (`additions === null || deletions === null`), omits root deletions and hidden items via `undefined` (no stray divider), and honors `commitDetailsViewFile.showBlame` (`tests/webview/contextMenuVisibilityRendering.test.ts`).
  - **`messageHandler` `showBlame` route:** met — validates known repository and safe non-NUL repo-relative path, normalizes `"*"` / blank rev to `null`, forwards valid requests to `openBlameTab` without emitting unapproved telemetry, and reports `tab.blame` `ok: false` on refused requests without leaking paths (`tests/webview/messageHandler.test.ts`).
- **Deviations from the slice:**
  - **Maintainer override applied:** dropped `editor/title` per the `2026-11-23` maintainer instruction recorded at the top of this slice.
  - **Minimal test glue outside Touch:** updated `tests/webview/diffTab/scmCommands.test.ts` line 81 to count `git-graph-libre.openDiffTab.*` entries (6) rather than all `scm/resourceState/context` entries, since `git-graph-libre.showBlame` adds a 7th entry to that menu.
  - **Added `shortTitle` (`command.showBlame.shortTitle`)** on `git-graph-libre.showBlame` in `package.json` / `package.nls*.json` so Explorer and SCM context menus display "Show Blame" while the Command Palette keeps "Git Graph Libre: Show Blame for Current File".
  - **Translations:** `nl`, `pl`, `zh-cn`, and `zh-tw` strings (`command.showBlame.shortTitle`, `command.showBlame.fileNoRepo`, `action.showBlameAtCommit`, `action.showBlameBeforeDeletion`) were translated by the agent; a native speaker review would help.
- **Open questions / follow-ups:** None. Note for integrator: `l10n/bundle.l10n*.json` keys were appended at the end of the Blame block (after `command.showBlame.noRepo`), and `package.nls*.json` keys at the end (after `command.showBlame`), to keep rebase conflict resolution beside parallel F4-04 straightforward.
