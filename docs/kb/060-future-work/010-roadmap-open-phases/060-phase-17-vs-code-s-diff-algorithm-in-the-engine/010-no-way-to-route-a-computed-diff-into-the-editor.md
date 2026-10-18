---
summary: >-
  Resolved concern for Phase 17's D4 (`2026-10-19`; the maintainer chose
  G4 (c), a light tab of our own): no extension route supplies a computed diff to VS Code's editor. The
  `diffEditor.diffAlgorithm` setting only picks among Microsoft's four
  built-in implementations (`legacy`, `advanced`, `advanced-external`,
  `advanced-wasm`), and `@vscode/diff` is a pure compute library bundled
  into VS Code core, not an editor integration. Verified against Insiders
  `a0c6520` and the installed package. One route around it: VS Code's own
  diff editor embedded as Monaco in our webview, fed by the engine through a
  service override (checked on `main` `1356222d3`). A "GGL Diff" tab built
  on it, or on a renderer of our own, is proposed as G4, with Monaco's
  measured size (2.66 MB minified) and the source-control button.
---

# No way to route a computed diff into the editor (`2026-10-19`)

**Status: resolved `2026-10-19`. Recorded at the maintainer's request while
deciding Phase 17's D4. The maintainer then chose G4, option (c): a light
"GGL Diff" tab of our own with VS Code's diff editor styles copied in,
planned as release 1.9.0's slices D40–D48.**

The question: once the engine can compute VS Code-quality diffs itself, can
Git Graph Libre feed them into VS Code's diff editor, the way
`@vscode/diff` seems to? The answer is no, and the premise needs care:
`@vscode/diff` does not route anything into the editor either.

## What `@vscode/diff` is (checked in the installed package)

- A pure compute library. `createDiffComputer().computeDiff(original,
  modified)` returns data (`edits`, `moves`, `hitTimeout`). Its `dist/`
  contains no VS Code API use at all — no `vscode.` references, no
  decorations, no webview — and it runs under plain Node.
- The editor connection runs the other way: current VS Code **bundles the
  package into its own workbench and editor worker** as one of its built-in
  diff implementations. That is Microsoft consuming its own extraction,
  not an integration route open to extensions.

## What `diffEditor.diffAlgorithm` changes (Insiders `a0c6520`)

Only which of Microsoft's four hard-coded implementations computes diffs
inside the editor worker (`getLegacy`, `getDefault`,
`getAdvancedExternal`, `getAdvancedWasm` behind
`WorkerBasedDocumentDiffProvider`; `mergeEditor.diffAlgorithm` mirrors it):

- `legacy`: the old algorithm; genuinely different results.
- `advanced` (default): the in-tree TypeScript algorithm.
- `advanced-external`: "the advanced diffing algorithm from the external
  `@vscode/diff` package (pure JavaScript)".
- `advanced-wasm`: the same package's WebAssembly backend.

"External" names the package, not an external provider. The enum is
closed, the factories are fixed in VS Code's bundle, and the three
advanced variants are meant to produce identical output. The external
adapter currently forces `ignoreTrimWhitespace: true` and passes no
`maxComputationTimeMs`, both per its own TODOs (see the wiring trace in
the Phase 17 section).

## What an extension can and cannot do

- **Cannot** register a diff backend, add an enum value, or hand
  precomputed edits to the diff editor: Insiders' `vscode.d.ts`
  (`a0c6520`) has no diff-provider registration of any kind, and the
  `vscode.diff` command takes two URIs and a title, then computes the
  diff itself with the selected built-in algorithm.
- **Can** show `vscode.diff` as today (this extension's `viewDiff`), where
  the result is already the same `advanced` algorithm the port
  reproduces, or paint its own surface — a virtual document with editor
  decorations (G2), or hunks inside its webview (G1) — which is what D4
  chooses between.
- Setting the user's `diffEditor.diffAlgorithm` (for example through
  `configurationDefaults`) would only pick among Microsoft's backends;
  it neither uses nor needs our engine.

## Consequence for D4

The port's payoff cannot be "our engine inside VS Code's diff editor".
It is character-level highlights and moved-block results inside this
extension's own surfaces, computed in process without opening an editor,
plus a native-speed oracle-proven implementation. If none of G1–G3 earns
its surface in 1.9.0, the fallback is to land the port and its engine
exports (17.0–17.7) with `vscode.diff` unchanged, and design the surface
once the capability exists. Revisit if VS Code ever ships a diff-provider
API (proposed or stable); none exists as of `2026-10-19`.

## The route around it: VS Code's diff editor as Monaco (`2026-10-19`)

Checked on `microsoft/vscode` `main` at `1356222d3`. The native diff editor
stays closed, but the same diff editor widget ships as the standalone
Monaco editor (`monaco-editor`, MIT), and that copy can be fed our diffs.

- **The option route is closed too.** `WorkerBasedDocumentDiffProvider`
  internally accepts a provider object for `diffAlgorithm` and calls its
  `computeDiff`, but the diff editor's options never get there:
  `diffEditorOptions.ts` passes the value through `validateStringSetOption`
  with the four names, so an object falls back to the default. Monaco's
  public `monaco.d.ts` types the option as those four strings only.
- **The service route is open.** `monaco.editor.createDiffEditor(element,
  options, override)` takes `IEditorOverrideServices`, a string-keyed map.
  `StandaloneServices.initialize` replaces any not-yet-built singleton
  whose id matches a key. The diff editor gets its provider from the
  singleton `diffProviderFactoryService` (`createDiffProvider(options)`), so
  passing `{ diffProviderFactoryService: ours }` makes every diff in that
  editor come from our provider, and so from the engine.
- **Costs and risks:**
  - the service id and the `IDocumentDiff` result shape (`changes` as
    `DetailedLineRangeMapping`, `moves`, `identical`, `quitEarly`) are
    internal, not in `monaco.d.ts`, so a Monaco upgrade can break them;
    pin the version and cover it with a test;
  - `initialize` runs once per page, so the override must come with the
    first Monaco editor the webview creates;
  - the editor is a copy inside a webview, not VS Code's editor: no other
    extensions, language servers, or user keybindings, and theming goes
    through our CSS variables;
  - it adds Monaco's bundle to the webview.
- **What it buys:** a diff that looks and behaves like VS Code's own,
  inside this extension's surfaces (a G1-style webview view, or a
  read-only custom editor tab), with the engine computing in process.
  Because the port reproduces `advanced`, the hunks match what
  `vscode.diff` would show; the gain is speed and control, not different
  results.
- **Proposed APIs** don't change this. `documentDiff` (`getTextDiff`) and
  `diffCommand` let an extension read VS Code's diff, not supply one.
  `customEditorDiffs` lets a custom editor's webview render a diff tab,
  which would host the same Monaco route, but proposed APIs can't ship on
  the Marketplace.

Before building on it, a spike should confirm the override end to end in
a webview with a pinned `monaco-editor` and a stub provider.

## A "GGL Diff" tab, measured (`2026-10-19`)

Proposed by the maintainer: a tab of our own that looks like the diff
editor, as light as possible, opened from commit details and from a button
in the Source Control view, and faster than the native editor. It is G4
under D4. Nothing is built; the numbers below come from a throwaway bundle
in a scratch directory.

**Opening it from Source Control.**
- The Git extension's resource groups are `merge`, `index`, `workingTree`
  and `untracked` (its `package.json` in Insiders `1.143.0`). It puts its
  per-file icons in `scm/resourceState/context` with `"group": "inline"`
  (its `scm/resourceState/inline` list is empty), so ours goes there too,
  with `when: scmProvider == git && scmResourceGroup == <group>`. The
  same entry without `inline` adds it to the right-click menu.
- The command receives a `SourceControlResourceState`, whose public part is
  `resourceUri`. The group picks the pair: `workingTree` is the index
  against the file on disk, `index` is `HEAD` against the index, and
  `untracked` is empty against the file on disk.
- Reading the index side in the engine needs a new export; today the engine
  reads blobs only at revisions.

**Two ways to build it.**

| | (a) Monaco's diff editor | (b) A renderer of our own |
| --- | --- | --- |
| What it is | VS Code's own diff editor widget (`monaco-editor` `0.57.0`, MIT; it depends on `marked` and `dompurify`), fed by the engine through the `diffProviderFactoryService` override | Virtualized rows, side by side or inline, colored with VS Code's own `--vscode-diffEditor-*` theme variables, which webviews receive |
| Size (esbuild, minified) | 2,658 KB JS (685 KB gzipped) and 89 KB CSS for the diff editor alone; 2,737 KB with the find widget; 3,149 KB with every Monarch language as lazy chunks; the full `editor.main` is 4,383 KB. The graph webview is 213 KB today. | Tens of KB, estimated |
| Fidelity | The real widget: navigation, collapsed unchanged regions, find, accessibility | Our own, so only as close as we build it |
| Syntax colors | Monarch grammars, which don't match the user's TextMate theme | None, unless added later |
| Before the port lands | Works on Monaco's own in-tree `advanced` algorithm, then switches to the engine | Nothing to show: decision X7 forbids gix display diffs |
| Risk | The override and the result classes are internal, so pin the version and test them; `ThirdPartyNotices.txt` must ship with it | All the rendering code is ours to maintain |

Either way the tab is its own webview with its own bundle, so the graph
webview doesn't grow.

**Taking only the diff editor's drawing code (`2026-10-19`).** Measured as
esbuild import closures from `monaco-editor` `0.57.0`, minified:

| What is imported | JS | gzipped |
| --- | --- | --- |
| `diffEditorWidget.js` without the standalone services it needs | 2,014 KB | 526 KB |
| `codeEditorWidget.js`, one plain editor | 1,571 KB | 408 KB |
| `renderLines.js`, which draws deleted lines in inline mode | 221 KB | 66 KB |
| `viewLineRenderer.js`, one line of text to HTML | 73 KB | 27 KB |
| the Monarch lexer and compiler, for syntax colors | 139 KB | 48 KB |

- **The widget can't be cut down.** The diff editor is two full code
  editors: its own code is about 370 KB of source in
  `browser/widget/diffEditor/`, and all of it draws through the editor's
  view layer (view zones for alignment, decorations, scrolling). Without
  the service layer it saves only about 640 KB on 2.66 MB, and every
  service would then need a hand-written stub. That isn't worth it.
- **The drawing parts can come out, as option (c): (b) with VS Code's own
  pieces copied in.** These parts are small and mostly self-contained:
  - the diff editor's `style.css` (15 KB of source). It colors everything
    with `--vscode-diffEditor-*` variables (`insertedLineBackground`,
    `removedTextBackground`, `diagonalFill`, `move-border`, …), which
    webviews receive, so the tab follows the user's theme like the real
    one;
  - the class names its decorations use (`line-insert`, `char-delete`,
    `gutter-insert`, `insert-sign`, … in `registrations.contribution.js`);
  - the logic that collapses unchanged regions (`UnchangedRegion` in
    `diffEditorViewModel.js`) and, if wanted, the line renderer for tabs
    and visible whitespace.

  We write a virtualized two-pane view of plain lines, padded with filler
  rows so both sides line up (with no line wrapping, alignment is just
  padding each change). The line renderer's 73 KB is mostly shared
  helpers, so copy only the function, not its imports. Estimated well
  under 100 KB without syntax colors. Copied code is MIT and goes under
  Phase 17's legal plan (notices in `LICENSE.mit` and `NOTICE.md`, a
  header naming the source file and commit).

**Where it can be faster, and where it can't.**
- Faster: both blobs are read in process by the engine, with no `git show`
  spawn. Once 17.7 lands the diff is computed in Rust, without a worker
  round trip, which matters most on files where the TypeScript algorithm
  nears the 5 s `diffEditor.maxComputationTime`.
- Not faster: a webview tab has to start cold. Every open creates the
  webview and parses its script; with (a) that is 2.7 MB. The native diff
  editor is already loaded. On small files the native editor may well win.
- A spike must measure "click to first paint" against `vscode.diff`, on a
  small file and on a file over 10,000 lines, before G4 is chosen.
