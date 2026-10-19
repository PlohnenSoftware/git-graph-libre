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

Status: integrated 7808816
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

- **Agent / date:** Muse Code (muse-wonder-full-1.0, general-purpose, inherited runtime model; no Haiku/Sonnet/Opus selector in this runtime — the integrator records it), 2026-10-19 16:22 Europe/Warsaw.
- **Branch and commits:** `diff-1.9.0/d45` from `f1d8f94`, all `G`, no push — `eefe818 G docs(release): claim D45 (D45)`; `dfb938d G feat(diff-tab): feed the tab from the engine (D45)`; `ec1fa8a G feat(diff-tab): set the diffTabAvailable context key (D45)`; `073ee18 G docs(engine): record the GGL Diff tab engine-only exception (D45)`; `c74b5d4 G test(diff-tab): cover the engine source sides, limits and fixtures (D45)`; `052e015 G test(extension): stub executeCommand for activation's setContext (D45)`; plus the signed report commit carrying this section.
- **Files changed:** `src/extension/diffTab/engineSource.ts` (new, +372/−0), `src/extension.ts` (+3/−0: the import, activation, and the backend-change branch), the Phase 16 engine-surface record (+12/−0), `tests/webview/diffTab/engineSource.test.ts` (new, +534/−0), `tests/backend/extension/gitPathRescan.test.ts` (+2/−1, see Deviations), this slice file (claim, status, report). Changed lines outside tests, this slice file excluded as in D44's count: 387 against the ~220 guide (see Deviations).
- **Tests added or changed:** `tests/webview/diffTab/engineSource.test.ts`, 19 tests, all repositories from `makeRepo()`. Webview 707 → 726; backend unchanged at 1045 (one mock stub, no new or changed assertion).
- **Gates:** biome strict clean (`biome check --config-path biome.strict.jsonc --error-on-warnings` on the 4 touched code/test files); typecheck pass (all three projects); focused: the new suite 19/19, `gitPathRescan` 6/6; full `pnpm run test` backend 1045/1045, webview 726/726 in this worktree with the addon built (`pnpm run engine:build` + `engine:smoke` OK at 1.0.26, so the three real-engine fixture tests ran, none skipped); `pnpm run l10n:check` 100% (no strings added); `pnpm run kb:check` pass; `pnpm run package` pass (`biome lint .` 313 files; `out/diffTab.min.js` still 8,388 bytes — the source is extension-host only); Rust arm n/a (no `engine/**` change); Sonar: integrator. Cognitive complexity, estimated by hand as in 22j's report: highest `readRevisionFromEngine` at about 10, `loadDiffTab` about 5, every other new function at most 6 — all under 16; no nested ternary in the new code.
- **Acceptance:** "Gates pass" — met, numbers above. "On three fixture pairs, the mapped changes equal what `@vscode/diff`'s TypeScript backend gives, mapped the same way" — met for `minimal-diff-character`, `deletion` and `indentation` through the real built addon (vendored fixtures written to a temporary repository's working tree, D21's EOL normalization, settings pinned to the oracle's `ignoreTrimWhitespace: false` and no time limit); `@vscode/diff` appears in the test only (`grep` over `src/`: 0). Every item under *Tests* is covered: each side kind (`revision` via the engine and via the `git show` fallback, `index` via D43's `readStagedFile`, `workingTree` from disk, `empty`) and a missing path on each kind reading as `""`; binary (engine revision marker, staged marker, NUL bytes on disk) and `tooLarge` (past `maxFileSize`, and no limit at 0); the mapping on a hand-written VS Code-shaped result (`innerChanges: null` → `inner: []`) and on the three fixtures; a working-tree `..` path refused as an `error` payload; the context key false without `diffTexts`, false with no addon, and false on the `git-cli` backend without loading the addon; the route line (`backend=engine read=<ms> diff=<ms> lines=3`, exactly one `diffTab` line, `hitTimeout=1` when set). Nothing throws to the panel: an addon without `diffTexts` and a rejecting diff both answer `{ kind: "error", message: "diff engine unavailable" }`.
- **Deviations from the slice:** (1) **Size:** 387 changed lines outside tests against the ~220 guide. The 372-line new file carries the four side readers (the revision reader mirrors `DiffDocProvider`'s engine-or-CLI shape but keeps binary a valid answer, like D43), settings, mapping and availability, expanded by the strict formatter; no line was folded to flatter the count, per the size-as-guide rule. (2) **One test file outside *Touch*:** `tests/backend/extension/gitPathRescan.test.ts` gained an `executeCommand` stub (+2/−1) after the full suite showed its hand-written `vscode` mock — the only activation suite — lacked the function activation now calls for `setContext`; no assertion changed, taken under the protocol's test-file allowance. (3) **Route lines for the non-diff payloads**, which the slice does not spell out: `binary`/`tooLarge` log `backend=engine read=<ms> diff=0 lines=0 result=…`; unavailable, refused and read-failed opens log `backend=cli reason=… read=<ms> diff=<ms> lines=<n>` (the seams' existing not-the-engine shape). On a successful diff the line is exactly the slice's; `lines` is the sum of both sides' split lines. (4) **Unreadable settings fall back to VS Code's defaults** (`ignoreTrimWhitespace` true, `maxComputationTime` 5000, `maxFileSize` 50, validated like D44's counts); a real host serves the schema defaults anyway. (5) `resolveRepoFilePath` is duplicated in small from `messageHandler.ts` (private there, outside *Touch* to export), with a comment naming the rule. (6) **Wave gate 4's `S3358` in `diffTabPanel.ts`: already gone** — D22F2 turned it into a plain if/else (`44e3964`); only single ternaries remain there, and this slice does not touch that file. No dependencies, suppressions, telemetry or l10n changes.
- **Open questions / follow-ups:** none blocking. What D46 and D47 inherit: `createEngineDiffTabSource({ gitPath: config.gitPath, backend: config.backend, isVerified: (repo) => repoSearch.isVerified(repo) })` — pass the live deps, since the defaults fail closed (`"git"`, `git-cli`, unverified); `isDiffTabAvailable({ backend: config.backend })` for D47's fallback decision (a context key cannot be read back), defaulting to `typeof loadEngineAddon()?.diffTexts === "function"`; the context key is already set on activation and on backend-setting changes, so D46 only needs its manifest `when` clauses. Payload semantics as tested above; `openDiffTab` unchanged. For D48: the `read=`/`diff=` fields are on the one `operation=diffTab` route line per load, with `hitTimeout=1` appended when the limit was hit. There is still no entry point, as this slice intends.
