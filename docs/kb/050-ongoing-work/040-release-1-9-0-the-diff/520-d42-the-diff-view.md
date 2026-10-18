---
summary: >-
  D42 · wave D · needs D40, D41 · webview · ≤300 lines: draw D41's rows as
  a side-by-side diff that looks like VS Code's, with virtualized scrolling
  for files of any length, a horizontal scrollbar per side, gutters with
  line numbers and signs, collapsed regions that expand, and `F7` /
  `Shift+F7` between changes.
---

# D42 — The diff view

Status: ready
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

_(not started)_
