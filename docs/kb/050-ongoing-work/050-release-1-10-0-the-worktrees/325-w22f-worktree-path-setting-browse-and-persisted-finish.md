---
summary: >-
  W22F · wave D · needs W22 · TypeScript + webview + manifest + l10n ·
  ~200 lines: the parts of decisions Y7 and Y8 that W22's Touch list could
  not carry. A path-template setting for the new-worktree default folder
  (`${repo}` and `${branch}`), a folder-picker browse button in the Create
  Worktree dialog, and the finish choice remembered in the persisted view
  state instead of for the panel's life only.
---

# W22F — Worktree path setting, browse, and persisted finish choice

Status: claimed by Claude Haiku 5.5 on 2026-11-06 15:10
Needs: W22 (integrated `63cdd97`)
Decisions: Y7 (a) with (d) and Y8 (a), answered `2026-11-05`
Kind: TypeScript, webview, manifest and l10n · Size budget: ~200 changed
lines outside tests
Source: W22's report (its deviations: no Y7 (d) setting, no browse button,
panel-lifetime Y8 memory); Settings reach the webview twice, and the
second time is raw (Reference)

## Goal

W22 ships the Y7 (a) default, `<parent>/<repo>.worktrees/<branch>`, as an
editable text field, and remembers the Y8 finish choice only while the
panel lives. Y7 also promised the default as a setting with `${repo}`
and `${branch}`, the slice's step 3 a browse button, and Y8's memory has
no reason to die with the panel. This slice adds those three, with the
file list W22 did not have.

## Steps

1. A string setting for the default folder template, wired everywhere a
   setting goes (manifest and its five `package.nls*` texts, the
   `src/config.ts` accessor, the boot config, both type files, the raw
   settings-hub echo in the webview, the README table). Empty means the
   Y7 (a) default. `${repo}` is the repository folder name, `${branch}`
   the branch the dialog starts from; an unknown `${...}` is left as
   written, and the dialog still shows the resolved folder, editable.
2. A browse button beside the folder field: a new request/response pair
   and a `DialogInput` kind, answered with VS Code's folder picker;
   cancelling the picker leaves the field as it was.
3. The Y8 last finish choice moves into the persisted view state, so it
   survives a panel reload; existing saved states without the field read
   as no memory.

## Touch

`package.json`, `package.nls*.json`, `README.md`, `src/config.ts`,
`src/types.ts`, `src/webview/global.d.ts`, `src/extension/webviewHtml.ts`,
`src/extension/messageHandler.ts`, `src/extension/commandManager.ts`
(the folder picker), `src/backend/types/**` (the picker request/response),
`src/webview/main.ts`, `src/extension/webviewL10n.ts`, the five
`l10n/bundle.l10n*.json`, `CHANGELOG.md`, `tests/**`

## Acceptance

- With no setting, the dialog's folder is exactly W22's Y7 (a) default.
- A template with `${repo}` and `${branch}` produces that folder for
  each entry point (branch, remote branch, commit, tag); changing the
  setting in the Settings popup reaches the next dialog without a reload.
- Browse fills the field with the picked folder; cancel changes nothing.
- The finish choice offered first is the last one used, across a panel
  reload.
- All five languages localized (`l10n:check` complete); the dialog is
  rendered headlessly in both themes and inspected.

## Report

Not started.
