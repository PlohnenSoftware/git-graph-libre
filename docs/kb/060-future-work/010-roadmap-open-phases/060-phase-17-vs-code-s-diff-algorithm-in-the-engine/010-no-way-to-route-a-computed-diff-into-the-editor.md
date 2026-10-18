---
summary: >-
  Open concern for Phase 17's D4 (`2026-10-19`, maintainer reviewing): no
  extension route supplies a computed diff to VS Code's editor. The
  `diffEditor.diffAlgorithm` setting only picks among Microsoft's four
  built-in implementations (`legacy`, `advanced`, `advanced-external`,
  `advanced-wasm`), and `@vscode/diff` is a pure compute library bundled
  into VS Code core, not an editor integration. Verified against Insiders
  `a0c6520` and the installed package.
---

# No way to route a computed diff into the editor (`2026-10-19`)

**Status: open concern, recorded at the maintainer's request while deciding
Phase 17's D4. The maintainer is looking into it in more depth; D4 stays
unanswered until then.**

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
