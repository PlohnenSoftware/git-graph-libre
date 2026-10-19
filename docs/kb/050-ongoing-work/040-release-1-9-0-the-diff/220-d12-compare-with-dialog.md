---
summary: >-
  D12 · wave B · needs D10, D11 · webview · ≤220 lines: "Compare with…" in
  the commit, branch and tag context menus. A dialog takes a SHA or picks a
  loaded branch, tag or HEAD, resolves it through D11, and opens the
  comparison. This is issue #26's second proposal.
---

# D12 — "Compare with…" dialog

Status: done — awaiting integration
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

- **Agent / date:** Muse Code (general-purpose) sub-agent D12, claimed
  2026-10-19 10:50 Europe/Warsaw, report 2026-10-19 10:57. Model note:
  general-purpose on the inherited runtime model — no named-model selector
  exists in this runtime; the integrator records the constraint.
- **Branch and commits:** `diff-1.9.0/d12` — `b8825e9 G feat(compare):
  "Compare with…" dialog (D12)`, plus the signed report commit carrying
  this section. No push.
- **Files changed:** `src/webview/main.ts` +124/−1; `src/types.ts`,
  `src/contextMenuVisibility.ts`, `src/extension/webviewL10n.ts` and each
  of the five `l10n/bundle.l10n*.json` files +4/−0 each (157 changed lines
  outside tests, budget ≤220); new `tests/webview/compareWith.test.ts`
  +294, `tests/webview/contextMenuVisibilityRendering.test.ts` +23,
  `tests/webview/remoteBranchContextMenu.test.ts` +1 (see deviations);
  this slice's claim, status and report.
- **Tests added or changed:** new `compareWith.test.ts`, 0 → 11 cases (the
  item in all four menus; present on the checked-out branch where
  compare-with-HEAD cannot be; suggestion order and placeholder;
  `v1.0` submit sending `resolveRef` and the hash reply sending
  `commitComparison` clicked → resolved; branch base label and typed-hash
  abbreviation; error reply dialog; stale reply ignored; empty submit
  blocked); visibility rendering suite 6 → 7 cases (`compareWith: false`
  hides the item in the commit, branch and tag menus; the remote-branch
  "all disabled" case covers the fourth group) plus the new key added to
  the tag-menu disabled list. Webview total 655 → 667.
- **Gates:** strict Biome clean on the 12 touched code/locale/test files
  (also `lint:strict:staged` at commit); `pnpm run typecheck` green;
  full `pnpm run test` with the built engine addon (`engine:build` +
  `engine:smoke` OK at 1.0.26): backend 892/892, webview 667/667;
  `pnpm run l10n:check` 100% in all five bundles (genuine nl/pl/zh-cn/zh-tw
  translations, no English copies); `pnpm run kb:check` green;
  `git diff --check` clean. Rust arm n/a (no `engine/**` change).
  Sonar: integrator.
- **Acceptance:** gates pass and `l10n:check` at 100% — met, numbers
  above. The item appears in the commit, branch, remote-branch and tag
  menus behind the new `compareWith` visibility key (default `true`) —
  met by the named tests. Submitting `v1.0` sends `resolveRef`; a hash
  reply sends `commitComparison` with base = clicked, compare = resolved;
  an error reply shows `unableToResolveRef` with the error text; a stale
  reply is ignored — all met by the named tests. Headless QtWebEngine/Xvfb
  renders with the real `media/*.css` in both themes show the dialog
  (title, placeholder input with the datalist affordance, primary button)
  and the unclipped menu label: `/tmp/ggl-d12-visual/dark.png` and
  `/tmp/ggl-d12-visual/light.png` (preview HTML and `shot.py` beside them).
- **Deviations from the slice:** (1) Step 2's suggestions: no existing
  `DialogInput` type offers suggestions (`text-ref` would also reject
  expressions like `HEAD~2`, which D11 accepts), and adding one needs
  `src/webview/global.d.ts`, outside *Touch*. Instead of the written
  plain-text fallback, the required plain text input gains a native
  `<datalist>` (HEAD, local branches, remote branches stripped of
  `remotes/`, tags) attached in `main.ts` once the dialog is in the DOM;
  free text stays typeable. Required dialog inputs also refresh on
  `input` now, so picking a suggestion with the mouse unblocks submit.
  (2) Step 3's call gains D13's optional labels (the slice predates them):
  `baseLabel` is the clicked ref name from a ref menu, `compareLabel` is
  the typed ref unless it is a prefix of the resolved hash, so D13's
  header reads e.g. "Comparing main → v1.0". The reply also re-finds the
  live row by hash, falling back to the captured element. (3) One test
  file outside *Touch*: `tests/webview/remoteBranchContextMenu.test.ts`
  +1 line — its exact remote-branch menu list gains "Compare With…"; no
  assertion was weakened. Flagging for the integrator because D04b works
  on overlapping webview files in its own worktree.
- **Open questions / follow-ups:** none for the slice. Integrator: full
  gate with coverage and Sonar; judge deviations (1) and (2) — if a typed
  `DialogInput` suggestion variant is preferred over the post-render
  datalist, that follow-up needs `src/webview/global.d.ts` in *Touch*.
