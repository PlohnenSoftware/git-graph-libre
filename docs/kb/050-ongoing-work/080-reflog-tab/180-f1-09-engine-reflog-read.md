---
summary: >-
  F1-09: Serves the reflog read from the Rust engine (gix) when the engine is
  allowed, with the CLI query as the reference and fallback, proven by a
  cross-backend parity test. No visible change.
---

# F1-09 — Reflog read through the engine

Status: integrated `b5a3ae7e`

Needs: F1-03

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
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

New `engine/native/core/src/reflog.rs`; `engine/native/core/src/lib.rs`,
`types.rs`, `api.rs` as needed; `engine/native/node/src/lib.rs` (the export);
new `engine/native/core/tests/reflog.rs`; `src/backend/engine/addon.ts` (the
optional export's types; not `EXPECTED_ENGINE_VERSION`); new
`src/backend/engine/reflog.ts` (the reader that tries the engine and falls
back to the CLI); `src/backend/engine/index.ts` if the reader seam needs it;
the call site in `src/extension/reflogTab/*` that reads the reflog; new
`tests/backend/engine/reflogParity.test.ts`; the slice file's Status and
Report.

## Task and acceptance

- The engine reads a ref's reflog with gix and maps it into this project's
  reflog entry type at the seam. The export is optional: a binary without it
  means "engine unavailable for this read", and the CLI serves it.
- The read follows the existing engine routing: the `backend` setting, the
  repository's verification, CLI fallback on `NotARepository`/`Unsupported`.
  Entry states (F1-02) may stay on the CLI; say which in the Report.
- Parity: over every F1-01 fixture (amend, rebase, merge, checkout, reset,
  detached HEAD, linked worktree, no reflog, expired entries, paging), the
  engine and the CLI return identical entries in identical order; malformed
  reflog lines must not diverge silently (decline instead).
- Measure the read on this repository with a release build and record the
  numbers.
- Runs beside F1-04 (no shared files) and is integrated before F1-05.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-09 03:52
- **Branch and commits:** `reflog/F1-09`
  - `f8a9806a G docs(kb): claim slice F1-09 (F1-09)`
  - `935f25b1 G feat(engine): read a ref reflog with gix (F1-09)`
  - `5f4550c7 G test(engine): reflog parity against git log -g (F1-09)`
  - `6f6515b2 G feat(reflog): engine-first reflog reader with CLI fallback (F1-09)`
  - `22d771d7 G feat(reflog): feed the tab through the engine-first reader (F1-09)`
  - `3d4e7983 G fix(engine): selector indexes rise down a reflog page (F1-09)`
  - `e0092f15 G test(engine): cross-backend reflog parity suite (F1-09)`
  - `7fb2b785 G fix(engine): keep reflog offsets inside the export range (F1-09)`
  - the report commit that follows this text
- **Files changed:** `engine/native/core/src/reflog.rs` (new, +321), `engine/native/core/src/lib.rs` (+1), `engine/native/node/src/lib.rs` (+28/−2 with formatting), `engine/native/core/tests/reflog.rs` (new, +516), `src/backend/engine/addon.ts` (+11, `EXPECTED_ENGINE_VERSION` untouched), `src/backend/engine/reflog.ts` (new, +178), `src/extension/reflogTab/reflogData.ts` (+26/−5), `tests/backend/engine/reflogParity.test.ts` (new, +514), this slice file. `types.rs`, `api.rs` and `src/backend/engine/index.ts` needed no change (the wire types live in `reflog.rs` like the worktree list's, the node export calls the module directly, and the reader reuses `isEngineFallbackError`).
- **Tests added or changed:** 14 Rust tests in `engine/native/core/tests/reflog.rs` and 41 TypeScript tests in `tests/backend/engine/reflogParity.test.ts` (both files new, 0 before). No existing test changed.
- **Gates:** every cargo command with `CARGO_TARGET_DIR=/home/zam/Desktop/prog/_GGL/.ggl-reflog-targets/f1-09` and `CARGO_BUILD_JOBS=8`.
  - `pnpm run engine:fmt && pnpm run engine:lint && pnpm run engine:check`: clean.
  - `pnpm run engine:test` (whole workspace): every suite `ok`, including the new `reflog` suite (14 passed).
  - `pnpm run engine:build` (debug) before the TypeScript engine tests, and `pnpm run engine:build:release` for the measurement: both built; the worktree binary is currently the release one.
  - `npx vitest run --project backend tests/backend/engine/reflogParity.test.ts`: 41 passed. With the touched area (`addon.test.ts`, `queries/reflog.test.ts`): 140 passed in 3 files.
  - `npx vitest run --project webview tests/webview/reflogTab/reflogData.test.ts`: 6 passed (unwired, so still the CLI path).
  - `pnpm run typecheck`: clean (all three `tsc` projects).
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the four touched `.ts` files: clean. Biome prints the known informational note that the config schema is 2.5.13 and the CLI is 2.6.5, as in F1-01.
  - `node docs/kb/housekeeping.mjs --check`: exit 0.
  - Sonar: integrator.
- **Acceptance:**
  - Engine reads with gix, seam maps into `GitReflogResult`, export optional with no version bump: met (`load_reflog` in `engine/native/node/src/lib.rs`, `loadReflog?` in `addon.ts` absent from the shape check, `readReflog`/`parseEngineReflogPage` in `src/backend/engine/reflog.ts`).
  - Routing as the other reads (`backend` setting live per call, verified repositories only, CLI on `NotARepository`/`Unsupported`/`Untrusted` declines and on any other throw or malformed payload, `[route] operation=loadReflog …` lines): met in the reader and in `reflogData.ts`'s forwarding. No telemetry flag is touched, like the worktree listing: `view.engineBackend` still comes only from the graph reader's session flag on the commit-load path, so no event or declaration was needed. The two assembly sites that pass the live deps are outside this slice's Touch; see Deviations.
  - Entry states (F1-02) stay on the CLI: yes, unchanged. The reader replaces only `loadReflog`; `reflogData.ts` still joins states from `loadReflogEntryStates`.
  - Parity over the F1-01 scenarios, malformed lines declining: met, pinned per scenario below in both test suites.
  - Release-build measurement on this repository: met, numbers below.
  - No user-visible change, no new strings: met. With no deps wired, every page is the CLI's; once wired, engine and CLI results are identical by the parity suites.
- **Deviations from the slice:**
  - **Production wiring of the live deps is left for integration.** `createReflogSource` now accepts optional `backend` and `isVerified` and forwards them, but the only callers that hold them, `src/extension/messageHandler.ts` (its default `openReflog`) and `src/extension/commandManager.ts` (`openReflog`, which has no verification dep today, so it also needs `src/extension.ts` or an `openReflogTab` assembly like `openScmDiffTab`'s), are outside this slice's Touch list, so I did not edit them. Until the integrator passes `backend: () => config.backend()` (messageHandler's live `config`) and `isVerified: (repo) => repoSearch.isVerified(repo)`, the tab reads on the CLI exactly as before F1-09; the engine path is proven by the parity suites through `readReflog` directly. This is the W10 → W10F shape and needs the integrator's Touch expansion or a follow-up slice.
  - The whole reflog file is read per page (gix's forward iterator buffers it), because selector indexes and `hasMore` are counted over the whole file. The reverse iterator's fixed 4 KiB sliding window can fail a longer line, so it is not used. On this repository (499 entries) the full read costs about 3 ms warm, so the page size barely matters; a much larger log costs in proportion to its size on both backends.
  - Any engine throw routes to the CLI (the worktree-listing pattern for optional exports), not only the three decline kinds the graph reader retries on: the CLI's result, error wording included, is then what the caller gets on either backend setting. Declines log `reason=declined`, other throws `reason=engineThrew`.
- **Open questions / follow-ups:**
  - The wiring above (integrator: `messageHandler.ts`, `commandManager.ts`, `extension.ts`).
  - F1-01's minimum-Git question touches this slice once wired: the CLI tells `empty` from `none` with `git reflog list` (Git 2.46) and reads `empty` on older Git, while the engine always distinguishes by file existence. On a Git older than 2.46, engine-on could therefore say `none` where the CLI says `empty` (no reflog file, empty page). No older Git was available to run here either; the maintainer's minimum-Git decision settles whether this needs a guard.
  - One session accident, repaired at once and recorded for honesty: my first claim edit landed in the main checkout (relative tool paths resolve there, not to the worktree). I restored that one file in the main checkout with `git restore` in the same minute (its status is clean again, the claim was redone in the worktree as `f8a9806a`), and used absolute worktree paths afterwards. No other file outside the worktree was touched; the measurement only read the main checkout's repository.

### Design in short

The optional napi export `load_reflog(path, ref, limit, offset)` returns one page as JSON (`{entries, state, hasMore, ref}`). Rust resolves the requested name in Git's lookup order over full names (`HEAD` stays `HEAD`), reads the whole reflog file oldest-first, counts every parsed line for selector indexes (`index = total − 1 − position`), shows only entries whose new id is a stored commit (null targets counted, not shown), and pages over the shown entries newest-first. TypeScript normalizes and validates the request exactly as the CLI query does before the engine is offered it, then strictly guards the payload (hash shape, strictly rising indexes, state consistency, page length against `hasMore`) before mapping it into `GitReflogResult`.

### Parity verdict per scenario family

Engine serves, result identical entry for entry (hash, index, entry time, identity, message, order, `hasMore`, full ref): plain commits, amend, checkout, fast-forward and no-ff merges, reset; rebase replay with picks; the branch-rename selector-gap case (`[0, 1, 3, 4, 5]`, also in a window past the gap); entry time distinct from commit time; paging across a boundary, exact-end and past-end (state stays `entries`), oversized limit clamped; detached HEAD; `refs/stash` by full and short name; linked worktrees (each HEAD log from its own worktree, branch logs shared); a tag's `none`; an expired branch reflog's `empty`; an unborn `HEAD`'s `none`; a branch's `none` under `core.logAllRefUpdates=false` and in a bare repository.

Engine declines, CLI result is what the caller gets (identical by construction, route line pinned): every `HEAD` read whose own log file is missing or empty (expired `HEAD`, `core.logAllRefUpdates=false`, bare `HEAD`, a deleted `logs/HEAD`), because Git then answers from the branch log; a malformed or blank reflog line (Git skips it uncounted); a fabricated entry pointing at a missing object or a tree (Git counts it, does not show it); symbolic refs (Git resolves before choosing a log, including `rev-parse --symbolic-full-name` following them); unknown refs, hashes and revision expressions (the CLI's error); requests the CLI refuses (leading dash, zero limit, offset past `u32`), which never reach the engine.

### Verified Git and gix facts (Git 2.56.0, gix at `f06f106`, scratch repositories and source)

- `git log -g` numbers selectors over every parseable reflog line, including lines it does not show: a null new id (the branch-rename pair inside `logs/HEAD`), a missing object and a tree object all keep their number and are skipped. An unparseable or blank line is skipped *without* counting. An entry whose new id is an annotated tag object suppresses the whole `log -g` listing for that ref in the probe (exit 0, no rows), which is why any non-commit target declines the whole read rather than being skipped.
- With `logs/HEAD` missing or truncated empty and HEAD on a branch, `git log -g HEAD` reads that branch's reflog under `HEAD@{N}` selectors; detached or both-files-gone reads empty. gix has no such fallback (it opens `logs/<name>` only), so the engine declines exactly there.
- `rev-parse --verify --quiet --symbolic-full-name <alias>` follows a symbolic ref to its target's full name, so the CLI reads the target's log for an alias; the engine declines a symbolic ref instead of copying that.
- `git update-ref` to the current value writes no reflog entry at all, so no-move entries need no special handling; duplicate commit hashes across entries are shown by both backends.
- gix's forward reflog iterator yields one `Result` per line and continues past decode failures, returns `None` only when the file is absent (an empty file is `Some` with no lines), and parses the signature's stored Unix seconds, which is the entry's own time the CLI reads through `%gd` under `--date=unix`. The reverse iterator parses through a fixed 4 KiB buffer and warns that longer lines will probably fail, so the forward iterator is the one to build on.

### Measurements (release build, this repository)

Main checkout `/home/zam/Desktop/prog/_GGL/git-graph-libre` read-only, `HEAD` reflog 499 lines (95 KiB, 499 shown, no gaps), branch `main` log 133 lines, Git 2.56.0. Direct release addon against the CLI query's exact git spawns (one `rev-parse`, then both `log -g` passes concurrently; warm, 50 runs, two process runs): page of 200, engine median 2.74–2.79 ms against CLI spawns 5.20–5.50 ms; full page of 499 (`limit` 1000), engine 2.93–3.09 ms against 7.71–7.83 ms; cold first engine call including open 3.9–4.0 ms; `main` page of 200 through the engine 0.90–0.94 ms. End to end through TypeScript (30 runs, results asserted identical): `readReflog` median 3.00 ms against `loadReflog` 7.11 ms for a page of 200 (about 2.4×), and 3.36 ms against 10.05 ms for the full log (about 3×). Scripts: `/tmp/f109-bench.cjs` (kept, uncommitted) and a one-off vitest bench that was deleted after the run.

### Public API

- Rust: `git_graph_core::reflog::read_reflog(&Repo, requested, limit, offset)` returning `ReflogPage` (`ReflogEntry`, `ReflogState`); napi `loadReflog(repoPath, ref, limit, offset)`.
- TypeScript: `readReflog(git, repo, request?, deps?, record?)` and `parseEngineReflogPage(payload, limit)` in `src/backend/engine/reflog.ts`; optional `EngineAddon.loadReflog` in `addon.ts`; optional `backend`/`isVerified` on `ReflogSourceDeps` in `src/extension/reflogTab/reflogData.ts`.
