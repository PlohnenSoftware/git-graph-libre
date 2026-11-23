---
summary: >-
  Q2: Reflog tab table columns: header labels never wrap (the Index header
  shows "Ind / ex" today), each column's default width fits its header and
  stays reachable by dragging back, Message is the flexible column that
  absorbs every change, and the Reflog tab never scrolls horizontally.
  From the maintainer's test on `2026-11-23`.
---

# Q2 — Reflog table column widths, no horizontal scroll

Status: claimed by Muse Code on 2026-11-23 17:31

Needs: —

Agent: Muse Code

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`); the Reflog tab in
History (`070-history/230-reflog-tab.md` and its slices, F1-08 for the
column resizing); the Webview UI Styling Guide (Reference), including the
headless render recipe; the graph table's resizing
(`makeTableResizable` / `resizeTableColumn` / `clampTableResizeDelta` in
`src/webview/`), whose flexible description column is the model for Message.

## Touch

`src/webview/reflogTab/columnResize.ts`, `src/webview/reflogTab/view.ts`,
`src/webview/reflogTab/lostCommitsView.ts` (only if its table scrolls
sideways too), `src/webview/reflogTab/main.ts` (only for saved-state width
handling), `media/reflog-tab/reflog-tab.css`; tests under
`tests/webview/reflogTab/` and `tests/webview/tableColumnResize.test.ts` if
it covers the Reflog; this file's Status and Report.

## Task and acceptance

What the maintainer reported (screenshot of the header row: `Ind ex` folded
over two lines, then Action, Sub-action, a very wide Message, Commit, Date,
State):

1. **Index header folds.** The natural (auto-layout) width of the Index
   column is narrower than its header, so "Index" wraps to "Ind / ex". Once
   the user widens the column it cannot be dragged back to that width.
   **Make the unfolded size the default:** no header label wraps
   (`white-space: nowrap`; ellipsis only when the user drags a column
   narrower than its label), and each fixed column's default width fits its
   header label and its usual content on one line. Dragging a column back
   down must reach that default width again (the minimum must not sit above
   the default).
2. **Message is the flexible column.** Messages are already truncated or
   wrapped, so Message is the column that gives and takes width: widening
   another column shrinks Message, narrowing one grows it, and a window
   resize changes Message only (down to the minimum). Model it on the graph
   table's flexible description column.
3. **No horizontal scroll in the Reflog tab, ever.** At any panel width, with
   or without saved widths, after any drag, and in the lost-commits view if
   it shares the problem, the table fits the tab's width: the scroll
   container never gets a horizontal scrollbar. Do not achieve this by
   hiding overflow that holds content the user cannot otherwise reach; the
   columns themselves must fit (clip with ellipsis inside cells when narrow).
   Saved widths that no longer fit the current width are scaled back
   (Message first) rather than overflowing.

Keep the pure arithmetic in `columnResize.ts` (unit-tested) and the DOM in
the view. Cognitive complexity of each function stays at 15 or below
(SonarQube ZAM gate).

Tests: pure tests for the new width rules (default widths, the flexible
column, fitting saved widths to a smaller container, minimum equals or sits
below the default); view tests that the header cells do not wrap, that the
table width never exceeds the container width after a drag and after a
resize, and that saved widths are fitted. Headless renders, dark and light,
at about 1,560 px and about 700 px wide, PNGs under
`/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q2/`, each showing the Index
header on one line and no horizontal scrollbar; list them in the Report.

Checks: strict Biome on touched files, `pnpm run typecheck`,
`node esbuild.js --production`, the touched Vitest suites, the full
`pnpm run test` once (record counts), KB check. No new strings (if a string
is unavoidable, all five bundles). Claim and changes are separate signed
commits; never push.

## Report

Not started.
