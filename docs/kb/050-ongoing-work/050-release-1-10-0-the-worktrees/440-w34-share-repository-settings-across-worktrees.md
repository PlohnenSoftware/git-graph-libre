---
summary: >-
  W34 · wave E · needs W32, Y18 · TypeScript · ~120 lines: Git Graph Libre's
  own per-repository state (issue linking, pull-request settings, view
  options) is keyed by path, so every worktree starts from scratch. Per Y18,
  either inherit the main worktree's state the first time a linked worktree
  is seen (recommended, no migration) or share the repository-level parts
  by common dir. Git's own config is shared already.
---

# W34 — Share repository settings across worktrees

Status: integrated `a9d58f2` (`2026-11-06`), without step 2: the Repository-tab note needs l10n strings, so it is W34F, in the manifest and l10n slot after W22F
Needs: W32 (`commonDir` per repository)
Decisions: Y18
Kind: TypeScript · Size budget: ~120 changed lines outside tests
Source: full worktree support; `GitRepoState` (`src/types.ts:155`–`:169`) is
stored per repository path

## Facts

- Git's config is one file for every worktree, unless
  `extensions.worktreeConfig` is on. So the Repository tab's Git settings
  (user, remotes) already apply to all worktrees, and the tab should say so
  when the repository has linked worktrees.
- Git Graph Libre's own state per repository is keyed by path: issue
  linking, the pull-request settings and the view toggles. A linked worktree
  therefore starts with none of the main worktree's choices.

## Steps (as recommended under Y18 (a))

1. The first time a linked worktree is added to the repository list, copy the
   main worktree's issue-linking and pull-request settings into its new state.
   View toggles stay per worktree. Later edits are not synchronized.
2. In the Repository tab, when the repository has linked worktrees, add a
   note that Git settings apply to all of them.
3. Tests: inheritance on first sight, no overwrite of existing state, and
   the note.

## Touch

`src/extension/repoManager.ts`, `src/extension/extensionState.ts` (or
wherever repository state is created), `src/webview/settingsWidget.ts` (the
note), l10n files, `tests/**`

## Acceptance

A new linked worktree opens with the repository's issue linking and
pull-request settings, and no existing state is changed.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 15:11
- **Branch and commits:** `wt-1.10.0/W34`
  - `0e4af8d G docs(worktrees): claim W34 slice (W34)`
  - `82f7ebf G feat(worktrees): inherit the main worktree's issue and PR settings (W34)`
  - `b2c0d11 G test(worktrees): cover the settings inheritance of linked worktrees (W34)`
  - this report commit, `G docs(worktrees): report W34, Repository-tab note blocked (W34)`
- **Files changed:** `src/extension/repoManager.ts` (+44 −1); `tests/backend/extension/repoManagerInheritance.test.ts` (new, +189); this slice file (status and report).
- **Tests added or changed:** 10 new, all in `repoManagerInheritance.test.ts` (10 of 10 pass). Before, 0; after, 10. Full run: backend 1354 passed, 60 skipped (1414 total); webview 954 of 954. No "Unhandled Errors". I did not run a pre-change baseline. None of the skips are in the new file, and its one skip-if (symlink) is off on Linux.
- **Gates:** strict Biome (`--error-on-warnings`) on both touched files: clean. The CLI prints a config-schema version warning (CLI 2.6.3, `biome.strict.jsonc` 2.5.13); that predates this slice. `pnpm run typecheck`: clean. `pnpm run test`: as above. `pnpm run l10n:check`: not run, since no user-visible string was added. Sonar: integrator.
- **Acceptance:**
  - A new linked worktree opens with the repository's issue linking and pull-request settings: met for a linked worktree whose main worktree is in the repository list (tests: copy on first add, nulls, value copies).
  - No existing state is changed: met (test: an existing linked state is kept as it was; later main edits are not synchronized).
  - The Repository-tab note: not met (step 2, see deviations).
- **Deviations from the slice:**
  - **Step 2 (the Repository-tab note) is not done.** It needs a new webview string, so it needs `l10n/bundle.l10n*.json` (five bundles), which the lead's instructions reserve for another slice. Stopped here, per the rule. Its `settingsWidget.ts` change was not started.
  - The tests live in `tests/backend/extension/` and not in `tests/extension/repoManager.test.ts`. That file is a Mocha suite run only by `test:ext` (a VS Code download, no network here), so `pnpm run test` would never run it. The backend vitest project mocks `vscode`, as the sibling tests do.
  - The main worktree is found among the repositories already in the list (`mainWorktreeState` in `repoManager.ts`). It is the folder whose `.git` is the linked worktree's common dir, from `worktreeGroupOf` and `mainWorktreeOf` (W32), so a bare repository never qualifies. No Git process runs.
- **Open questions / follow-ups:**
  - Decision needed for step 2: release `l10n/` for the note (it is a single key per bundle), or drop the note and close step 2 as not wanted.
  - If the linked worktree is added before its main worktree is listed, it inherits nothing, and it is not topped up later. Y18 (a) says "no migration", so this reads as intended; please confirm.
  - A linked worktree removed from the list and added again inherits again, since `removeRepo` deleted its state. Please confirm that is acceptable.
  - On Windows, `realFolder` uses `fs.realpathSync` and does not fold drive-letter case the way `canonicalizePath` does. Not tested on Windows.
