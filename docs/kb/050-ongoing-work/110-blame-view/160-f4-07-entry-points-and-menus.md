---
summary: >-
  F4-07: Wire every natural entry point for the Blame view — Editor title bar
  and editor context menu, Explorer file context menu, Source Control resource
  context menu, and the Graph's Commit Details file context menu (with
  `commitDetailsViewFile.showBlame` visibility setting and deleted-file parent
  blame).
---

# F4-07 — Editor, Explorer, SCM and Commit Details entry points

Status: ready (pulled forward by the integrator, `2026-11-23`)

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

Not started.
