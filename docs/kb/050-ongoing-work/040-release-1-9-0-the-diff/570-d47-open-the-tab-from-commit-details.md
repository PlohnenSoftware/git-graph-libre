---
summary: >-
  D47 · wave D · needs D45 · webview + TypeScript · ≤200 lines: "Open in
  GGL Diff" in the commit-details file context menu, beside "View Diff",
  with a visibility switch in `contextMenuActionsVisibility`. It opens the
  same two revisions `viewDiff` would, and falls back to `vscode.diff`
  when the tab isn't available.
---

# D47 — Open the tab from commit details

Status: integrated 366d4da
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

- **Agent / date:** Muse Code (muse-wonder-full-1.0, general-purpose, inherited runtime model; no named-model selector in this runtime — the integrator records it), 2026-10-19 16:47 Europe/Warsaw.
- **Branch and commits:** `diff-1.9.0/d47` from `f34a88e`, all `G`, no push — `f8fdaa3 G docs(release): claim D47 (D47)`; `c89e637 G feat(diff-tab): add the openDiffTab visibility switch (D47)`; `0df8823 G feat(diff-tab): add the openDiffTab message types (D47)`; `f4f2818 G feat(diff-tab): open the tab from commit details, with fallback (D47)`; `f171740 G feat(diff-tab): Open in GGL Diff in the file context menu (D47)`; `2abd27c G test(diff-tab): cover the commit-details tab handler and fallback (D47)`; `0f0d9c3 G test(diff-tab): cover the menu item, its switch and its messages (D47)`; `cd97e2e G refactor(webview): keep the file menu builder under complexity 16 (D47)`; plus the signed report commit carrying this section.
- **Files changed:** `src/extension/messageHandler.ts` (+143/−14: the `openDiffTab` handler beside `viewDiff`, the shared `diffTitleFor`, `buildCommitDetailsDiffRequest` and its side builders, two injectable deps), `src/webview/main.ts` (+32/−11: the menu item via `pushFileDiffItems`, one shared `sendFileDiffMessage`, the response handler), `src/types.ts` (+18/−0: the visibility key, `RequestOpenDiffTab`/`ResponseOpenDiffTab` and both unions), `src/contextMenuVisibility.ts` (+1), `src/extension/webviewL10n.ts` (+1), five `l10n/bundle.l10n*.json` (+1 each), `tests/webview/messageHandler.test.ts` (+239/−3), `tests/webview/commitDetailsListMode.test.ts` (+115/−0), `tests/webview/contextMenuVisibilityRendering.test.ts` (+85/−0), `tests/webview/contextMenuVisibility.test.ts` (+12/−0), this slice file (claim, status, report). Changed lines outside tests and this file: 225 (+200/−25) against the ~200 guide.
- **Tests added or changed:** webview 738 → 746 (+8 cases; the stash case in `commitDetailsListMode.test.ts` was extended in place). `messageHandler.test.ts` +3 (whole-request assertions for modified, added, deleted, renamed and type-change files, comparison labels as refs, the stash `^`/`^3` pair and titles identical to `viewDiff`'s; both `"*"` directions with the missing-on-disk side empty; the unavailable fallback's log line with `viewDiff` itself running, `vscode.open` included for a working-tree deletion); `commitDetailsListMode.test.ts` +2 and the extended stash case (item immediately after "View File Diff", `openDiffTab` carrying `viewDiff`'s exact fields, plain click still `viewDiff`, binary null-counts offering neither diff); `contextMenuVisibilityRendering.test.ts` +2 (`"*"` message from a working-tree comparison; the switch hiding only the new item); `contextMenuVisibility.test.ts` +1 (default visible, `false` honored, default surviving the raw `{}` echo). Backend count unchanged.
- **Gates:** biome strict clean (`biome check --config-path biome.strict.jsonc --error-on-warnings` on all 14 touched code, test and JSON files); typecheck pass (all three projects); full `pnpm run test` with the addon built (`engine:build` + `engine:smoke` OK at 1.0.26): backend 1046 passed, 60 skipped of 1106 (the pre-existing conditional `skipIf` suites on this base), webview 746/746, re-run after the complexity refactor; `pnpm run l10n:check` 100% (bundle and package, all four translations genuinely translated, worded as D46's `command.openDiffTab` per locale); `pnpm run kb:check` pass; `pnpm run package` pass (`biome lint .` 316 files; `out/diffTab.min.js` still 8,388 bytes); Rust arm n/a (no `engine/**` change); Sonar: integrator. Cognitive complexity by hand: `diffTitleFor` about 5, the side builders and `openCommitDetailsDiffTab` at most 3 each, `pushFileDiffItems` about 4, `buildGitFileContextMenu` about 12 after the extraction, `sendFileDiffMessage` about 10 (the former `viewGitFileDiff` body, unchanged) — all under 16; no nested ternary added.
- **Acceptance:** "Gates pass, `l10n:check` at 100% included" — met, numbers above. "A plain click on a file still opens `vscode.diff`" — met: the click listener still calls `viewGitFileDiff`, asserted in `commitDetailsListMode.test.ts` alongside the new menu case. Every item under *Tests* is covered as listed there, including D03's `<hash>^3` message and the unavailable fallback. No CSS or other visual surface changed (one text item in the existing menu, rendered by the existing code), so no headless render was needed and the acceptance asks for none; the jsdom rendering suites cover presence, order and hiding. Manual check in a real editor: maintainer (no display in this session; no real VS Code window opened, per the dispatch).
- **Deviations from the slice:** (1) **`package.json` and `package.nls*.json` untouched, although *Touch* lists them:** the visibility schema admits any boolean key per group (`additionalProperties: { type: boolean }`), the setting's description is already generic ("Set known group/action booleans…"), and D46 already shipped `command.openDiffTab` in all five `package.nls` files. The effective schema change is the key in the shared type and default map; both delivery ends run `normalizeContextMenuActionsVisibility` over that map (boot via `config.ts`, raw settings-hub echo via `applyStructuredExtensionSetting` in `main.ts`), so the "twice" rule is met with no second edit. (2) **No hoist of D46's `extension.ts` assembly:** `extension.ts` and any new shared file are outside *Touch*, so the opening route repeats D46's assembly from `messageHandler`'s live deps (`config.gitPath`/`backend`, `repoSearch.isVerified`, `extensionPath`, `outputChannel`), documented on the deps; both halves (`openDiffTab`, `isDiffTabAvailable`) are injectable, which is also how the tests capture requests. Hoisting the two assemblies into one place is a natural integrator-or-later cleanup. (3) **Step 3's "two `revision` sides" generalized by `viewDiff`'s own `"*"` resolution:** a `"*"` ref becomes the tab's `workingTree` side on its own side of the pair (a `revision` side with ref `"*"` would read nothing), and the added/deleted empty-side rule applies whichever kind the other side is, so the file `viewWorktreeDiff` finds missing on disk is the empty side. Labels still ride as refs exactly as `viewDiff` receives them (D13), and the title is the one shared `diffTitleFor`. (4) **Binary files:** the item sits under the same null-counts gate as "View Diff" and the plain click (`gitDiffPossible`), so a binary file offers neither diff, as today; content the counts call text but a side reads as binary still reaches the tab's binary payload through D45's source — no handler case. (5) The failure toast reuses `unableToViewDiff`; no new error string. (6) `tests/webview/contextMenuVisibilityRendering.test.ts` was used alongside the named `contextMenuVisibility.test.ts`, because the menu DOM cases live there (test files are always allowed). No dependencies, suppressions or gate changes.
- **Open questions / follow-ups:** none blocking. What D48 inherits: a commit-details open produces the same one `operation=diffTab` route line and `[diffTab] painted` line as the Source Control path, with the title `viewDiff` would show; nothing details-specific is logged beyond the fallback line `[diffTab] unavailable; falling back to vscode.diff` when D45's `isDiffTabAvailable({ backend: config.backend })` is false (that open then goes through `viewDiff` itself, working-tree rules included, so D48's editor-side numbers can be taken from the same menu on the `git-cli` backend). `buildCommitDetailsDiffRequest` is exported from `messageHandler.ts` if another surface ever needs the same side resolution. The remaining duplication worth an integrator's eye is deviation (2): two assemblies of panel-plus-engine-source, one in `extension.ts` (SCM) and one in `messageHandler.ts` (commit details).
