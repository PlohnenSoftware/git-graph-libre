---
summary: >-
  Standing rule: boot reads validated `config` accessors but settings-hub
  echoes apply raw values, so change both ends; the `b225076` context-menu
  crash fix; the `onDidChangeConfiguration` whitelist; `pnpm run test` does
  not typecheck.
---

# Settings reach the webview twice, and the second time is raw (`2026-09-05`)

A setting arrives in the webview by two different routes, and they do not agree
on what they hand over. Getting this wrong shipped a crash that made the graph
look broken (fixed in `b225076`).

- **At boot**, `buildWebviewHtml()` fills `GitGraphViewState` from the `config`
  accessors in `src/config.ts`, and several of those **validate or complete**
  the stored value: `contextMenuActionsVisibility()` runs
  `normalizeContextMenuActionsVisibility()`, `graphColors()` filters with
  `isGraphColor`, `shortHashLength()` clamps, `revealHighlightColor()` falls
  back on an unparseable color.
- **Afterwards**, every settings-hub write echoes the *whole* manifest-derived
  list back through `updateExtensionSetting` (and `importExtensionSettings`),
  and `applyExtensionSettings()` re-applies **every entry**, not just the one
  that changed. Each entry carries `config.get(configKey, manifestDefault)` —
  the raw stored value, with none of that validation.

So any accessor that does more than `getConfig()` has a counterpart obligation
in `applyBooleanExtensionSetting` / `applyNumberExtensionSetting` /
`applyStringExtensionSetting` / `applyStructuredExtensionSetting`. **When you
add or change a validating accessor, change both ends.**

The bug this cost: `applyStructuredExtensionSetting()` assigned the raw
`contextMenuActionsVisibility` behind an `as GGL.ContextMenuActionsVisibility`
cast. The stored value is the manifest default `{}` until a user customizes it,
so changing *any* setting in the hub replaced the complete visibility map with
an empty object, and `isContextMenuActionVisible()` — which reads
`visibility[group][action]` — threw
`TypeError: Cannot read properties of undefined` for every group. Every
right-click in the graph then did nothing until the view was reloaded. The
`as` cast was the whole bug: it promised a complete map and delivered `{}`.
Regression test: `tests/webview/extensionSettingsContextMenu.test.ts`, written
as a failing test against untouched `main` first.

Two divergences of the same shape are still open, neither of which crashes, so
they are left for a slice that touches them:

- `graphColors`: the host filters with `isGraphColor`, the webview keeps any
  string.
- `shortHashLength`: the host clamps to the manifest bounds, the webview
  assigns the number as given. Hub writes are clamped by
  `sanitizeSettingValue`, so only a hand-edited `settings.json` reaches this.

Two things worth knowing when a setting "does nothing":

- **`vscode.workspace.onDidChangeConfiguration` in `src/extension.ts` is a
  whitelist**, not a catch-all — it reacts only to `showStatusBarItem`,
  `maxDepthOfRepoSearch`, `telemetry.enabled` and `git.path`. Every other
  `git-graph-libre.*` key reaches an open graph **only** through the settings
  hub's echo, or on the next window/graph open. Editing one in VS Code's own
  settings UI does not update a graph that is already open.
- **`pnpm run test` does not typecheck.** Vitest transpiles, so a shared type
  change that breaks a fixture or a typed mock passes `test` and fails
  `package`. Run `typecheck` before believing a green vitest run.
