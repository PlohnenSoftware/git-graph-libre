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

Status: done — awaiting integration
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

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 15:21
- **Branch and commits:** `wt-1.10.0/W22F`
  - `af09b04 G docs(worktrees): claim W22F, path setting, browse and persisted finish (W22F)`
  - `bcd8547 G feat(worktrees): folder template for a new worktree's default folder (W22F)`
  - `b4ecfb9 G feat(worktrees): Browse button for the Create Worktree folder (W22F)`
  - `03666a9 G feat(worktrees): remember the finish choice in the view state (W22F)`
  - `b2412d4 G style(worktrees): lay the Browse button beside the folder field (W22F)`
  - `efe30a8 G docs(worktrees): changelog for the worktree folder template and Browse (W22F)`
  - `7664012 G test(worktrees): give the consent-screen config mock the folder template (W22F)`
  - `9bbff34 G test(worktrees): the folder template names the folder at every entry point (W22F)`
  - plus the signed commit carrying this report.
- **Files changed** (`git diff --numstat b783f62..HEAD`, 29 files, +546/−36 in total):
  - source: `src/webview/main.ts` +129/−25, `src/types.ts` +18/−2, `src/extension/messageHandler.ts` +24/−4, `src/config.ts` +11, `src/webview/global.d.ts` +10, `src/extension/webviewHtml.ts` +1, `src/extension/webviewL10n.ts` +1;
  - manifest and text: `package.json` +5, five `package.nls*.json` +2 each, five `l10n/bundle.l10n*.json` +3 each, `README.md` +1, `CHANGELOG.md` +4/−1;
  - style: `media/dialogs.css` +15 (outside *Touch*, see Deviations);
  - tests: `tests/webview/createWorktreeDialog.test.ts` +253/−3, `tests/backend/config.test.ts` +20, `tests/backend/manifest.test.ts` +13, `tests/webview/worktreeHandlers.test.ts` +12, `tests/webview/graph.test.ts` +1, `tests/webview/telemetryConsentScreen.test.ts` +1, `tests/webview/webviewHtml.test.ts` +1;
  - this slice file: the claim and this report.
  - Outside tests and l10n the change is about 261 lines (src 225, manifest and nls 15, CSS 15, README and CHANGELOG 6), over the ~200 guide. Not split.
- **Tests added or changed:** new cases, 19 in total: backend 2 (`config.test.ts`: the template setting, trimmed or the default; `manifest.test.ts`: the contributed setting); webview 17 (`createWorktreeDialog.test.ts` 16: the template resolution (7 unit cases), the setting reaching the dialog and a changed setting reaching the next dialog, a stale non-text value, the template at the remote-branch, commit and tag entry points (3), the Browse button (3), the finish choice across a reload and for an older state (1); `worktreeHandlers.test.ts` 1: the picker's reply, picked and cancelled). Changed fixtures only, no assertion changed: `graph.test.ts`, `webviewHtml.test.ts`, `telemetryConsentScreen.test.ts` (a config mock gained the accessor). Counts, derived by subtracting the new cases from the final run: backend 1344 → 1346 passed (60 skipped, unchanged); webview 954 → 971 passed.
- **Gates:**
  - strict Biome (`pnpm exec biome check --config-path biome.strict.jsonc --error-on-warnings`) on each of the 25 touched `.ts` and `.json` files: clean, exit 0. Run one file at a time: a single multi-file call in this linked worktree failed with Biome's internal `No such file or directory` error and checked nothing. The strict config also reports a `$schema` version warning (2.5.13 against CLI 2.6.3); that config is not in *Touch*, so it is left as found.
  - `pnpm run typecheck`: exit 0 (src, webview and tests projects).
  - `pnpm run test`: backend 108 files, 1346 passed, 60 skipped; webview 76 files, 971 passed; no "Unhandled Errors". The one failing run during the slice (four consent-screen cases, the mock gap) is fixed in `7664012`.
  - `pnpm run l10n:check`: all translations complete, 100% in every language.
  - `pnpm run kb:check`: exit 0.
  - Engine: this slice touches no `engine/**`. The binary `engine/native/linux-x64/git-graph.node` was built `2026-11-06 15:06`, after W01's report (`be1d870`, `2026-11-05`); it was not rebuilt here.
  - Headless render: PyQt6 WebEngine under `xvfb-run`, with the real `media/*.css` in the webview's order and the dialog markup from the dialog's own DOM. Dark and Light, approximate VS Code theme values (not the exact Dark Modern and Light Modern token set). Images: `/tmp/claude-1000/-home-zam-Desktop-prog--GGL-git-graph-libre/be663259-3928-4d62-8ef9-42437fe949b6/scratchpad/folder-row-dark.png` and `.../folder-row-light.png`. Both inspected: the folder field and Browse on one row, aligned, the field taking the room the button leaves; the action row intact.
  - Sonar: integrator.
- **Acceptance:**
  - With no setting, the dialog's folder is W22's Y7 (a) default: met. The `defaultWorktreePath` and "pre-fills the Y7 folder" cases pass with no template.
  - A template with `${repo}` and `${branch}` gives that folder at each entry point (branch, remote branch, commit, tag): met. Cases in `createWorktreeDialog.test.ts`. A changed setting reaches the next dialog without a reload: met, as the raw settings-hub echo in the webview test. Not checked inside VS Code itself.
  - Browse fills the field with the picked folder; cancel changes nothing: met. The picked folder is what `addWorktree` receives; cancel and a stale answer leave the field alone.
  - The finish choice offered first is the last one used, across a panel reload: met. Saved in the view state on each pick; a saved state without the field opens on the first choice.
  - All five languages localized, `l10n:check` complete: met. The Dutch, Polish, zh-CN and zh-TW strings for the new keys are this agent's own translations and need a native review.
  - The dialog rendered headlessly in both themes and inspected: met, with the approximate theme values stated above.
- **Deviations from the slice:**
  - **File outside *Touch*, flagged in its own commit:** `media/dialogs.css` (`b2412d4`, 15 lines). The slice names no stylesheet, and the field and its button cannot share a row without one. The button reuses the existing `dialogBtn` class.
  - **Picker types in `src/types.ts`, not `src/backend/types/**`.** The picker is an extension-host dialog, not a git query or action, so its request and response pair sits beside `resolveRef`'s in `src/types.ts` (in *Touch*). The picker is `pickFolder` in `messageHandler.ts`, shared with the repair dialog's picker; `commandManager.ts` is untouched.
  - **Template rules where the slice was silent:** a relative template is taken from the repository's parent folder, so `${repo}.worktrees/${branch}` is the Y7 default; an absolute template is used as written; `.` and `..` segments are resolved so the dialog shows the final path; a branch name with `/` stays a nested folder, as W22 does. The setting's default is the empty string, which means the Y7 default; no manifest `pattern` is set (validation is in code). The setting is trimmed, and a non-text value is the default.
  - **Placeholders:** the slice's step 1 says an unknown `${...}` is left as written, and the validation line says only the two placeholders are valid. Implemented as step 1 says: only `${repo}` and `${branch}` are filled in, and any other `${...}` stays in the folder, which the dialog then shows. See Open questions.
  - **Optional view-state field:** `worktreePathTemplate` and `worktreeFinish` are optional in their types, as `stashDisplay` is, so the many view-state fixtures need no change.
  - **Finish memory** is saved in the view state on each pick (`saveState`), not in `globalState`, as the slice asks. The panel's reload and the view state cover it.
- **Open questions / follow-ups:**
  - The Browse picker opens VS Code's default location, because the request carries no repository path. Starting it at the repository's parent folder needs the path in the request, a one-field change within *Touch*.
  - Unknown placeholders are left in the folder, shown in the dialog, and not flagged. The maintainer may want a warning in the dialog for them.
  - Translations of the new strings (nl, pl, zh-cn, zh-tw) need a native review.
  - The strict Biome config's `$schema` (2.5.13) differs from the installed CLI (2.6.3); the multi-file Biome call fails in a linked worktree. This slice changes no Biome config, so neither comes from it; the integrator may want to check the multi-file call in the main checkout.
