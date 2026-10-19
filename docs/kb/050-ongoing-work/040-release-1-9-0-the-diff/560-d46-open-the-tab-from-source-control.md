---
summary: >-
  D46 · wave D · needs D45 · manifest + TypeScript · ≤200 lines: an "Open
  in GGL Diff" icon on each changed, staged and untracked file in VS Code's
  Source Control view, and in its right-click menu. One hidden command per
  resource group, because the command isn't told the group; shown only
  while `git-graph-libre.diffTabAvailable` is true.
---

# D46 — Open the tab from Source Control

Status: ready
Needs: D45
Decisions: Phase 17 D4 (answered: G4, option (c))
Kind: `package.json` and TypeScript · Size budget: ≤ 200 changed lines outside tests
Source: the maintainer's request (`2026-10-19`); Phase 17, "A GGL Diff tab, measured" ("Opening it from Source Control")

## Goal

Hovering a file in the Source Control view shows an icon that opens it in
the GGL Diff tab, next to the Git extension's own icons.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D45's slice file and report
- "Future direction: integrate with VS Code's native source control" under
  Future work (the `scm/*` contribution points)
- `src/extension/commandManager.ts`: `register` (the telemetry chokepoint)
  and `findKnownRepoForPath`
- `package.json`: the existing `scm/title` entry, `contributes.commands`,
  and the `package.nls*.json` titles

## Facts (checked `2026-10-19` in VS Code Insiders `1.143.0`)

- The Git extension's resource groups are `merge`, `index`, `workingTree`
  and `untracked`.
- It contributes its per-file icons to `scm/resourceState/context` with
  `"group": "inline"`. Its `scm/resourceState/inline` list is empty.
- The command receives the clicked `SourceControlResourceState` first and
  the whole selection as an array second. Its public part is
  `resourceUri`; nothing says which group it came from, hence one command
  per group.
- The existing `scm/title` entry opens the graph. Leave it as it is.

## Steps

1. **`package.json`:**
   - three commands, `git-graph-libre.openDiffTab.workingTree`,
     `git-graph-libre.openDiffTab.index` and
     `git-graph-libre.openDiffTab.untracked`, each with title
     `%command.openDiffTab%`, icon `$(diff)` and the usual category;
   - under `scm/resourceState/context`, for each command:
     `{ "command": …, "group": "inline", "when": "scmProvider == git &&
     scmResourceGroup == <group> && git-graph-libre.diffTabAvailable" }`,
     and the same with `"group": "navigation"` for the right-click menu;
   - under `commandPalette`: each command with `"when": "false"`.
2. **Titles:** `command.openDiffTab` ("Open in GGL Diff") in all five
   `package.nls*.json` files.
3. **The handler.** Create `src/extension/diffTab/scmCommands.ts` and
   register its three handlers through `commandManager.register`.
   - Find the repository holding `resourceUri.fsPath` among the known
     repositories, as `findKnownRepoForPath` does. If none holds it, show
     a localized warning.
   - Build the request:
     - `workingTree`: left `index`, right `workingTree`;
     - `index`: left `revision` `HEAD`, right `index`;
     - `untracked`: left `empty`, right `workingTree`.
   - The title is `<file name> (<left> ↔ <right>)`. The left and right are
     `HEAD`, a localized "Index", or the existing `diff.workingTree`
     string.
   - With several files selected, open only the clicked one.
   - Call D44's `openDiffTab` with D45's source.

## Touch

`package.json`, `package.nls*.json` (five), `src/extension/diffTab/scmCommands.ts`
(new), `src/extension/commandManager.ts` (registration only),
`l10n/bundle.l10n*.json` (five, for the warning and "Index"),
`tests/webview/diffTab/scmCommands.test.ts` (new),
`tests/webview/commandManager.test.ts`

## Tests

- **Manifest:**
  - the three commands exist;
  - each has one `inline` and one `navigation` entry with exactly the
    `when` above;
  - each is hidden from the palette.
- **Handler:**
  - each group builds the expected request and title;
  - an unknown repository warns;
  - the handlers go through `register`, so the existing telemetry wrapper
    reports them.

## Acceptance

- Gates pass, `l10n:check` at 100% included.
- Manually, in an Extension Development Host with a built engine, the
  icon appears on hover on a changed, a staged and an untracked file, and
  opens the tab. On the `git-cli` backend it doesn't appear. Say in the
  report who checked it; if you can't run a display, write "manual check:
  maintainer".

## Report

_(not started)_
