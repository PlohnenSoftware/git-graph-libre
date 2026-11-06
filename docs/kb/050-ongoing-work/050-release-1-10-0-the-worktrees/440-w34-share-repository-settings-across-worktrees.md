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

Status: claimed by Claude Haiku 5.5 on 2026-11-06 15:08
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

Not started.
