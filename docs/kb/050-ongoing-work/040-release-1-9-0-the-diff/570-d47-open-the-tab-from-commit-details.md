---
summary: >-
  D47 · wave D · needs D45 · webview + TypeScript · ≤200 lines: "Open in
  GGL Diff" in the commit-details file context menu, beside "View Diff",
  with a visibility switch in `contextMenuActionsVisibility`. It opens the
  same two revisions `viewDiff` would, and falls back to `vscode.diff`
  when the tab isn't available.
---

# D47 — Open the tab from commit details

Status: waiting on D45
Needs: D45
Decisions: Phase 17 D4 (answered: G4, option (c))
Kind: webview and TypeScript · Size budget: ≤ 200 changed lines outside tests
Source: Phase 17, "A GGL Diff tab, measured" ("opened from commit details")

## Goal

Every file in commit details, and in a comparison, can open in the GGL
Diff tab. What a plain click on a file does stays unchanged.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D45's slice file and report
- `src/webview/main.ts`: the commit-details file context menu (about line
  6015, where "View Diff" is pushed) and `viewGitFileDiff` (about line
  6100)
- `src/extension/messageHandler.ts`: `ViewDiffInput` and `viewDiff`
  (about line 85)
- "Settings reach the webview twice, and the second time is raw" under
  Reference: the new visibility switch must be handled at both ends

## Steps

1. **The menu item.** In the file context menu, after "View Diff", add
   "Open in GGL Diff" when
   `isContextMenuActionVisible("commitDetailsViewFile", "openDiffTab")`.
   It posts `{ command: "openDiffTab", …the same fields as viewDiff }`.
2. **The visibility switch.** Add `openDiffTab` (default `true`) to the
   `commitDetailsViewFile` group of the
   `git-graph-libre.contextMenuActionsVisibility` setting, both in its
   `package.json` schema and wherever the group's keys are validated, per
   the "twice" record.
3. **The message.** Add the `openDiffTab` request and response types next
   to `viewDiff`'s in `src/types.ts`. Register the handler beside
   `viewDiff`.
   - Build two `revision` sides with `viewDiff`'s rules: the old side is
     `oldRef`, or else `<hash>^`; the new side is `newRef`, or else
     `<hash>`. An added file's left side is `empty`; a deleted file's
     right side is `empty`. Use the same title `viewDiff` builds.
   - When `git-graph-libre.diffTabAvailable` is false, call `viewDiff`
     instead and say so in the log.
4. **Strings:** the menu title and the setting's description in all five
   bundles.

## Touch

`src/webview/main.ts`, `src/types.ts`, `src/extension/messageHandler.ts`,
`src/extension/webviewL10n.ts`, `package.json` (the visibility schema),
`package.nls*.json` (five), `l10n/bundle.l10n*.json` (five), the
visibility setting's validation file, and their tests:
`tests/webview/commitDetailsListMode.test.ts` (or whichever already asserts
`viewDiff` messages), `tests/webview/messageHandler.test.ts` and
`tests/webview/contextMenuVisibility.test.ts`

## Tests

- The menu item is shown, and hidden by the visibility switch.
- Its message carries the same refs `viewDiff`'s does, including D03's
  `<hash>^3` for a stashed untracked file.
- The handler builds the expected request for modified, added and deleted
  files.
- It falls back to `viewDiff` when the tab isn't available.

## Acceptance

- Gates pass, `l10n:check` at 100% included.
- A plain click on a file still opens `vscode.diff`.

## Report

_(not started)_
