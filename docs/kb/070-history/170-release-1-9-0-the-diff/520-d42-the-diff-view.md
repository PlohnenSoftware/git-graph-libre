---
summary: >-
  D42 · wave D · needs D40, D41 · webview · ≤300 lines: draw D41's rows as
  a side-by-side diff that looks like VS Code's, with virtualized scrolling
  for files of any length, a horizontal scrollbar per side, gutters with
  line numbers and signs, collapsed regions that expand, and `F7` /
  `Shift+F7` between changes.
---

# D42 — The diff view

Status: integrated 546290c
Needs: D40, D41
Decisions: Phase 17 D4 (answered: G4, option (c))
Kind: webview (TypeScript and CSS) · Size budget: ≤ 300 changed lines outside tests
Source: Phase 17, "No way to route a computed diff into the editor", option (c)

## Goal

Draw a diff that looks like VS Code's diff editor and stays fast on a file
of 100,000 lines, by keeping only the visible rows in the DOM.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D40's and D41's slice files and reports
- Webview UI Styling Guide, and its "Verifying webview visuals without a
  browser" record, under Reference

## Facts

- D41's `DiffRow` model and `expandCollapsed`; D40's class names under
  `.ggl-diff`.
- Webviews receive the editor font as `--vscode-editor-font-family`,
  `--vscode-editor-font-size` and `--vscode-editor-font-weight`. The line
  height and tab size arrive as numbers in the view's options, from D44.
- VS Code's diff editor uses `F7` and `Shift+F7` for the next and
  previous change.

## Steps

1. Create `src/webview/diffTab/view.ts`, exporting `createDiffView(container,
   rows, options)`. It returns `{ update(rows), revealNextChange(),
   revealPreviousChange(), dispose() }`. `options` holds `lineHeight`,
   `tabSize` and the labels `hiddenLines` ("{0} hidden lines"),
   `showMoreAbove`, `showMoreBelow` and `showAll`; D44 supplies the
   localized text.
2. The container gets the class `ggl-diff`.
   - **Scrolling:** one vertical scroller over a spacer as tall as all the
     rows (fixed row height). Only the visible rows, plus 20 above and
     below, exist in the DOM, positioned absolutely, and are re-rendered on
     scroll.
   - **A line row** has two halves. Each half holds a line-number gutter,
     a sign column (`+` in `insert-sign`, `−` in `delete-sign`) and the
     text. Apply D40's classes: `line-insert` or `line-delete` on the
     half, `char-insert` or `char-delete` on highlighted segments,
     `gutter-insert` or `gutter-delete` on the gutter. A filler half
     (`null`) gets `diagonal-fill`.
   - **Text** uses `white-space: pre` and `tab-size` from the options.
     Text cells allow selection; gutters don't.
   - **Horizontal scrolling:** each side has its own horizontal scrollbar
     under its half, which shifts that side's text cells, as in VS Code.
   - **A collapsed row** shows the localized `hiddenLines` text and three
     buttons that call D41's `expandCollapsed`, then re-render.
   - **Keys:** `F7` and `Shift+F7` scroll the next or previous change's
     first row into view.
3. Create `media/diff-tab/diff-tab.css` for the tab's own layout (panes,
   divider, gutters, scrollbars). Use theme tokens first
   (`--vscode-editor-background`, `--vscode-editorLineNumber-foreground`,
   `--vscode-diffEditor-border`), with OKLCH fallbacks, per the styling
   guide.

## Touch

`src/webview/diffTab/view.ts` (new), `media/diff-tab/diff-tab.css` (new),
`tests/webview/diffTab/view.test.ts` (new)

## Tests

In jsdom:
- a 10,000-row model renders at most the visible window plus overscan;
- the insert, delete, character and filler classes land on the right
  elements;
- the gutters show the line numbers;
- a collapsed row's buttons reveal lines;
- `F7` and `Shift+F7` move `scrollTop` to the next and previous change;
- `dispose` removes the listeners.

## Acceptance

- Gates pass.
- A headless render of one diff in a dark and in a light theme, made with
  the styling guide's QtWebEngine method and the real CSS files. Put the
  screenshot paths in the report.

## Report

- **Agent / date:** Codex D42, 2026-10-19 02:03
- **Branch and commits:** `diff-1.9.0/d42` — `d1511aa G feat(diff-tab): draw the diff rows as a virtualized side-by-side view (D42)`, plus the signed report commit carrying this section. Codex stopped on its quota with the work staged but uncommitted and the status still "claimed"; the integrator (Claude Code) committed it on `2026-10-19` after rerunning focused checks (strict Biome on 2 files, typecheck, 43/43 tests under `tests/webview/diffTab`, `kb:check`), per the multi-agent gate policy. No push.
- **Files changed:** `src/webview/diffTab/view.ts` (+233/−0), `media/diff-tab/diff-tab.css` (+37/−0), `tests/webview/diffTab/view.test.ts` (+311/−0), this slice file (status/report). Implementation: 270 lines outside tests, within the ≤300 budget; the final staged diff also includes this status/report.
- **Tests added or changed:** new `tests/webview/diffTab/view.test.ts`, 12 tests: 10,000- and 100,000-row virtualization (a 10-row viewport draws 30 rows at an edge or at most 51 between rows, including both 20-row overscan margins), decoration classes/signs/gutters/fillers and escaped text, independent horizontal offsets and offscreen width, configured/default repeated collapse expansion preserving D41 objects, next/previous change starts with F7/Shift+F7 and wrapping, navigation after partial expansion, unchanged-file keys, update/clamping, resize and complete listener/observer disposal. Webview 623 → 635; backend unchanged at 887.
- **Gates:** biome pass (`pnpm exec biome check --config-path biome.strict.jsonc --error-on-warnings` on both touched TypeScript files; 2 files); typecheck pass; package pass (full lint: 298 files); `pnpm run test` backend 887/887 (82 files), webview 635/635 (57 files), no skips; `pnpm run l10n:check` 100% (615 bundle keys and 114 package keys in all four translations); `pnpm run kb:check` pass; Rust arm n/a (no engine source change); Sonar: integrator. Full-suite logs: `/tmp/ggl-d42-visual/test-final.log`; l10n: `/tmp/ggl-d42-visual/l10n.log`. The initial run skipped 31 backend engine tests because this worktree lacked an addon; with integrator approval, copied the ignored linux-x64 addon from the matching integration build (all three engine tree hashes, worktree HEAD / local the-diff / integration checkout HEAD: `8402c37c2080af401d9af76c2d00b15050581b10`), passed `pnpm run engine:smoke` (`1.0.25`), then reran the full suite without skips.
- **Acceptance:** local gates met as above; integrator coverage/Sonar pending before commit. Dark/light QtWebEngine renders using both real `media/diff-tab/vscode-diff.css` and `media/diff-tab/diff-tab.css` met and visually inspected at 1240×820: `/tmp/ggl-d42-visual/dark.png`, `/tmp/ggl-d42-visual/light.png` (20 model/rendered rows, inserted/deleted and character highlights, left fillers, two expandable regions, fixed gutters, two themed horizontal scrollbars). Harness and bundled current renderer: `/tmp/ggl-d42-visual/preview.ts`, `preview.js`, `shot.py`, `dark.html`, `light.html`. The exported API supplies `update`, `revealNextChange`, `revealPreviousChange` and `dispose`; one vertical spacer/window, separate text offsets, editor font tokens and tab size are implemented in the allowed files.
- **Deviations from the slice:** approved contract completion: exported `DiffViewOptions` includes optional `revealLineCount` (default 20), so D44 can honor the user's setting when calling D41 expansion; D41 consumes only that layout field for expansion. All four required localized labels come from options; no new literal user-facing strings, dependencies, suppressions or gate changes.
- **Open questions / follow-ups:** integrator coverage/Sonar before signed commits; D44 passes localized labels and `revealLineCount`. D41's documented simple in-order pairing remains its model contract.
