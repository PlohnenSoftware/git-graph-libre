---
summary: >-
  D41 · wave D · ready · TypeScript, pure · ≤250 lines: the GGL Diff tab's
  data types, and a pure function that turns two texts' lines and their
  changes into side-by-side rows (paired lines, filler rows, highlighted
  character segments, collapsed unchanged regions), using VS Code's own
  rule for which unchanged regions collapse.
---

# D41 — The diff row model

Status: integrated 82cc778
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

- **Agent / date:** Muse Code sub-agent D41, 2026-10-19 01:40
- **Branch and commits:** `diff-1.9.0/d41` — `4d8c518 G feat(diffTab): add the diff row model (D41)`; this report in a follow-up signed docs commit on the same branch
- **Files changed:** `src/diffTabTypes.ts` (new, +28), `src/webview/diffTab/rowModel.ts` (new, +215), `tests/webview/diffTab/rowModel.test.ts` (new, +373), this slice file (status line and this report). 243 changed lines outside tests, within the ≤250 budget
- **Tests added or changed:** added `tests/webview/diffTab/rowModel.test.ts` (27 tests): `splitLines` (4 cases), `buildRows` (identical, insertion at start/middle/end, pure deletion, 2-vs-4 replaced block with two left fillers, inner change spanning two lines, emoji surrogate pair proving UTF-16 columns, added file, deleted file), collapsing (start/middle/end runs, exact threshold, one line too short, whole file, short whole file, `hideUnchanged` off), `expandCollapsed` (`all`, `above`, `below`, repeated partial expansion, unknown id). Every case also asserts the line-number property (each side reads 1 to n, skipping fillers and adding collapsed `hiddenCount`s). Counts: webview 591 before → 618 after; backend 873 total before and after (no backend files touched)
- **Gates:** biome strict clean on the 3 touched `.ts` files (`Checked 3 files`, no warnings); typecheck green (all three projects); test backend 843 passed / 30 skipped of 873, webview 618/618 — the 30 backend skips are `skipIf` engine tests because no engine addon (`.node`) is built in this worktree, pre-existing and untouched by this slice; l10n n/a (no user-visible text); kb:check green; Rust arm n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:** met — gates pass as recorded above; the module imports nothing from `vscode` or the DOM (its only import is the type-only `@/diffTabTypes`, checked by grep, and the focused suite passes under the webview project: 27/27). Steps evidence: the four shared types in `src/diffTabTypes.ts`; `splitLines`, `buildRows` and `expandCollapsed` in `src/webview/diffTab/rowModel.ts` with the exact `DiffRow`/`DiffCell` shapes from the slice; collapse rule ported from `UnchangedRegion.fromDiffs` with a header comment naming `src/vs/editor/browser/widget/diffEditor/diffEditorViewModel.ts` at `1356222d342e6a7b2dd5603107bcdb60a6d0653b`, Microsoft's copyright and "Licensed under the MIT License (see LICENSE.mit)"
- **Deviations from the slice:** none in steps, touch list, shapes or signatures. One implementation note the integrator and D42 need: the slice's collapsed row carries no line text, so `buildRows` keeps each collapsed row's hidden line rows in a module-internal `WeakMap` keyed by the collapsed row object, and `expandCollapsed(rows, id, how, layout)` reveals from there; collapsed rows must be expanded from the objects `buildRows` returned, not from serialized or cloned copies (an unknown or foreign row leaves the list unchanged). `"above"` reveals at the region's top and `"below"` at its bottom; a partly revealed region keeps its `id`. In the added/deleted-file tests "empty" is zero lines (`[]`); `splitLines("")` itself returns `[""]` per *Facts*, so the D45 producer decides how an empty side is presented
- **Open questions / follow-ups:** aligning rows at inner-change boundaries inside a change is out of scope here, as the slice states (VS Code does it; D42 and later slices inherit simple in-order pairing); D42 must keep the row objects `buildRows` returned if it wants `expandCollapsed` to work (see the note above); Sonar/coverage with the integrator
- **Follow-up (D41F, 2026-10-19):** the integrator's Sonar run flagged three issues here: cognitive complexity 18 in `segmentsForLine`, 20 in `pushUnchangedRun`, and a last-element index access. D41F fixed them without changing behavior on `diff-1.9.0/d41f`, splitting the code into `spanOnLine`, `mergeIntervals` and `visibleEdges` and using `.at(-1)`. It adds one test, for several inner changes on one line. Types, row identity and the `WeakMap` contract are unchanged. See D41F's report
