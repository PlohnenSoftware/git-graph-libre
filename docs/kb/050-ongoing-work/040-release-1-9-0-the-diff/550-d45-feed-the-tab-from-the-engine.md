---
summary: >-
  D45 · wave D · needs D43, D44 and D22's 22j · TypeScript · ≤220 lines:
  the engine-backed `DiffTabSource`. It reads both sides in process (a
  revision, the staged copy, the working tree or empty), diffs them with
  the Phase 17 port under the user's `diffEditor.*` settings, maps the
  result into the tab's types, logs timings, and sets the
  `git-graph-libre.diffTabAvailable` context key.
---

# D45 — Feed the tab from the engine

Status: waiting on D43, D44 and 22j
Needs: D43, D44, D22 sub-slice 22j
Decisions: X5 = (b), because 22j is part of the stretch
Kind: TypeScript · Size budget: ≤ 220 changed lines outside tests
Source: Phase 17, "Using it in Git Graph Libre" (G4) and slice 17.8

## Goal

Give the tab its data from the engine: both texts read in process, and the
diff computed by the port of VS Code's algorithm. This is where the tab's
speed comes from. Without this source, the tab is never offered.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D43's and D44's slice files and reports, and 22j's report in D22
- `src/diffDocProvider.ts`: the engine-or-CLI read
- `src/extension/messageHandler.ts`: `resolveRepoFilePath`
- Phase 16's design rules, and "The engine surface" record (engine-only
  features)

## Steps

1. **The source.** Create `src/extension/diffTab/engineSource.ts`,
   implementing D44's `DiffTabSource`.
   - **Reading each side:**
     - `revision`: the engine's `loadCommitFile`, with `git show
       <ref>:<path>` as the fallback, as `DiffDocProvider` does;
     - `index`: D43's `readStagedFile`;
     - `workingTree`: read from disk through `resolveRepoFilePath`, never
       outside the repository;
     - `empty`: `""`;
     - a path missing on a side reads as `""`.
   - **Binary or too large:** binary on either side gives `binary`. Text
     larger than `diffEditor.maxFileSize` megabytes (0 means no limit)
     gives `tooLarge`.
   - **The diff:** call 22j's seam `diffTexts` with options taken from the
     user's settings: `ignoreTrimWhitespace` from
     `diffEditor.ignoreTrimWhitespace`, `maxComputationTimeMs` from
     `diffEditor.maxComputationTime`, `computeMoves: false`. Split both
     texts with D41's `splitLines`. Map the VS Code-shaped result into
     `DiffTabChange[]`; the mapping is a function of its own, so it can be
     tested.
   - **Logging:** one line per open, `logBackendRoute("diffTab",
     \`backend=engine read=<ms> diff=<ms> lines=<n>\`)`, with
     `hitTimeout=1` when the time limit was reached. D48 reads these.
2. **The context key.** Set `git-graph-libre.diffTabAvailable` with
   `setContext` on activation and whenever the backend setting changes. It
   is true only when the engine loaded, the backend setting allows it, and
   the addon exports `diffTexts`.
3. **Record the exception.** The tab is an engine-only feature, an
   exception to design rule 2. Add it to "The engine surface" record under
   Phase 16, the way the planned Statistics tab is recorded there.

## Touch

`src/extension/diffTab/engineSource.ts` (new), `src/extension.ts` (the
context key, ≤ 15 lines), `tests/webview/diffTab/engineSource.test.ts`
(new; only the webview test project mocks `vscode`), the Phase 16 record "The engine surface: what is wired, what was
removed, what is kept"

## Tests

With a fake addon:
- each side kind, and a missing path on a side;
- binary and too-large inputs;
- the mapping, on a result hand-written in VS Code's shape and, once D21
  is integrated, on one of its vendored fixtures;
- a working-tree path with `..` is refused;
- the context key is false without `diffTexts` and false on the `git-cli`
  backend;
- the route line.

## Acceptance

- Gates pass.
- On three fixture pairs, the mapped changes equal what `@vscode/diff`'s
  TypeScript backend gives, mapped the same way. The devDependency is used
  in the test only.

## Report

_(not started)_
