---
summary: >-
  Feasibility study and draft implementation plan (`2026-10-19`, checked on
  `microsoft/vscode` `main` `5f97e8c`) for an upstream Code - OSS pull
  request that lets an extension contribute a diff algorithm: declared in
  `package.json`, listed in `diffEditor.diffAlgorithm`, called over RPC
  with `@vscode/diff`'s own `computeDiff` contract. The seam exists
  (`WorkerBasedDocumentDiffProvider` already delegates to any
  `IDocumentDiffProvider`). Not started; acceptance is Microsoft's.
---

# Upstream API: extension-contributed diff algorithms (`2026-10-19`)

**Status: feasibility checked and a plan drafted at the maintainer's
request. Nothing is posted or opened upstream; that is the maintainer's.**

## Why

- **Who it's for:** VS Code's built-in diff can only be one of Microsoft's
  four implementations. `advanced-wasm`, the fast one, is a prebuilt
  binary from the non-public `microsoft/vscode-packages` repository. The
  maintainer reports that VSCodium does not offer it. That is not verified
  here: no local install, and VSCodium's repository has no file mentioning
  `@vscode/diff` or `advanced-wasm`.
- **What it buys:** a public, documented API lets any Code - OSS derivative
  use any implementation whose source anyone can audit, this project's
  engine among them, inside the native diff editor with its syntax
  coloring, search and language features. Git Graph Libre's own tab exists
  only because no such route exists (see "No way to route a computed diff
  into the editor").
- **Facts checked (`2026-10-19`):**
  - `@vscode/diff` `0.0.2-7` is a runtime `dependency` of `microsoft/vscode`
    at `main` and at tags `1.140.0`, `1.141.0` and `1.142.0`;
  - `advanced-wasm` is in the `diffEditor.diffAlgorithm` schema at
    `1.140.0` and `1.142.0`, so it is not Insiders-only, contrary to what
    was assumed earlier the same day;
  - the newest VSCodium release is `1.140.06880`.

## Feasibility: yes, technically

What exists at `main` `5f97e8c`:

- **The async seam:**
  `WorkerBasedDocumentDiffProvider.computeDiff(original: ITextModel,
  modified: ITextModel, options, token): Promise<IDocumentDiff>`, in
  `src/vs/editor/browser/widget/diffEditor/diffProviderFactoryService.ts`.
  When its `diffAlgorithm` is an `IDocumentDiffProvider` object instead of
  a name, it delegates to that object outright. Nothing outside the editor
  layer can pass one today: `diffEditorOptions.ts` L216 validates the
  option against the four names.
- **The one consumer:** `IDiffProviderFactoryService` (a delayed
  singleton) is used only by `diffEditorViewModel.ts` L71, which passes
  `diffAlgorithm: this._options.diffAlgorithm`. A workbench implementation
  can therefore resolve extension ids without the editor layer depending on
  the workbench.
- **The data contract to copy:** `externalLinesDiffComputer.ts` calls
  `@vscode/diff`'s `computeDiff(original: string, modified: string,
  options)`.
  - The texts are the lines joined with `\n`.
  - The result is `{ edits: { replacements: [{ range: { start,
    endExclusive }, newText }] }, moves: [{ range: { original, modified } }],
    hitTimeout }`, in UTF-16 offsets.
  - The adapter turns replacements into `RangeMapping`s, then into line
    mappings with `lineRangeMappingFromRangeMappings`. That is the same
    function `advanced` itself ends with, so the result is lossless apart
    from moves' inner changes, which the adapter leaves empty.
  - That call is synchronous inside the editor worker
    (`ILinesDiffComputer`), so an extension, which is always async over RPC,
    must plug in at the `IDocumentDiffProvider` level above it.
- **Precedents for "an extension announces, Code lists it in a setting":**
  - terminal profiles: `contributes.terminal.profiles`, an implicit
    `onTerminalProfile:` activation, then
    `window.registerTerminalProfileProvider(id, provider)`, with the
    default-profile setting's enum built from contributions;
  - `editor.defaultFormatter`, whose enum `DefaultFormatter` refreshes on
    `onDidChangeExtensions` (`formatActionsMultiple.ts`);
  - implicit activation events come from an extension point's
    `activationEventsGenerator` (`extensionsRegistry.ts` L682).

## The API (draft proposal `diffAlgorithmProvider`)

**Contribution,** so Code can list the algorithm before the extension
activates:

```jsonc
"contributes": {
  "diffAlgorithms": [
    { "id": "native", "title": "%diff.native.title%", "description": "%diff.native.description%" }
  ]
}
```

- **Setting value:** `"<extension id>:<id>"`, for example
  `"publisher.extension:native"`. It appears in `diffEditor.diffAlgorithm`
  (and later `mergeEditor.diffAlgorithm`) beside the four built-ins, with
  its title as the item label.
- **Activation:** the implicit `onDiffAlgorithm:<extension id>:<id>`.

**`src/vscode-dts/vscode.proposed.diffAlgorithmProvider.d.ts`:**

```ts
declare module 'vscode' {
	// https://github.com/microsoft/vscode/issues/84981

	export interface DiffAlgorithmOptions {
		readonly ignoreTrimWhitespace: boolean;
		/** 0 means no limit. */
		readonly maxComputationTimeMs: number;
		readonly computeMoves: boolean;
		readonly extendToSubwords: boolean;
	}

	/** Half-open UTF-16 offsets into the text passed to `computeDiff`. */
	export interface DiffOffsetRange { readonly start: number; readonly endExclusive: number }
	export interface DiffReplacement { readonly range: DiffOffsetRange; readonly newText: string }
	export interface DiffMove { readonly range: { readonly original: DiffOffsetRange; readonly modified: DiffOffsetRange } }

	/** `@vscode/diff`'s result shape: a provider may return its `computeDiff` result unchanged. */
	export interface DiffAlgorithmResult {
		readonly edits: { readonly replacements: readonly DiffReplacement[] };
		readonly moves: readonly DiffMove[];
		readonly hitTimeout: boolean;
	}

	export interface DiffAlgorithmProvider {
		/** `original` and `modified` are the documents' lines joined with `\n`. */
		computeDiff(original: string, modified: string, options: DiffAlgorithmOptions, token: CancellationToken): ProviderResult<DiffAlgorithmResult>;
	}

	export namespace workspace {
		/** `id` is a `contributes.diffAlgorithms` id of the calling extension. */
		export function registerDiffAlgorithmProvider(id: string, provider: DiffAlgorithmProvider): Disposable;
	}
}
```

- **Contract:** replacements sorted, non-overlapping, ranges into
  `original`, and the texts reconstructible exactly. Code validates this
  (as `assertFn` does for `advanced`) and falls back on a violation.
- **Open question for review:** inner changes inside moves. The shape has
  none, which is the existing `advanced-external` behavior. An optional
  `DiffMove.replacements` could follow in a later version.

## Implementation plan (files at `main` `5f97e8c`)

**Editor layer (small, no workbench dependency):**

1. `src/vs/editor/common/diff/externalLinesDiffComputer.ts`: extract the
   conversion into an exported
   `linesDiffFromStringEdits(originalText, modifiedText, result,
   computeMoves)`, used by both `@vscode/diff` and extension results.
2. `diffProviderFactoryService.ts`:
   - widen `IDocumentDiffFactoryOptions.diffAlgorithm` to
     `DiffAlgorithmName | string`;
   - add the algorithm to the static `diffCache` context key, which today
     leaves it out (a bug that a provider switch would expose).
3. `diffEditorOptions.ts` L216: accept the four names or the
   `<extension id>:<id>` pattern, otherwise the default. Widen
   `editorOptions.ts` L994 and `monaco.d.ts` with `| (string & {})`, or keep
   the editor-layer types and resolve only in the workbench, whichever the
   reviewers prefer.

**Workbench:**

4. **The extension point** (`src/vs/workbench/services/diffAlgorithms/`):
   `ExtensionsRegistry.registerExtensionPoint({ extensionPoint:
   'diffAlgorithms', jsonSchema, activationEventsGenerator })`, plus an
   `IDiffAlgorithmsService` holding the contributed descriptors and the
   registered providers, with `onDidChange`.
5. **The setting** (`src/vs/workbench/contrib/diffAlgorithms/browser/diffAlgorithms.contribution.ts`):
   extend the `diffEditor.diffAlgorithm` enum, `enumItemLabels` and
   `markdownEnumDescriptions` from contributions, refreshed on extension
   changes as `DefaultFormatter` does, and call
   `notifyConfigurationSchemaUpdated`.
6. **The provider factory:** a workbench `IDiffProviderFactoryService`
   that resolves built-in names to `WorkerBasedDocumentDiffProvider` as
   today. An extension id resolves to a `WorkerBasedDocumentDiffProvider`
   wrapping an `ExtensionDocumentDiffProvider`, which:
   - answers disposed and identical models the way the worker provider does;
   - activates `onDiffAlgorithm:…`;
   - calls the extension host with cancellation and a hard deadline (the
     limit plus slack), then validates and converts the result with (1);
   - falls back to `advanced` when there is no provider, an error, a timeout
     or an invalid result, logging once and telling the user.
7. **RPC:**
   - files: `mainThreadDiffAlgorithms.ts`, `extHostDiffAlgorithms.ts`, the
     shapes in `extHost.protocol.ts`, and `workspace.registerDiffAlgorithmProvider`
     in `extHost.api.impl.ts` behind `checkProposedApiEnabled(extension,
     'diffAlgorithmProvider')`;
   - the proposal entry in `src/vs/platform/extensions/common/extensionsApiProposals.ts`;
   - the payload: `$computeDiff(handle, { uri, versionId } ×2, options)`.
     The extension host already mirrors open text models, so it reads the
     texts from `ExtHostDocuments` when versions match. Only models it
     doesn't mirror (over the sync size limit) send their text, which keeps
     a 13 MB pair from being copied twice.

**Tests:**

8. Unit tests:
   - the conversion (moved from the external adapter's coverage);
   - the factory resolving names and ids;
   - the fallback on a missing provider, an error or an invalid result;
   - the cache key.
9. **An API integration test** in `extensions/vscode-api-tests`: a provider
   that wraps `@vscode/diff`, already a VS Code dependency, and a check
   that the diff editor's result equals `advanced-external`'s. Compliance
   with `@vscode/diff` is proven by construction.

**Out of scope for the first version:**
- the source-control gutter, notebooks, chat and test results, which
  hard-code `advanced`;
- `mergeEditor.diffAlgorithm`, a follow-up;
- the external adapter's two TODOs (`ignoreTrimWhitespace` forced on, no
  `maxComputationTimeMs`), worth a companion fix.

**Size:** roughly 900–1,200 lines including tests, about half of it the
RPC and extension-point boilerplate every provider API carries.

## Process and risks

1. **Discuss first.** VS Code wants agreement before a feature pull
   request. Post the design on #84981 ("Support external diff algorithms in
   internal diff editor", open since 2019, Backlog, assigned to hediet), or
   in a new API-proposal issue that links it. Ask hediet (the diff editor)
   and the API owners whether they'd take it.
2. **The pull request** requires signing Microsoft's CLA, and the code is
   MIT, written for VS Code. Nothing comes from this repository's
   AGPL-3.0-or-later tree.
3. **While it's proposed:** extensions using it can't be published on the
   Marketplace. Users can still enable it per extension
   (`--enable-proposed-api <id>`, or `enable-proposed-api` in `argv.json`),
   and a derivative can allow it in `product.json`
   (`extensionEnabledApiProposals`). Whether Open VSX accepts such
   extensions is not checked.
4. **Finalization** happens in Microsoft's API review, on their schedule:
   months at best, and it may never happen. The diff is performance-critical
   and Microsoft owns the algorithm, so a decline is plausible.
5. **Git Graph Libre's side,** once the API exists: a provider over the
   engine's `diffTexts`. It converts the port's `LinesDiff` (inner
   `RangeMapping`s) into string replacements, which is lossless through
   `lineRangeMappingFromRangeMappings`, a function the port already has. It
   pays off fully only after the Myers performance slice (see "Why the port
   is slower than `@vscode/diff`'s WebAssembly").
