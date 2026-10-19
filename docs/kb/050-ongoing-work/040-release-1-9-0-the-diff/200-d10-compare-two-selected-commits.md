---
summary: >-
  D10 · wave B · gated on X3 · webview · ≤200 lines: with exactly two commits
  Ctrl/Cmd-selected, offer "Compare Selected Commits" in the context menu. It
  opens the existing comparison view, older to newer. This is issue #26's
  first proposal, and it reuses the compare-with-HEAD path and backend
  unchanged.
---

# D10 — Compare two selected commits

Status: integrated 7dc038b
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

- **Agent / date:** Codex sub-agent D10, 2026-10-19 02:03
- **Branch and commits:** `diff-1.9.0/d10` — `dd92ce4 G feat(compare): compare two selected commits (D10)`, plus the signed report commit carrying this section. Codex stopped on its quota with the work uncommitted; the integrator (Claude Code) committed it on `2026-10-19` after rerunning focused checks (strict Biome on 7 files, typecheck, 17/17 compare and visibility tests, `l10n:check` 100%, `kb:check`), per the multi-agent gate policy. No push.
- **Files changed:** `src/webview/main.ts` +30/−7;
  `src/contextMenuVisibility.ts`, `src/types.ts`,
  `src/extension/webviewL10n.ts`, and each of the five
  `l10n/bundle.l10n*.json` files +1/−0 each;
  `tests/webview/contextMenuVisibilityRendering.test.ts` +27/−2;
  new `tests/webview/compareSelection.test.ts` +249/−0;
  this slice's status and report. All files are within *Touch*.
- **Tests added or changed:** new selected-comparison suite, 0 → 8 cases;
  context-menu visibility suite, 5 → 6 cases. Total webview tests 623 → 632.
  The new cases cover Ctrl and Cmd, both selection orders, either host row,
  unrelated/noncontiguous rows and graph order despite conflicting dates,
  response rendering and `viewDiff` refs, one/three selections, the
  uncommitted row, the visibility setting, and unchanged compare-with-HEAD
  request values. Existing commit/ref compare-with-HEAD and squash/drop
  regression tests also pass unchanged.
- **Gates:** strict Biome clean (11 touched code/locale/test files);
  `pnpm run typecheck` green; `pnpm run package` green (full lint 297 files);
  `pnpm run test` initially backend 856 passed / 887 total, with 31
  missing-addon skips, and webview 632/632. After `pnpm run engine:build`
  succeeded, `pnpm exec vitest run --project backend` passed 887/887 with no
  skips; final webview rerun passed 632/632. `pnpm run l10n:check` 100%
  (616 bundle keys and 114 package keys for every locale); `pnpm run kb:check`
  green; `git diff --check` clean. Rust arm n/a (no engine source changed).
  Sonar: integrator (pending; no commit made before it).
- **Acceptance:** local gates met, including localization at 100%. The new
  menu is offered for exactly two real selected commits independently of
  HEAD ancestry; it sends lower-row base → higher-row compare, attaches to
  the right-clicked row, and retains those refs for file diffs. The HEAD
  path retains its click-time guard and sends the original message shape.
  Headless QtWebEngine/Xvfb layout preview with real `media/*.css`,
  inspected at `/tmp/ggl-d10-visual/menu.png`, shows the complete menu label
  without clipping. Pre-commit coverage/Sonar acceptance remains with the
  integrator.
- **Deviations from the slice:** none. Preserved and reviewed the prior
  partial visibility/type/localization edits after the maintainer authorized
  reassignment of the claim. The original HEAD loader is a thin guarded
  wrapper around the new shared comparison loader.
- **Open questions / follow-ups:** integrator coverage/Sonar, then signed
  implementation/report commits and signature verification before integration.
