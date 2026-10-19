---
summary: >-
  D13 · wave B · needs D10 · webview · ≤200 lines: make a comparison look
  like one. The details show "Comparing <base> → <compare>", with ref names
  where known, a Swap button, and the same labels in the diff tab titles.
  Today a comparison opens commit details with nothing saying what it
  compares.
---

# D13 — Comparison header and swap

Status: ready
Needs: D10
Decisions: —
Kind: webview, plus l10n and CSS · Size budget: ≤ 200 changed lines outside tests
Source: [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26); Phase 8 acceptance, "Selecting two commits shows a comparison view"

## Goal

Anyone looking at a comparison can see which two points it compares, and
turn it around.

## Read first

- [The agent protocol](010-agent-protocol.md), and D10's report
- `src/webview/commitDetailsView.ts`: `renderCommitDetailsRowHtml`,
  `renderCommitDetailsSummary`
- `src/webview/main.ts`: `expandedCommit.comparison`, `showCommitDetails`,
  `handleCommitComparisonResponse`, `viewGitFileDiff`
- `src/extension/messageHandler.ts`: `formatRevisionDiffTitle`
- The CSS rules in the KB's Webview UI Styling Guide (OKLCH, theme tokens
  first)

## Steps

1. Extend the comparison state to `{ baseRef, compareRef, baseLabel?,
   compareLabel? }`. The labels are what the user picked (a branch or tag
   name, or `HEAD`); a raw hash shows as its abbreviation through the
   existing `displayHash`.
2. When `expandedCommit.comparison` is set, render a header line above the
   summary: `l10n.comparing` with `{0} → {1}`, and a Swap button (an icon
   with `title=l10n.swapComparison`) that calls `loadCommitComparison` with
   the refs exchanged.
3. Pass the labels to `viewDiff`'s title. `formatRevisionDiffTitle` may
   receive labels instead of refs; keep its fallback to abbreviated hashes.
4. Add the strings to all five bundles. The CSS goes into the existing
   commit-details stylesheet, OKLCH only.

## Touch

`src/webview/commitDetailsView.ts`, `src/webview/main.ts`,
`src/webview/global.d.ts`, `src/extension/messageHandler.ts` (title only),
`src/extension/webviewL10n.ts`, `l10n/bundle.l10n*.json`, the commit-details
CSS file under `media/`, `tests/webview/commitDetailsView.test.ts`,
`tests/webview/messageHandler.test.ts`

## Tests

- The header renders only for comparisons, with labels or abbreviated
  hashes.
- Swap sends `commitComparison` with base and compare exchanged.
- Diff titles carry the labels.

## Acceptance

Gates pass, and the header is visible in light and dark themes. Use the
headless render in the KB's Webview UI Styling Guide, and attach the
screenshot paths to the report.

## Report

_(not started)_
