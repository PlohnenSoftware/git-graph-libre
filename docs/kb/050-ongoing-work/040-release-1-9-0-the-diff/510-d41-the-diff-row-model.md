---
summary: >-
  D41 · wave D · ready · TypeScript, pure · ≤250 lines: the GGL Diff tab's
  data types, and a pure function that turns two texts' lines and their
  changes into side-by-side rows (paired lines, filler rows, highlighted
  character segments, collapsed unchanged regions), using VS Code's own
  rule for which unchanged regions collapse.
---

# D41 — The diff row model

Status: ready
Needs: —
Decisions: Phase 17 D4 (answered: G4, option (c))
Kind: TypeScript, pure (no DOM, no `vscode`) · Size budget: ≤ 250 changed lines outside tests
Source: Phase 17, "No way to route a computed diff into the editor", option (c)

## Goal

Decide, without drawing anything, what each row of a side-by-side diff
holds. D42 then only draws these rows, and every layout rule can be tested
here without a browser.

## Read first

- [The agent protocol](010-agent-protocol.md)
- The Phase 17 record named under *Source*
- `src/types.ts`, for the project's type style

## Facts (checked `2026-10-19`)

- **VS Code's diff result shape** (`LinesDiff`), which Phase 17's
  sub-slice 22j will return and D45 maps into this slice's types:
  - a list of changes, each with an `original` and a `modified` line range
    (1-based, end exclusive);
  - each change's `innerChanges`: character ranges with 1-based lines and
    columns, end exclusive. Columns count UTF-16 code units, which is
    what JavaScript string indices count.
- **VS Code's text model splits lines** on `\r\n`, `\n` and `\r`, and a
  text ending in a line break has an empty last line (`"a\n"` is
  `["a", ""]`).
- **Defaults** in `src/vs/editor/common/config/diffEditor.ts` at
  `1356222d342e6a7b2dd5603107bcdb60a6d0653b`:
  `hideUnchangedRegions.enabled` false, `contextLineCount` 3,
  `minimumLineCount` 3, `revealLineCount` 20.
- **The collapse rule** is `UnchangedRegion.fromDiffs` in
  `src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts` (same
  commit, MIT). For each unchanged run between changes:
  - A run touching the start or end of the file collapses when its length
    is at least `minContext + minHidden`. It keeps `minContext` lines next
    to the change, and none at the file's edge.
  - Any other run collapses when its length is at least
    `2 × minContext + minHidden`. It keeps `minContext` lines on each
    side.
  - A run that is the whole file (no changes) collapses entirely once it
    is at least `minContext + minHidden` long.

## Steps

1. Create `src/diffTabTypes.ts`, shared by the extension and the webview:
   - `LineSpan = { start: number; endExclusive: number }`, 1-based;
   - `CharSpan = { startLine; startColumn; endLine; endColumn }`, 1-based,
     UTF-16 columns, end exclusive;
   - `DiffTabChange = { original: LineSpan; modified: LineSpan; inner:
     { original: CharSpan; modified: CharSpan }[] }`;
   - `DiffTabLayout = { hideUnchanged: boolean; contextLineCount: number;
     minimumLineCount: number; revealLineCount: number }`.
2. Create `src/webview/diffTab/rowModel.ts` exporting:
   - `splitLines(text: string): string[]`, as the text model splits
     lines (*Facts*).
   - `buildRows(originalLines, modifiedLines, changes, layout): DiffRow[]`,
     where a row is one of:
     - `{ kind: "line"; left: Cell | null; right: Cell | null }`, where
       `null` is a filler row;
     - `{ kind: "collapsed"; id: number; originalStart: number;
       modifiedStart: number; hiddenCount: number }`.

     A `Cell` is `{ lineNumber; change: "none" | "insert" | "delete";
     segments: { text: string; highlight: boolean }[] }`.
   - `expandCollapsed(rows, id, how: "all" | "above" | "below", layout)`,
     which reveals the whole region or `revealLineCount` lines at the
     region's top or bottom.
3. Layout rules:
   - Outside changes, lines pair one to one.
   - Inside a change, lines pair in order, and the shorter side gets
     filler rows after its lines. VS Code also aligns at inner-change
     boundaries inside a change; that is out of scope here, so say so in
     the report's follow-ups.
   - A changed line's segments are cut at the inner changes that touch
     it, with `String.prototype.slice` on UTF-16 columns.
   - Collapse unchanged runs only when `layout.hideUnchanged` is true,
     with the rule in *Facts*. Port it from `UnchangedRegion.fromDiffs`
     with a header comment naming the source file and commit, Microsoft's
     copyright and "Licensed under the MIT License (see LICENSE.mit)".
     D40 adds the notices.

## Touch

`src/diffTabTypes.ts` (new), `src/webview/diffTab/rowModel.ts` (new),
`tests/webview/diffTab/rowModel.test.ts` (new)

## Tests

- `splitLines`: `""`, `"a"`, `"a\n"`, `"a\r\nb\rc\n"`.
- `buildRows`:
  - identical texts;
  - an insertion at the start, in the middle and at the end;
  - a pure deletion;
  - a replaced block with 2 lines on the left and 4 on the right, which
    gives two filler rows on the left;
  - an inner change spanning two lines;
  - an emoji (a surrogate pair) before a highlighted character, proving
    UTF-16 columns;
  - an added file (empty original) and a deleted file (empty modified).
- Collapsing, with the default counts:
  - runs at the start, in the middle and at the end;
  - a run one line too short to collapse;
  - a file with no changes;
  - `expandCollapsed` with `all`, `above` and `below`.
- A property over every case: reading each side top to bottom, skipping
  fillers and adding each collapsed row's `hiddenCount`, gives line
  numbers 1 to n with no gap and no repeat.

## Acceptance

- Gates pass. The module imports nothing from `vscode` or the DOM.

## Report

_(not started)_
