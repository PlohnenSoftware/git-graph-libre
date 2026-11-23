---
summary: >-
  W12 · wave C · needs W10, W03, Y22 · TypeScript + Rust · ~200 lines: a
  worktree with a detached HEAD on a commit no branch reaches is invisible
  today, because both backends start the log from HEAD, the branches, tags and
  remotes only. Pass the other worktrees' HEAD commits as extra tips on both
  backends, with a parity test, and mark each such row "HEAD of worktree
  <folder>".
---

# W12 — Other worktrees' detached HEADs in the graph

Status: integrated `fbc0c22` (`2026-11-05`)
Needs: W10, W03 (the engine must accept the same tips)
Decisions: Y22 (show them by default, and whether a setting turns them off)
Kind: TypeScript and Rust, the Rust arm applies · Size budget: ~200 changed
lines outside tests
Source: the TypeScript worktree map (`2026-11-04`): `loadCommits` uses
`HEAD --branches`, not `--all`

## Facts (checked `2026-11-04`, `c47207e`)

- The CLI log starts from `--ignore-missing HEAD --branches`, plus
  `--tags`, `--reflog`, `--remotes` and `additionalRefs` when enabled
  (`src/backend/queries/loadCommits.ts:221`–`:226`).
- The engine's `resolve_tips()` (`engine/native/core/src/graph.rs:153`)
  mirrors it.
- Neither includes another worktree's HEAD, so a detached worktree on an
  unreachable or older commit is not drawn. An agent's worktree checked out
  `--detach` at a commit is the usual case.

## Steps

1. Read first how `additionalRefs` reaches both backends. Pass the other
   worktrees' HEAD hashes (from W10's list, detached entries only, since a
   branch HEAD is already a tip) as extra tips on the CLI, and through the
   engine's `load_commits` options, the same set on both.
2. Mark each such commit row "HEAD of worktree <folder>", with a marker
   distinct from the current HEAD's dot, using W11's segment style or a
   graph-node variant per Y22. Tooltip with the path. Add l10n.
3. Parity test: a fixture with a detached worktree on a commit only it
   reaches. Both backends include it, with identical rows.
4. Bump the engine version if the options shape changes.

## Touch

`src/backend/queries/loadCommits.ts`, `src/backend/engine/commits.ts`,
`engine/native/core/src/graph.rs` (tips), `engine/native/node/src/lib.rs`
(options), engine version files if bumped, `src/webview/main.ts` (row
marker), `media/*.css`, l10n bundles, `tests/**`

## Acceptance

A detached worktree's commit is drawn and marked on both backends, and the
parity test is identical.

## Report

- **Agent / date:** Muse Code powered by muse-wonder-full-1.0, 2026-11-05 19:40
- **Branch and commits:** `wt-1.10.0/W12` —
  `49240d6 G docs(release): claim W12, other worktrees' detached HEADs (W12)`;
  `50e31e0 G feat(engine): walk from the other worktrees' HEADs, engine 1.0.30 (W12)`;
  `a2bd356 G feat(worktrees): other worktrees' detached HEADs as CLI log tips (W12)`;
  `dab0982 G test(worktrees): detached worktree HEAD parity on both backends (W12)`;
  `c190e29 G feat(webview): mark other worktrees' detached HEAD rows (W12)`;
  `07d9f7f G test(webview): detached worktree HEAD marker and maps (W12)`;
  plus this report commit.
- **Files changed:** 18 files, +412/−16 against `1409d19` before this report
  commit: `engine/native/core/src/graph.rs` +34, `engine/Cargo.toml`/
  `Cargo.lock`/`package.json` version lines, `src/backend/engine/addon.ts`
  +5/−1, `src/backend/queries/loadCommits.ts` +44/−7, `src/webview/main.ts`
  +50/−1, `media/refs.css` +29, five `l10n/bundle.l10n*.json` +1 each,
  `src/extension/webviewL10n.ts` +1 (see Deviations), tests +248
  (`linkedWorktree.test.ts` +43/−1, `branchWorktrees.test.ts` +46, new
  `worktreeHeadMarker.test.ts` +159), this slice file. About 164 lines
  outside tests, inside the ~200 hint.
- **Tests added or changed:** 4 new tests. Backend parity
  (`linkedWorktree.test.ts`, 5 → 6): "shows another worktree's detached HEAD
  commit, the same on both backends" over the W40 awkward-path fixture.
  Webview (`branchWorktrees.test.ts` 4 → 6, new `worktreeHeadMarker.test.ts`
  1): `detachedWorktreeHeadMap`/`worktreeFolderName` units and a full page
  load asserting the marker row, folder label and path tooltip. Focused set
  before: 44 backend (39 loadCommits queries + 5 linkedWorktree), 4 webview;
  after: those files 45 and 7. Full suite after: backend 1331 passed (102
  files), webview 865 passed (69 files).
- **Gates:** strict Biome (`biome.strict.jsonc --error-on-warnings`) on every
  touched `.ts`/`.json` — clean; `pnpm run typecheck` — clean; `pnpm run
  test` — 1331 + 865 passed, no failures; `pnpm run l10n:check` — "All
  translations are complete"; `pnpm run kb:check` — passed on this
  report before its commit; Rust arm
  `engine:fmt`, `engine:lint`, `engine:check` OK, `engine:test` 228 passed
  0 failed; `pnpm run engine:build` then `engine:smoke` — reports
  `engineVersion()` 1.0.30. Headless render of the badge with PyQt6
  QtWebEngine + `xvfb-run` against the real `media/*.css`, dark and light:
  dashed folder badge aligned with the ref badges, readable in both
  (probe left in `/tmp/w12-shot/`). Sonar: integrator.
- **Acceptance:** "A detached worktree's commit is drawn and marked on both
  backends, and the parity test is identical." — Met. Drawn: the parity
  test asserts Carol's detached-only commit appears from the main, branch
  and detached worktrees on the CLI query and through the engine reader
  (`didEngineServeRead()` true), and in neither on a branch-filtered load.
  Identical: the same test compares the full masked node lists with
  `toEqual` on every worktree, filtered load included. Marked: the
  webview render test asserts exactly one `.worktreeHeadRef` on the
  detached commit's row reading "HEAD of worktree <folder>" with the full
  path as `title`, and the screenshots above show it in both themes.
- **Deviations from the slice:** (1) The tips are discovered inside each
  backend — the CLI reads the worktree list in `loadCommits`
  (non-current detached entries' hashes beside the unreachable hashes),
  the engine enumerates `worktrees/<id>/HEAD`/`main-worktree/HEAD` in
  `graph.rs` — instead of being passed from W10's webview list through
  `load_commits` options. No file in the Touch list can carry hashes into
  either backend (`src/backend/engine/index.ts`, `messageHandler.ts` and
  `engine/native/core/src/types.rs` are outside it), and W40 set the
  internal-discovery precedent (`log.rs` `other_worktree_heads`). The
  resulting tip sets are equal: the engine names branch HEADs too, which
  are already tips and drop out as duplicates. `lib.rs` therefore
  untouched. (2) The engine version still bumps to 1.0.30: the options
  shape is unchanged, but TypeScript relies on the new tips for parity and
  a 1.0.29 binary would silently omit them. (3) `src/extension/
  webviewL10n.ts` gained one line exposing `ui.worktreeHead`; without it
  no localized string can reach the webview (the W21 precedent).
  (4) W11 is not integrated yet, so there is no segment style to reuse:
  the marker is its own dashed badge with the `file-directory` icon Y4
  chose (the existing `closedFolder` octicon, so no icon file changed).
- **Open questions / follow-ups:** When W11 lands its branch-badge segment,
  the integrator may want the detached-HEAD badge restyled to match; that
  is a W11 decision, not needed for W12's acceptance. Nothing else.
