---
summary: >-
  Q2: Reflog tab table columns: header labels never wrap (the Index header
  shows "Ind / ex" today), each column's default width fits its header and
  stays reachable by dragging back, Message is the flexible column that
  absorbs every change, and the Reflog tab never scrolls horizontally.
  From the maintainer's test on `2026-11-23`.
---

# Q2 — Reflog table column widths, no horizontal scroll

Status: done — awaiting integration

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

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 17:47
- **Branch and commits:** `rel-1.11.0/Q2` —
  - `fd521103 G docs(kb): claim slice Q2 (Q2)`
  - `ff21a791 G feat(reflog): flexible Message column width arithmetic (Q2)`
  - `fc63f8cc G fix(reflog): fitted table widths, unwrapped headers, no sideways scroll (Q2)`
  - `d2954b8d G fix(reflog): refit widths when the scroll container itself narrows (Q2)`
  - plus this report commit.
- **Files changed:** 8 files, +477/−75 at `d2954b8d` (`git diff --stat d8ef44a0..HEAD`): this slice file (claim only, 2 lines), `media/reflog-tab/reflog-tab.css` (+40/−~6 of its lines), `src/webview/reflogTab/columnResize.ts`, `src/webview/reflogTab/view.ts`, and four test files under `tests/webview/reflogTab/`. Nothing outside the Touch list; `lostCommitsView.ts` and `main.ts` needed no edit (below).
- **Tests added or changed:** +13 tests; no test weakened or removed — the ones that pinned the old natural-layout freeze now pin the defaults-and-flexible rules this slice specifies.
  - `tests/webview/reflogTab/columnResize.test.ts`: 6 → 14 tests (defaults at/above the minimum and reachable by dragging back; every boundary trades against Message; totals hold through any drag; fit grows/shrinks Message first, scales saved widths back slack-proportionally at 700px, and never renders wider than containers from 1,560px down to 312px).
  - `tests/webview/reflogTab/view.test.ts`: 31 → 35 tests (defaults from the first draw; first drag trades against Message and returns to the default exactly; saved widths fitted on a window resize without being overwritten; only Message grows on widening; refit through a stubbed `ResizeObserver` when the container narrows by a scrollbar's width; rendered width never exceeds the container after drags at a fitted width).
  - `tests/webview/reflogTab/reflogTabCss.test.ts`: 6 → 7 tests (header `nowrap` + ellipsis, both scroll containers vertical-only, no 200px cell minimum, pills clip inside narrow columns).
  - `tests/webview/reflogTab/main.test.ts`: the per-repository saved-widths test updated to drag from the defaults; another repository now starts from the defaults in fixed layout.
  - `tests/webview/tableColumnResize.test.ts` covers only the graph table; it is untouched and passes.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all six touched `.ts` files — clean (only the pre-existing schema-version info line). The CSS is outside Biome's checked set in this repo.
  - `pnpm run typecheck` — clean.
  - `node esbuild.js --production` — builds.
  - `npx vitest run --project webview tests/webview/reflogTab/ tests/webview/reflogTabPanel.test.ts tests/webview/tableColumnResize.test.ts` — 9 files, 159 passed (before the observer test; the view file then re-ran alone at 35 passed).
  - `pnpm run test` (full, once at the end; run twice only to capture both projects' counts) — backend 119 files, 1,592 passed, 60 skipped (the linked-worktree skips); webview 94 files, 1,327 passed.
  - `node ./docs/kb/housekeeping.mjs --check` — exit 0.
  - No user-visible strings were added or changed, so `pnpm run l10n:check` did not apply and was not run.
  - Headless renders (PyQt6 QtWebEngine under `xvfb-run`, `QT_QPA_PLATFORM=xcb`, the real `out/reflogTab.min.js` built from this tree, the real `media/tokens.css` + `media/reflog-tab/reflog-tab.css`, current fixture labels/rows; harness kept beside the PNGs), each read by eye and measured in the page (`scrollWidth` vs `clientWidth` of `.reflog-scroll`, line boxes of the Index header's text):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q2/reflog-q2-dark-1560.png` — no horizontal scroll (1560 = 1560), Index on one line, Message fitted to 772px.
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q2/reflog-q2-dark-700.png` — no horizontal scroll (686 = 686, the vertical scrollbar's width refitted), Index fully visible on one line.
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q2/reflog-q2-light-1560.png` — same measurements as dark.
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q2/reflog-q2-light-700.png` — same measurements as dark; its first render round caught the stale fit that `d2954b8d` fixes (fitted to 700px, then the vertical scrollbar narrowed the container to 686px).
  - Sonar: integrator.
- **Acceptance:**
  - *Index header folds → unfolded size is the default; no header wraps; defaults fit header and usual content; dragging back reaches the default* — **met**. The table no longer sizes itself naturally at all: it always draws in fixed layout with explicit widths (`DEFAULT_COLUMN_WIDTHS` = Index 52, Action 116, Sub-action 112, Message 320, Commit 88, Date 140, State 168 content px, sized from the longest header and content words across all five bundles, the default hash length, the bundle date shape and the longer state badge). The old first-drag freeze of the natural layout — what sized Index by its one-digit cells — is deleted. Header cells are `white-space: nowrap` with an ellipsis, so the root's `overflow-wrap: anywhere` can no longer break "Index" into "Ind / ex" (measured: one line box, `nowrap`, in all four renders). Every default sits above the 40px minimum, and a test drags Index wide and back onto its default exactly.
  - *Message is the flexible column* — **met**. Pure arithmetic in `columnResize.ts` (`resizeColumnWidths`, `fitColumnWidthsToContainer`): widening a fixed column takes from Message, narrowing one gives to it, Message's own right edge trades against Commit as the graph's description column does against Date, and fitting to a new container width changes Message first, down to the 40px minimum. The view fits after insertion, on window resize, and through a `ResizeObserver` on the scroll container; fitting is display-only and never overwrites the saved per-repository widths.
  - *No horizontal scroll in the Reflog tab, ever* — **met**. A drag keeps the total width, so it cannot break a fit; saved widths that no longer fit are fitted back (Message first, then the fixed columns in proportion to their slack above the minimum — Index, the narrowest, keeps its header width longest; below the sum of the minimums every column scales proportionally and clips with an ellipsis). The 200px `min-width`s on the message and lost-subject cells that could force overflow are removed, the pills clip inside narrow columns, and both scroll containers are vertical-only as a guard behind the fit (cells keep their full text in `title`, so nothing reachable hides). Measured in the renders: `scrollWidth == clientWidth` at 1,560px and 700px in both themes. The lost-commits table shares the head-cell class and its subject column already takes the leftover width, so it needed only the CSS parts; `lostCommitsView.ts` is untouched.
  - *Pure arithmetic stays in `columnResize.ts`, DOM in the view; complexity ≤ 15* — **met by construction** (all width rules are pure exported functions with the view holding two small helpers; Sonar confirms at integration).
- **Deviations from the slice:** None outside Touch. Within it: `main.ts` needed no edit because saved widths are fitted in the view at draw time and a fit never writes back, so the saved-state format and flow are unchanged (widths saved by the old pair-trade code still normalize and are then fitted). One judgment inside the slice's rules: at about 700px the flexible rule leaves Message at its 40px minimum — its header ellipses to "Mes…" and long messages wrap very narrowly — while every fixed header, Index first, stays fully readable; the alternative (scaling fixed columns harder to feed Message) would ellipsize the Index header the slice names. The renders show both widths so the maintainer can judge.
- **Open questions / follow-ups:** One stale comment outside Touch: `columnWidths` in `src/webview/reflogTab/rowModel.ts` still says "or null while the table still sizes itself" — null now means the defaults rule. Worth a one-line wording fix whenever that file is next touched. Nothing else.

## Integrator follow-up (`2026-11-23`)

Integration review of the renders: at 1,560 px the result is right (Index on
one line, Message takes the slack, no horizontal scroll). At **700 px it is
not acceptable**: `reflog-q2-dark-700.png` shows Message squeezed to about
55 px with the message wrapping one word per line (rows many lines tall),
while Action, Sub-action, Date and State keep their full defaults. 700 px is
an ordinary split-editor width. The cause is the fit order: Message gives
everything down to the 40 px `MIN_COLUMN_WIDTH` before any fixed column
gives anything.

Change the automatic fit (window/container narrowing, and fitting saved
widths) to:

1. Message shrinks first, but only down to a working minimum
   `MESSAGE_MIN_WIDTH` of 200 px (an exported constant in
   `columnResize.ts`).
2. Then the fixed columns shrink, in proportion to their slack above
   `MIN_COLUMN_WIDTH`, clipping with an ellipsis (headers included).
3. Only when every fixed column is at `MIN_COLUMN_WIDTH` does Message go
   below 200 px, down to `MIN_COLUMN_WIDTH`.
4. Widening reverses it: fixed columns grow back towards their defaults (or
   the user's saved widths) before Message grows past 200 px; beyond that
   Message takes all extra width as now.

A user's explicit drag may still take Message down to `MIN_COLUMN_WIDTH`
(the user chose it); the 200 px floor is for the automatic fit only. The
no-horizontal-scroll rule and everything else in this slice stay as they
are.

Acceptance: pure tests for the new fit order (all four steps, including
growing back); a view test that at a 700 px container Message is at least
200 px wide and no row wraps the message one word per line; new renders,
dark and light, at 1,560, 700 and 480 px, replacing the old 700 px ones,
listed in a new "## Report (follow-up)" below this section. Also fix the
stale `columnWidths` comment in `src/webview/reflogTab/rowModel.ts` you
reported (one line; added to Touch by the integrator).

## Report (follow-up)

- **Agent / date:** Muse Code (Haiku 5.5 continuation of the quota-interrupted run), 2026-11-23.
- **Commits on `rel-1.11.0/Q2`, all signed:**
  - `f88d53ef G fix(reflog): fit Message to 200px before fixed columns shrink (Q2)`
  - `4f3a9b35 G test(reflog): 700px fit keeps Message at 200px or more (Q2)`
  - `fbff8882 G docs(reflog): columnWidths comment names the defaults, not sizing (Q2)`
  - plus this report commit.
- **Fit rule as implemented** (`fitColumnWidthsToContainer` in `columnResize.ts`, with `MESSAGE_MIN_WIDTH = 200`): a narrower container takes width in order: (1) Message down to 200 px; (2) the fixed columns, in proportion to their slack above `MIN_COLUMN_WIDTH`, clipping with an ellipsis; (3) Message below 200 px down to `MIN_COLUMN_WIDTH` only once every fixed column is at 40 px; then scaled as before if still too wide. A wider container reverses it: fixed columns grow back to the chosen widths while Message stays at 200 px, and only beyond that does Message grow. Explicit drags still take Message down to 40 px. The shrink flooring was changed from rounding so a fixed column never gives more than its share.
- **Tests:** `columnResize.test.ts` 16 passed (step 1 to 4, growing back, 480/400/312 px cases). `view.test.ts` 36 passed (three view expectations that pinned the old fit now pin the new order; new test: from the defaults at 700 px, Message is at least 200 px and the table renders exactly 700 px). Full `pnpm run test`: backend 119 files, 1592 passed, 60 skipped (linked-worktree skips); webview 94 files, 1330 passed. `pnpm run typecheck` clean. Strict Biome clean on the touched `.ts` files (only the pre-existing schema-version info line). No new user-visible strings, so `l10n:check` did not apply.
- **Renders** (`/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q2/`, from `out/reflogTab.min.js` built from this tree, measured in the page): `reflog-q2-dark-1560.png`, `reflog-q2-dark-700.png`, `reflog-q2-dark-480.png`, `reflog-q2-light-1560.png`, `reflog-q2-light-700.png`, `reflog-q2-light-480.png`. The old 700 px PNGs were replaced.
  - 1560 px: Message 772 px, Index on one line, `scrollWidth == clientWidth` (1560).
  - 700 px: Message 200 px, fixed columns 45/64/63/56/71/75 px with ellipsis in Action and Sub-action; messages wrap in readable multi-word lines; no horizontal scroll (686 = 686, the vertical scrollbar refitted). Index header on one line. Both themes.
  - 480 px: Message 114 px, every fixed column at the 40 px minimum; Message wraps narrowly (about 3 to 4 words per line) and fixed headers ellipsize ("Acti…", "Sub-…", "Co…"). No horizontal scroll (466 = 466). This is the step-3 fallback the rule specifies, not a one-word-per-line case, but it is cramped; the integrator should judge whether 480 px is acceptable.
- **Checks not run:** none skipped. `housekeeping.mjs --check` was not re-run after this report; the slice file is the only KB file touched in this follow-up.
- **Deviations:** the `rowModel.ts` comment fix (one line, added to Touch by the integrator) is the only edit outside the follow-up's test and arithmetic files.

