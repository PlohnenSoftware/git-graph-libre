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
- **Keeping it warm (`2026-10-19`, the maintainer asked).** VS Code has no
  API to keep a webview alive without a tab, so a hidden, preloaded diff
  tab isn't possible. What is possible, and planned in D44:
  - one reused panel with `retainContextWhenHidden: true`, so while its
    tab exists, even in the background, every open is one message;
  - starting the engine's read and diff on the click, in parallel with
    the webview's start-up, so a cold open costs about the larger of the
    two, not their sum;
  - a bundle under 100 KB, which is why option (c) beat Monaco.

  So only the first open of a session, or the first after the user closes
  the tab, is cold. D48 measures cold and warm opens separately.
- A spike must measure "click to first paint" against `vscode.diff`, on a
  small file and on a file over 10,000 lines, before G4 is chosen.

### D48 agent-half measurements (`2026-10-19`)

Everything below is headless: no VS Code window was opened, so D48's step 3
(click to colored hunks from a 60 fps recording, for the tab cold, the tab
warm and `vscode.diff`) stands as written in the slice — **maintainer** —
and D44's `painted ms=` could not be collected at all. What was measured is
the tab's data path through the real code, plus compute-only proxies for
the editor side, labeled as proxies.

**Environment.** AMD Ryzen 9 5900X (24 threads), 31 GiB RAM, Linux
7.2.9-2-cachyos, Node v26.11.1. Engine: `pnpm run engine:build:release`
(release profile, 4,901,536 bytes; `engine:smoke` OK), `engineVersion()`
1.0.26. Installed but never launched: VS Code Insiders 1.143.0-insider
(`a0c6520`); the editor version for the display half is the maintainer's
to record. Editor-side numbers use the pinned devDependency
`@vscode/diff` 0.0.2-87 under Node. The tab bundle at this commit,
`out/diffTab.min.js` from `node esbuild.js --production`, is 8,388 bytes.

**Method** (stated in the scratch scripts before any run; scripts and raw
JSONL kept outside the repo at `/tmp/d48-measure/`). An esbuild bundle in
the `bench:backends` pattern ran D45's real
`createEngineDiffTabSource(...).load()` with two `revision` sides — the
request D47 builds — against this worktree read-only, with a `vscode`
configuration stub returning nothing, so D45's fallbacks apply (VS Code's
defaults: `ignoreTrimWhitespace` true, `maxComputationTime` 5000 ms,
`maxFileSize` 50 MB). Primary numbers are the integer `read=`/`diff=`
fields of the one `operation=diffTab` route line per load, captured
through `setOperationLog`, with `performance.now()` float timings beside
them. Every series is n=10: "cold" is ten fresh Node processes (addon
load timed apart; process-cold, **not** a cold webview), "warm" is one
process after 2 warmup loads (warmups printed and excluded). D41's
`buildRows` ran on the warm payload with D44's fallback layout (context 3,
minimum 3, reveal 20), `hideUnchanged` off and on. The proxies diffed the
same two texts (read with `git show`, outside every measured path) under
the same options as the tab (`computeMoves: false` included). Two harness
smoke runs before the formal series are excluded and noted in D48's
report; no run was repeated or re-picked.

**Cases** (from this repository's history, picked before measuring). Small:
`ae6ddf6`, `src/contextMenuVisibility.ts`, 119 → 120 lines (+1 line; the
most recent commit modifying a `src/` file under 200 lines on both sides).
Large: `683d60a`, `graphify-out/graph.json`, 181,604 → 208,191 lines
(+63,387/−36,800 by numstat; 389,797 split lines in the route line). The
slice's suggested `pnpm-lock.yaml` does not qualify here: its history
peaks at 7,126 lines, and at HEAD the only other file over 10,000 lines is
an oracle corpus that was only ever added.

The tab's own path (median of 10, worst in parentheses; route fields are
whole milliseconds as logged):

| Measurement | Small | Large |
| --- | ---: | ---: |
| `read=` cold / warm | 1 (1) / 0 (0) ms | 39.5 (42) / 32 (43) ms |
| `diff=` cold / warm | 1 (1) / 1 (1) ms | 5114 (5122) / 5086.5 (5094) ms, `hitTimeout=1` every run |
| whole `load()`, cold / warm (own timing) | 1.87 (2.14) / 0.75 (1.10) ms | 5170.6 (5179.4) / 5134.8 (5153.1) ms |
| addon first load (cold processes) | 1.44 (1.62) ms | 1.43 (1.58) ms |
| `buildRows`, `hideUnchanged` off / on | 0.036 (0.065) / 0.013 (0.176) ms, 121 / 9 rows | 64.5 (108.3) / 47.8 (182.3) ms, 208,192 rows either way |

Compute and read pieces at float precision (median of 10, worst in
parentheses). The two `@vscode/diff` rows are **proxies for the editor's
algorithm cost only** — no text models, editor worker or rendering:

| Measurement | Small | Large |
| --- | ---: | ---: |
| engine seam `diffTexts` (22j) | 0.58 (0.63) ms | 5086.8 (5091.4) ms, timeout, 1 change |
| proxy: `@vscode/diff` TypeScript backend | 0.85 (1.25) ms | 5131.8 (5169.6) ms, timeout, 1 change |
| proxy: `@vscode/diff` WebAssembly backend | 0.29 (0.55) ms | 2579.7 (2639.5) ms, **no timeout, 1,879 changes** |
| engine read, both sides (`loadCommitFile` ×2) | 0.16 (0.42) ms | 17.3 (17.7) ms |

The WebAssembly proxy's one-off `_initWasm()` cost 14.7 ms (small run) and
18.1 ms (large run), once per process. On the small case every
implementation agrees: 1 change, no timeout.

**What this says, and what it doesn't.** On the small file the tab's whole
data path costs about 1–2 ms process-cold and 0.75 ms warm, with row
building under 0.1 ms, so a small-file win or loss against the diff editor
will be decided by webview start-up and paint — exactly the maintainer's
half — not by anything measured here. On the large file, the only change
to a file over 10,000 lines in this history, both our Rust port and
`@vscode/diff`'s TypeScript backend run into the 5,000 ms
`diffEditor.maxComputationTime` cap on every one of the 10 runs and return
one degenerate whole-file change (`hitTimeout=1` in every route line),
while the same package's WebAssembly backend completes a real 1,879-change
diff in about 2.58 s; the large `buildRows` row above therefore times the
degenerate timeout payload (one change, nothing collapsible), not a
completed large diff. Reading is not the problem at either size: both
sides of the 13 MB pair cost 17 ms at the seam. In one sentence: headlessly
the tab wins nothing yet — its data path is effectively free on small
files, where paint will decide, and on this repository's one very large
change it times out exactly where VS Code's `advanced` (TypeScript)
algorithm does and where `advanced-wasm`, by this proxy, would not.
