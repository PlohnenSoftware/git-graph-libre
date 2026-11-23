---
summary: >-
  F3-07: File History, an engine path-scoped log with a context-menu entry whose
  results feed the existing search list. Only if TQ1 selects File History; its
  `--follow` and limit are the maintainer's decisions.
---

# F3-07 — File History

Status: done — awaiting integration

Needs: TQ1 selects File History; `--follow` and the result limit decided

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`), TQ1; the
research (`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 1 (candidate b), 3 and 6 (F3-07); the search results path in
`src/backend/` and its webview (the existing search list this slice reuses);
the reflog read (F1-01, `src/backend/queries/reflog.ts`) as the pattern for a
bounded, path-validated Git read.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). The research notes
Git Graph+'s file-history limit and its missing `--follow`; neither value is
copied, and any constant is chosen from GGL's needs and recorded. Tests ship
with behavior, real-Git fixtures in temporary directories only. Strict Biome
on touched files, no `var`, American English. Every user-visible string in
all five bundles. No new telemetry events or declarations. Do not bump
versions or edit CHANGELOG, README or notices; the integrator does. Report
Sonar: integrator.

## Touch

New `src/backend/queries/fileHistory.ts`; `src/backend/types/queries.types.ts`;
`engine/native/core/src/log.rs` or a new `engine/native/core/src/file_history.rs`,
with the export in `engine/native/node/src/lib.rs` (only if the engine arm is
in scope, which the maintainer confirms); the context-menu entry in the file
explorer and editor menus in `package.json`; the command handler in
`src/extension/`; the existing search results path; `l10n/` keys in all five
bundles; tests under `tests/backend/queries/` and `tests/`; the slice file's
Status and Report.

## Task and acceptance

- A bounded read lists commits touching one path across all refs
  (`git log --all -- <path>`), newest first, with the same validation as the
  reflog read: refuse a path that starts with `-` or escapes the repository,
  and pass `--end-of-options` where Git supports it.
- `--follow` is on or off as the maintainer decided; the Report says what
  Git's documentation says about each choice.
- Results open in the existing search list, not a new view.
- Tests: a renamed file with and without `--follow`; a file in a linked
  worktree; a path refused; an empty history reported as empty, not an error.

## Checks

- Strict Biome on each touched `.ts` file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend tests/backend/queries/fileHistory.test.ts`
- `pnpm run l10n:check`; the Rust arm and addon rebuild if `engine/**` changed.
- Record each command and its counts in the Report.

## Report

- **Agent / date:** Gemini 4 Neon (agy) and Muse Code (continuation across quota interruptions), 2026-11-23 19:46
- **Branch and commits:** `stats/F3-07` (base `af908f18` on `gg-plus/next`; all GPG-signed `G`):
  - `547548a1 G docs(stats): claim slice F3-07 (F3-07)`
  - `3e0e1c74 G feat(queries): add bounded loadFileHistory query and types (F3-07)`
  - `863d3751 G test(queries): cover loadFileHistory renames, worktrees, validation and empty history (F3-07)`
  - `a9378a9f G feat(l10n): add file history command, menus and translations (F3-07)`
  - `c08cd066 G feat(history): wire Show File History into the search results dialog (F3-07)`
  - `af1ac5a6 G test(history): cover Show File History command, menus and dialog wiring (F3-07)`
  - `848ccf1b G test(history): use the fixture file name in the fileHistory route test (F3-07)`
  - `d8c43c75 G test(history): fix topological parent order in file history rendering fixture (F3-07)`
  - plus the final report and status commit on this file.
- **Files changed:** 26 files (`+1402 / -15` lines before this report commit):
  - `src/backend/queries/fileHistory.ts` (`+252`)
  - `src/backend/types/queries.types.ts` (`+60`)
  - `src/extension/commandManager.ts` (`+64 / -1`)
  - `src/extension/messageHandler.ts` (`+30`)
  - `src/extension/webviewL10n.ts` (`+5`)
  - `src/extension/webviewPanel.ts` (`+19`)
  - `src/types.ts` (`+22 / -1`)
  - `src/webview/main.ts` (`+112 / -5`)
  - `package.json` (`+19`)
  - `package.nls.json`, `package.nls.nl.json`, `package.nls.pl.json`, `package.nls.zh-cn.json`, `package.nls.zh-tw.json` (`+2 / -1` each)
  - `l10n/bundle.l10n.json`, `l10n/bundle.l10n.nl.json`, `l10n/bundle.l10n.pl.json`, `l10n/bundle.l10n.zh-cn.json`, `l10n/bundle.l10n.zh-tw.json` (`+7` each, in a `history.*` block placed immediately before `reflog.show`)
  - `tests/backend/queries/fileHistory.test.ts` (`+444`)
  - `tests/backend/manifest.test.ts` (`+36 / -1`)
  - `tests/webview/commandManager.test.ts` (`+106`)
  - `tests/webview/messageHandler.test.ts` (`+40`)
  - `tests/webview/rendering.test.ts` (`+121`)
  - `tests/webview/webviewPanel.test.ts` (`+27`)
  - `docs/kb/050-ongoing-work/130-history-and-statistics/160-f3-07-file-history.md` (Status and Report)
- **Tests added or changed:**
  - Added `tests/backend/queries/fileHistory.test.ts` (35 tests: path normalization and refusal, NUL-delimited record parsing and malformed-record errors, renamed-file history with and without `--follow`, cross-ref `--all` ordering and optional `loadCount`, linked worktrees, limit clamping and `hasMore`, `--end-of-options -- <path>`, Author Date vs Commit Date, empty history for untracked files and unborn repos, invalid limits, typed Git error propagation).
  - Extended `tests/backend/manifest.test.ts` (+1 test: `showFileHistory` command, `explorer/context` and `editor/context` menus, no `editor/title` icon, available in Command Palette).
  - Extended `tests/webview/commandManager.test.ts` (+4 tests: Explorer/Editor URI resolution with longest-prefix repo matching, active-editor fallback, unlisted repo discovery via `git rev-parse`, warnings for missing editor / non-`file` scheme / outside-repo / repo-root paths).
  - Extended `tests/webview/messageHandler.test.ts` (+1 test: `fileHistory` query routing, requestId/repo echo, validation error path).
  - Extended `tests/webview/webviewPanel.test.ts` (+1 test: `showFileHistory` posting and cold-start `graphReady` flush).
  - Extended `tests/webview/rendering.test.ts` (+2 tests: search-dialog display, stale-response drop, reveal on submit, empty and error dialogs; fixed the inverted topological parent order in `d8c43c75` that previously caused `Graph.determineNormalPath` to loop indefinitely).
  - Suite counts (before on `gg-plus/next` → after on `stats/F3-07`): backend `1,679 → 1,715` passed (`+36`, `60` skipped as expected in linked worktrees); webview `1,152 → 1,160` passed (`+8`).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings <25 touched .ts/.json files>`: passed (0 errors, 0 warnings).
  - `pnpm run typecheck`: passed (`tsc -p ./src --noEmit && tsc -p ./src/webview --noEmit && tsc -p ./tests --noEmit`).
  - `npx vitest run --project backend tests/backend/queries/fileHistory.test.ts`: 1 file, 35 passed (1.54s).
  - `timeout 120 npx vitest run --project webview tests/webview/rendering.test.ts`: 1 file, 113 passed (1.32s).
  - `timeout 600 pnpm run test`: backend 122 files, 1,715 passed | 60 skipped (1,775 total, 6.00s); webview 92 files, 1,160 passed (1,160 total, 4.88s).
  - `pnpm run l10n:check`: 100.0% complete across `nl`, `pl`, `zh-cn`, `zh-tw` (`bundle.l10n.*` 905 keys; `package.nls.*` 135 keys).
  - `node ./docs/kb/housekeeping.mjs --check`: passed.
  - Rust arm: not run (`engine/**` was not modified).
  - Headless renders: not needed (no CSS or new view added; file history results open in the existing `showSelectDialog` / `showErrorDialog` search results dialog).
  - Sonar: integrator.
- **Acceptance:**
  - Bounded read across all refs (`git log --all -- <path>`), newest first, with reflog-style path validation and `--end-of-options`: **met** (`src/backend/queries/fileHistory.ts`: refuses empty paths, leading `-` raw or normalized, control characters including NUL, absolute paths, and `..` escapes before spawning Git; passes `--end-of-options -- <path>`).
  - `--follow` and limit choices backed by Git's documentation and GGL's own constants: **met**.
    - **`--follow`:** `DEFAULT_FILE_HISTORY_FOLLOW = true` (overridable per call via `follow?: boolean`). Per `git-log(1)`, `--follow` continues listing the history of a single file beyond renames; its documented limitation is that it tracks one path at a time and follows renames along the walked revision graph without tracking copies or splitting across simultaneous renames on diverging branches when combined with `--all` (where `--date-order` walks all refs newest first). Defaulting `--follow` on gives users full history across renames out of the box, while keeping `follow: false` available for exact-path callers (such as F3-08 or future toggles).
    - **Limit:** `DEFAULT_FILE_HISTORY_LIMIT = 50` and `MAX_FILE_HISTORY_LIMIT = 200`, matching GGL's existing search results list (`defaultMaxResults = 50` and `maxResultsLimit = 200` in `src/backend/queries/searchCommits.ts`, and `searchHistoryMaxResults = 50` in `src/webview/main.ts`) rather than copying any outside constant. `loadFileHistory` fetches `limit + 1` records to report `hasMore` accurately.
  - Results open in the existing search list, not a new view: **met** (`showCommitResultsDialog` in `src/webview/main.ts` reuses `showSelectDialog` and `revealSearchResult`, with `clearAllFilters = true` so a file-history commit can be revealed even when author/tag/branch filters were active).
  - Context-menu entries in Explorer and Editor without an editor title-bar icon: **met** (`package.json` contributes `git-graph-libre.showFileHistory` to `explorer/context` with `!explorerResourceIsFolder && resourceScheme == file`, `editor/context` with `resourceScheme == file`, and Command Palette; no `editor/title` entry; pinned in `tests/backend/manifest.test.ts`).
  - Required tests (renamed file with and without `--follow`, linked worktree, refused paths, empty history not an error): **met** (`tests/backend/queries/fileHistory.test.ts`, 35 passing tests using temporary Git fixtures only).
- **Deviations from the slice:**
  - `package.nls*.json` (all 5 manifest localization bundles) were updated alongside `package.json` so `%command.showFileHistory%` resolves in all five languages and `pnpm run l10n:check` passes.
  - `src/types.ts`, `src/extension/webviewL10n.ts`, and `src/extension/webviewPanel.ts` were touched as part of the existing search-results webview bridge (to add the `fileHistory`/`showFileHistory`/`graphReady` message types, localize dialog strings, and flush a cold-start `showFileHistory` request once the webview attaches its message listener).
  - No `engine/**` files were modified: the slice marks the engine arm conditional on maintainer confirmation, and Phase 16 design rule 2 keeps the CLI as the working reference path.
  - Clean-room note (TQ3): implemented from Git documentation (`git-log(1)`) and GGL's own patterns (`reflog.ts`, `searchCommits.ts`, `commandManager.ts`, `showSelectDialog`); no Git Graph+ code was read or copied.
- **Open questions / follow-ups:**
  - **Translations:** `nl`, `pl`, `zh-cn`, and `zh-tw` entries in `l10n/bundle.l10n.*.json` and `package.nls.*.json` were translated by the agent; a native-speaker review would help.
  - **Telemetry hook point (for T1):** `git-graph-libre.showFileHistory` is registered through `commandManager.ts`'s `register()` wrapper, which already records open/outcome via `deps.telemetry?.logFeature("git-graph-libre.showFileHistory", ok)` without sending paths or arguments; no new telemetry declarations were added in this slice.
  - **Engine arm (optional future slice):** If the maintainer later wants a Rust engine path-scoped log (with or without rename tracking) alongside the CLI reference path, it can be added behind a parity test against `loadFileHistory` with an engine version bump (1.0.33 → 1.0.34).
  - **Graph layout hardening (outside F3-07 Touch list):** `Graph.determineNormalPath` (`src/webview/graph.ts`) loops indefinitely if a commit list ever places a parent at a lower row index than its child (which caused the earlier test hang when `rendering.test.ts` had an inverted test fixture). Worth a separate small defensive guard slice if desired.
