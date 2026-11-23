---
summary: >-
  F1-08: Makes the Reflog tab correct for linked worktrees (whose HEAD reflogs
  are separate), bare repositories and repository changes: the header names
  the worktree, the picker lists the other worktrees' HEADs, and the panel
  follows or closes with its repository.
---

# F1-08 — Worktrees and bare repositories

Status: done — awaiting integration

Needs: F1-05

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`070-history/230-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

`src/backend/queries/reflog.ts`; `src/extension/reflogTab/*`;
`src/webview/reflogTab/*`; reuse of `src/extension/worktreeDiscovery.ts` and
the worktree list query; the repository manager hooks the panel needs
(`src/extension/repoManager.ts`); the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- The header says whose HEAD is shown; the ref picker adds the other
  worktrees' HEADs (read in that worktree), marking locked or prunable ones.
- A bare repository shows branch reflogs with a note that Git keeps no HEAD
  reflog there by default.
- When the repository is removed or switched, the panel follows or closes;
  any engine handle the reflog read opened is closed (Phase 16 rule 5).
- Tests: a main and a linked worktree with different HEAD reflogs; a locked
  and a stale worktree; a bare repository; repository removal.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code (claimed and built `36a18e32`, `93dcc621`), continued by Gemini 4 Argon (agy) (`5093e820` and report), 2026-11-23 12:36
- **Branch and commits:** `reflog/F1-08` —
  - `36a18e32 G docs(kb): claim slice F1-08 (F1-08)`
  - `93dcc621 G feat(reflog): worktree HEADs, bare note and repo-removal close (F1-08)`
  - `5093e820 G test(reflog): cover worktree HEADs, bare note and repo removal (F1-08)`
  - plus this report commit.
- **Files changed:** 21 files, +957/−91 at `5093e820` (`git diff --stat 7db1d290..HEAD`):
  `l10n/bundle.l10n.json` (+1), `l10n/bundle.l10n.nl.json` (+1), `l10n/bundle.l10n.pl.json` (+1),
  `l10n/bundle.l10n.zh-cn.json` (+1), `l10n/bundle.l10n.zh-tw.json` (+1),
  `src/extension/commandManager.ts` (+2/−1), `src/extension/messageHandler.ts` (+5/−1),
  `src/extension/reflogTab/reflogData.ts` (+105/−6), `src/extension/reflogTab/reflogTabPanel.ts` (+39/−8),
  `src/extension/repoManager.ts` (+18), `src/reflogTabTypes.ts` (+93/−10),
  `src/webview/reflogTab/rowModel.ts` (+12/−5), `src/webview/reflogTab/view.ts` (+121/−19),
  `tests/backend/extension/repoManagerRemoval.test.ts` (new, +73),
  `tests/webview/reflogTab/fixtures.ts` (+31/−4), `tests/webview/reflogTab/main.test.ts` (+8/−2),
  `tests/webview/reflogTab/reflogData.test.ts` (+151/−7), `tests/webview/reflogTab/rowModel.test.ts` (+43/−11),
  `tests/webview/reflogTab/view.test.ts` (+158/−16), `tests/webview/reflogTabPanel.test.ts` (+81/−11),
  and this slice file.
- **Tests added or changed:** 15 new test cases across 5 test files:
  - `tests/webview/reflogTab/reflogData.test.ts`: +6 real-Git cases (`offers the other worktree's HEAD and reads its own HEAD reflog there`, `marks a locked worktree in the picker and still reads it`, `marks a stale worktree prunable and answers its read with an error, never an empty page`, `refuses a worktree path Git does not list, without reading there`, `releases only the other worktrees it read, once`, `calls a bare repository bare, keeps no HEAD reflog there, and reads its branches`).
  - `tests/webview/reflogTab/rowModel.test.ts`: +1 case (`keeps a worktree path only beside HEAD (F1-08)`).
  - `tests/webview/reflogTab/view.test.ts`: +3 cases (`names whose HEAD is shown and marks locked and missing worktrees in the picker`, `headers another worktree's HEAD with its folder and full path`, `tells the bare story only for a bare HEAD with no reflog`).
  - `tests/webview/reflogTabPanel.test.ts`: +2 cases (`closes with its repository when the manager removes it (F1-08)`, `releases the old source's worktrees when it follows a switch (F1-08)`).
  - `tests/backend/extension/repoManagerRemoval.test.ts` (new): +3 cases (`names the removed repository, and nothing else triggers it`, `fires for every repository a folder removal drops`, `stays silent after deregistering, and a new registration replaces the old`).
  - Count before and after: webview reflog suites went from 84 to 96 tests (8 files); full webview suite from 1,116 to 1,128 passed (85 files); full backend suite from 115 files (1,554 passed, 60 skipped) to 116 files (1,557 passed, 60 skipped).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 20 touched `.ts`/`.json` files — clean (0 errors, 0 warnings; only the pre-existing schema version info line).
  - `pnpm run typecheck` — clean.
  - `pnpm run l10n:check` — 100% complete across all 5 languages (866 bundle keys, 133 package.nls keys; `reflog.bareHeadNote` added inside the `reflog.*` block immediately before `reflog.action.commit`, translated into nl, pl, zh-cn, zh-tw by the agent; a native review would help).
  - `npx vitest run --project webview tests/webview/reflogTab/ tests/webview/reflogTabPanel.test.ts` — 8 files, 96 passed.
  - `npx vitest run --project backend tests/backend/extension/repoManagerRemoval.test.ts tests/backend/queries/reflog.test.ts` — 2 files, 71 passed.
  - `pnpm run test` — backend 116 files, 1,557 passed, 60 skipped (1,617 total); webview 85 files, 1,128 passed.
  - `node ./docs/kb/housekeeping.mjs --check` — clean (exit 0).
  - No `engine/**` files changed, so the Rust arm and addon rebuild did not apply.
  - Sonar: integrator.
- **Acceptance:**
  - *The header says whose HEAD is shown; the ref picker adds the other worktrees' HEADs (read in that worktree), marking locked or prunable ones* — **met**. When the repository has linked worktrees or another worktree's HEAD is selected, `.reflog-ref` shows `ui.worktreeHead` (`"HEAD of worktree {0}"`) with the full path in `title`; single-worktree `HEAD` and branch/stash refs render as before. `buildReflogRefs` appends non-current, non-bare worktrees from `readWorktrees` after `HEAD`, local branches, and `refs/stash` (RQ8), and `refLabel` marks locked (`ui.worktreeLocked` / `ui.worktreeLockedNoReason`) and prunable (`ui.worktreeMissing`) worktrees. `effectiveRepo` re-verifies `query.worktreePath` against `readWorktrees` (canonicalized) before rooting the read at that worktree, refusing unknown or prunable paths with a clear error page.
  - *A bare repository shows branch reflogs with a note that Git keeps no HEAD reflog there by default* — **met**. `buildReflogRefs` sets `bare: true` when the current worktree entry is bare; `emptyBlock` in `src/webview/reflogTab/view.ts` renders `.reflog-bare-note` (`reflog.bareHeadNote`) when `state.bare && state.query.ref === "HEAD" && state.query.worktreePath === null && state.reflogState === "none"`, while branch reflogs (and a bare `HEAD` that has entries) render normally.
  - *When the repository is removed or switched, the panel follows or closes; any engine handle the reflog read opened is closed (Phase 16 rule 5)* — **met**. Switching the panel to another repository resets the query/options and calls `source.releaseWorktrees()`, which calls `closeEngineRepository` on every other worktree path read by that source. Removing the repository from `repoManager` invokes `registerRepoRemovedCallback`, which disposes the panel (stopping the watcher, deregistering the callback, and calling `source.releaseWorktrees()`, while `repoManager.removeRepo` closes the tab repository's own engine handle).
  - *Tests: a main and a linked worktree with different HEAD reflogs; a locked and a stale worktree; a bare repository; repository removal* — **met** across `tests/webview/reflogTab/reflogData.test.ts`, `tests/webview/reflogTab/view.test.ts`, `tests/webview/reflogTab/rowModel.test.ts`, `tests/webview/reflogTabPanel.test.ts`, and `tests/backend/extension/repoManagerRemoval.test.ts`.
  - *Headless renders* — **met**. Rendered dark and light PNGs with PyQt6 QtWebEngine under `xvfb-run` (`QT_QPA_PLATFORM=xcb`) using the real `out/reflogTab.min.js` bundle and real `media/tokens.css` + `media/reflog-tab/reflog-tab.css`, inspected visually:
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-08/reflog-worktree-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-08/reflog-worktree-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-08/reflog-bare-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-08/reflog-bare-light.png`
- **Deviations from the slice:** Minimal 2-line glue at the two `openReflogTab` assembly sites (`src/extension/commandManager.ts` and `src/extension/messageHandler.ts`) to thread the existing `repoManager` into `ReflogTabDeps`, matching F1-03 and F1-09F. `src/backend/queries/reflog.ts` needed no edit because rooting the existing `readReflog` / `loadReflog` at the verified worktree path reads that worktree's own `HEAD` reflog directly.
- **Open questions / follow-ups:** None blocking. The `reflog.bareHeadNote` translations in `nl`, `pl`, `zh-cn`, and `zh-tw` are agent-translated (`ui.worktreeHead`, `ui.worktreeLocked`, `ui.worktreeLockedNoReason`, and `ui.worktreeMissing` reuse existing graph translations); a native review would help.
