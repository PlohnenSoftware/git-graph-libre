---
summary: >-
  D12 · wave B · needs D10, D11 · webview · ≤220 lines: "Compare with…" in
  the commit, branch and tag context menus. A dialog takes a SHA or picks a
  loaded branch, tag or HEAD, resolves it through D11, and opens the
  comparison. This is issue #26's second proposal.
---

# D12 — "Compare with…" dialog

Status: claimed by Muse Code (general-purpose) sub-agent D12 on 2026-10-19 10:50 Europe/Warsaw
Needs: D10, D11
Decisions: — (the direction is fixed: clicked commit → chosen ref)
Kind: webview, plus l10n · Size budget: ≤ 220 changed lines outside tests
Source: [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26) ("Right-Clicking one commit, click 'Compare with …' … Commit SHA, Tag, Branch (uses the HEAD commit of the branch)")

## Goal

From any commit, branch or tag, compare with anything that names a commit.

## Read first

- [The agent protocol](010-agent-protocol.md), and the reports of D10 and D11
- `src/webview/main.ts`: `showFormDialog`, `showSelectDialog`,
  `showRefInputDialog` (near the end of the file), and how existing dialogs
  call them (search `showFormDialog(`)
- `src/webview/global.d.ts`: `DialogInput`
- D10's `loadCommitComparison` and D11's `resolveRef` message

## Steps

1. Add a context-menu item, `l10n.compareWith + ELLIPSIS` ("Compare
   With"), to the `commit`, `branch`, `remoteBranch` and `tag` groups, behind
   a new visibility key `compareWith` (default `true`).
2. The dialog has one text input with suggestions: `HEAD`, the loaded local
   branches, remote branches and tags, in that order. Reuse the existing
   input type that offers suggestions if there is one; otherwise use a plain
   text input and say so in the report. The placeholder reads "SHA, branch
   or tag".
3. On submit, send `resolveRef` with a fresh `requestId`.
   - On a hash: call `loadCommitComparison(sourceElem, clickedHash,
     clickedHash, resolvedHash)`. The base is the clicked commit, so the diff
     reads clicked → chosen.
   - On an error: show `showErrorDialog` with `l10n.unableToResolveRef` and
     the error text.
   - Ignore replies whose `requestId` isn't the latest.
4. Add the strings to all five bundles: `action.compareWith`,
   `dialog.compareWith.title`, `dialog.compareWith.placeholder`,
   `error.unableToResolveRef`.

## Touch

`src/webview/main.ts`, `src/contextMenuVisibility.ts`, `src/types.ts`,
`src/extension/webviewL10n.ts`, `l10n/bundle.l10n*.json`,
`tests/webview/contextMenuVisibilityRendering.test.ts`, and a new
`tests/webview/compareWith.test.ts`

## Tests

- The menu item appears in all four groups and the visibility setting hides
  it.
- Submitting `v1.0` sends `resolveRef`, and a fake reply with a hash sends
  `commitComparison` with base = clicked and compare = resolved.
- An error reply shows the error dialog. A stale reply is ignored.

## Acceptance

Gates pass, and `l10n:check` is at 100%.

## Report

_(not started)_
