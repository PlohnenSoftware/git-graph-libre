---
summary: >-
  D10 · wave B · gated on X3 · webview · ≤200 lines: with exactly two commits
  Ctrl/Cmd-selected, offer "Compare Selected Commits" in the context menu. It
  opens the existing comparison view, older to newer. This is issue #26's
  first proposal, and it reuses the compare-with-HEAD path and backend
  unchanged.
---

# D10 — Compare two selected commits

Status: ready
Needs: —
Decisions: X3
Kind: webview, plus l10n · Size budget: ≤ 200 changed lines outside tests
Source: [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26) ("Selecting one commit, then clicking on another (e.g. while holding CTRL)"); Phase 8

## Goal

Select two commits, right-click, "Compare Selected Commits", and get the
same comparison view "Compare with HEAD" opens today, between those two.

## Read first

- [The agent protocol](010-agent-protocol.md), and the answer to X3
- `src/webview/main.ts`:
  - `buildSelectedCommitContextMenu`, today squash/drop only;
  - `getSelectedCommits`;
  - the Ctrl/Cmd-click handling (search for `ctrlKey || mouseEvent.metaKey`);
  - `buildCompareWithHeadMenuItem` and `loadCommitComparisonWithHead`;
  - `handleCommitComparisonResponse`;
  - `viewGitFileDiff`, which passes `oldRef`/`newRef`.
- `src/contextMenuVisibility.ts`, `src/types.ts` (`compareWithHead`
  appears in four groups), `tests/webview/contextMenuVisibilityRendering.test.ts`
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
  (`action.compareWithHead`)

## Facts (checked `2026-10-18`)

- The backend already compares arbitrary refs. The CLI runs `git diff <base>
  <compare>`; the engine's `compare_commits` takes any revisions; `viewDiff`
  takes `oldRef`/`newRef`.
- "Compare with HEAD" sets `expandedCommit.comparison = { baseRef: hash,
  compareRef: "HEAD" }` and sends `{ command: "commitComparison", repo,
  commitHash: hash, baseRef: hash, compareRef: "HEAD" }`.

## Steps

1. Refactor `loadCommitComparisonWithHead(sourceElem, hash)` into
   `loadCommitComparison(sourceElem, commitHash, baseRef, compareRef)`, and
   keep compare-with-HEAD calling it with the same values. Its behavior must
   not change; the existing tests prove that.
2. In `buildSelectedCommitContextMenu`, when exactly two commits are
   selected and neither is the uncommitted row `"*"`, add
   `{ title: l10n.compareSelection, onClick }`, guarded by a new visibility
   key `compareSelection` in the `commit` group.
3. **Direction, for X3 = (a):** the base is the commit lower in the table
   (the older), the compare is the higher one. Use the right-clicked row as
   `commitHash` (the row the details attach to).
4. Add `compareSelection` to the visibility defaults (`true`) and types in
   the same places as `compareWithHead`. Add `action.compareSelection`
   ("Compare Selected Commits") to all five bundles and `webviewL10n.ts`.

## Touch

`src/webview/main.ts`, `src/contextMenuVisibility.ts`, `src/types.ts`,
`src/extension/webviewL10n.ts`, `l10n/bundle.l10n*.json`,
`tests/webview/contextMenuVisibilityRendering.test.ts`, and a new
`tests/webview/compareSelection.test.ts`

## Tests

- Two commits selected: the menu shows the item. One or three selected, or
  the `*` row: it doesn't. The visibility setting hides it.
- Clicking sends `commitComparison` with base = the older and compare = the
  newer, whichever was clicked first.
- The compare-with-HEAD message is unchanged.

## Acceptance

Gates pass, including `l10n:check` at 100%.

## Report

_(not started)_
