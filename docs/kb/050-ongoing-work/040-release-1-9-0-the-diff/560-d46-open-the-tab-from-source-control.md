---
summary: >-
  D46 · wave D · needs D45 · manifest + TypeScript · ≤200 lines: an "Open
  in GGL Diff" icon on each changed, staged and untracked file in VS Code's
  Source Control view, and in its right-click menu. One hidden command per
  resource group, because the command isn't told the group; shown only
  while `git-graph-libre.diffTabAvailable` is true.
---

# D46 — Open the tab from Source Control

Status: done — awaiting integration
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

- **Agent / date:** Muse Code (muse-wonder-full-1.0, general-purpose, inherited runtime model; no named-model selector in this runtime — the integrator records it), 2026-10-19 16:31 Europe/Warsaw.
- **Branch and commits:** `diff-1.9.0/d46` from `5b61d7f`, all `G`, no push — `543c4f9 G docs(release): claim D46 (D46)`; `01695c7 G feat(diff-tab): open the tab from Source Control (D46)`; `97b686d G test(diff-tab): cover the Source Control commands and manifest (D46)`; plus the signed report commit carrying this section.
- **Files changed:** `src/extension/diffTab/scmCommands.ts` (new, +119/−0), `src/extension/commandManager.ts` (+11/−0: one optional dep and registration through `register`), `src/extension.ts` (+14/−2, see Deviations), `package.json` (+64/−0), five `package.nls*.json` (+1 each), five `l10n/bundle.l10n*.json` (+4/−1 each), `tests/webview/diffTab/scmCommands.test.ts` (new, +173/−0), `tests/webview/commandManager.test.ts` (+33/−2), this slice file (claim, status, report). Changed lines outside tests and this file: 240 (+234/−6) against the ~200 guide (64 are the manifest entries, 25 the mandated bundles).
- **Tests added or changed:** `tests/webview/diffTab/scmCommands.test.ts`, 11 tests (manifest commands, inline+navigation entries with exactly the specified `when`, palette-hidden, English nls title; per-group request and title; longest-holder repository, clicked-only opening with a multi-selection, unknown-repository warning, no-path no-op), and `tests/webview/commandManager.test.ts` +1 (the SCM command opens through `register`, telemetry wrapper included; both registered-command lists gain the three ids). Webview 726 → 738; backend unchanged in count of tests added.
- **Gates:** biome strict clean (`biome check --config-path biome.strict.jsonc --error-on-warnings` on all 16 touched code, test and JSON files); typecheck pass (all three projects); focused suites 27/27; full `pnpm run test` with the addon built (`engine:build` + `engine:smoke` OK at 1.0.26): backend 1046 passed, 60 skipped of 1106 (the conditional `skipIf` suites, pre-existing on this base and untouched by D46), webview 738/738; `pnpm run l10n:check` 100% (bundle and package keys in all four translations, genuinely translated, not English copies); `pnpm run kb:check` pass; `pnpm run package` pass (`out/diffTab.min.js` still 8,388 bytes; `out/extension.js` carries the new commands) and `vsce ls --no-dependencies` lists `package.json` and `out/diffTab.min.js` as before; Rust arm n/a (no `engine/**` change); Sonar: integrator. Cognitive complexity by hand: highest new function `openFromSourceControl` at about 4, the rest at most 3 — well under 16; no nested ternary.
- **Acceptance:** "Gates pass, `l10n:check` at 100% included" — met, numbers above. Every item under *Tests* is covered as listed. The three commands are `git-graph-libre.openDiffTab.workingTree` (index ↔ working tree), `.index` (HEAD ↔ index) and `.untracked` (empty ↔ working tree), each `$(diff)`, title `%command.openDiffTab%` ("Open in GGL Diff" in all five `package.nls*.json`), one `inline` and one `navigation` entry under `scm/resourceState/context` with `scmProvider == git && scmResourceGroup == <group> && git-graph-libre.diffTabAvailable`, and `when: "false"` in the palette; the existing `scm/title` entry is untouched. Titles are `<file name> (<left> ↔ <right>)` with `HEAD`, localized `diff.index` and the existing `diff.workingTree`. Manual check: maintainer (no display in this session; no real VS Code window opened, per the dispatch).
- **Deviations from the slice:** (1) **`src/extension.ts` touched (+14/−2), outside *Touch* — needs integrator acceptance.** The slice's own wiring cannot be completed from `commandManager.ts` alone: D44's `openDiffTab` needs `extensionPath`, and D45's source needs the live `isVerified` from `repoSearch`, and both exist only in `activate()`. The dispatch explicitly required live deps over the fail-closed defaults, so `extension.ts` passes one `openScmDiffTab` callback that opens the tab with `createEngineDiffTabSource({ gitPath: config.gitPath, backend: config.backend, isVerified: (repo) => repoSearch.isVerified(repo) })`; `commandManager.ts` gained only that optional dep plus the registration loop, as specified. (2) **One extra l10n key, `diff.empty` ("Empty")**, in all five bundles: the title spec lists labels for HEAD, Index and the working tree but none for the untracked command's empty left side, so the title reads `<file> (Empty ↔ Working Tree)` rather than leaving a blank side. (3) `findKnownRepoForPath`'s longest-holder rule is duplicated in small in `scmCommands.ts` (commented), as D45 did for `resolveRepoFilePath`, since importing it from `commandManager.ts` would be circular. (4) A resource with no usable `fsPath` is a silent no-op; the localized warning (`command.openDiffTab.noRepo`) is only for a real path no known repository holds. No dependencies, suppressions or gate changes.
- **Open questions / follow-ups:** the `extension.ts` deviation above. What D47 inherits: the same opening route — `openDiffTab(request, createEngineDiffTabSource({ gitPath: config.gitPath, backend: config.backend, isVerified: (repo) => repoSearch.isVerified(repo) }), { extensionPath, outputChannel })` — currently assembled inside the `openScmDiffTab` callback in `extension.ts`; D47 (which works from `messageHandler`) will likely want that assembly hoisted into one shared place, plus `isDiffTabAvailable({ backend: config.backend })` from D45 for its fallback decision. `buildScmDiffRequest(group, repo, relativePath)` in `scmCommands.ts` is the per-group side map if commit details ever needs the same pairs. For D48: the SCM path produces the same `operation=diffTab` route line and `[diffTab] painted` line as any other open; nothing SCM-specific is logged. The `merge` resource group deliberately has no command (no pair of sides in the slice).
