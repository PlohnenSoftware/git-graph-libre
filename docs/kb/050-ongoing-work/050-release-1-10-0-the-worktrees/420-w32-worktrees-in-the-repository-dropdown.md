---
summary: >-
  W32 · wave E · needs W02, W04, W10, Y9, Y10 · TypeScript + webview · ~250
  lines: group a repository's worktrees in the dropdown by common dir, not by
  path prefix. Find worktrees nested inside the main worktree, which the scan
  skips today. Per Y9, offer linked worktrees outside the workspace, which
  are purged at activation today. Per Y10, settle how trust is asked for a
  repository with many worktrees.
---

# W32 — Worktrees in the repository dropdown

Status: gated on Y9 and Y10
Needs: W02, W04 (`resolveGitDirs`), W10
Decisions: Y9 (worktrees outside the workspace), Y10 (trust prompts)
Kind: TypeScript and webview · Size budget: ~250 changed lines outside tests
Source: the TypeScript worktree map (`2026-11-04`), "Repository discovery"
and "Dropdown"; Phase 18's slice 18.3

## Facts (checked `2026-11-04`, `c47207e`)

- **Discovery.** A linked worktree in the workspace is discovered as its own
  repository, keyed by its root. Main and linked worktrees are separate,
  unrelated entries, sorted by path (`src/extension/repoManager.ts:12`–`:19`,
  `:69`–`:74`).
- **The scan** stops at a repository boundary and follows only
  `.gitmodules` below it (`src/backend/utils/repoSearch.ts:114`–`:134`), so
  a worktree nested inside the main one (`.worktrees/x`) is found only by a
  later watcher event (`src/extension/workspaceWatcher.ts:54`–`:82`).
- **Worktrees outside the workspace** are never scanned, and known ones
  are purged at activation (`repoManager.ts:94`–`:114`).
- **Dropdown nesting** is by path prefix (`src/webview/settingsWidget.ts:160`–`:187`,
  `src/webview/dropdown.ts:343`–`:363`). A nested worktree indents like a
  submodule, and siblings render flat.
- **Trust** is per path. Trusting a worktree leaves its main repository
  untrusted (`tests/backend/utils/repositoryProbe.test.ts:317`–`:324`), so a
  repository with N worktrees can ask N+1 times.

## Steps (as recommended)

1. `ResponseLoadRepos` (`src/types.ts:351`–`:355`) carries each
   repository's `commonDir` (from W04's `resolveGitDirs`), and the dropdown
   groups by it: the main worktree, then its linked worktrees indented
   beneath, each labelled with its branch. A bare common dir is a group
   header, not a selectable entry (W33).
2. After each scan, list the worktrees of every found repository (W02 or
   W03) and add any linked worktree inside a workspace folder that the scan
   missed.
3. Per Y9 (recommended: on): list linked worktrees outside the workspace as
   "outside workspace" entries. Selecting one adds it on demand, as W31's
   switch does. Keep such a repository through activation only while its
   main worktree is known and Git still lists it.
4. Per Y10: either keep one prompt per path as today, or, when trust is
   needed for several worktrees of one repository, offer them in one
   confirmation, each added to `safe.directory` exactly as Git spells it.
5. Tests:
   - grouping for sibling, nested and bare layouts;
   - nested discovery;
   - outside-workspace listing, and its purge rule;
   - trust prompts per Y10, with the real user's trust list never touched
     (`GIT_CONFIG_GLOBAL` to a temp file).

## Touch

`src/types.ts`, `src/extension/repoManager.ts`,
`src/extension/workspaceSearch.ts`, `src/backend/utils/repoSearch.ts`
(only if discovery moves there), `src/webview/settingsWidget.ts`,
`src/webview/dropdown.ts`, `src/backend/utils/repositoryProbe.ts` (Y10
only), l10n files, `tests/**`

## Acceptance

Worktrees of one repository appear together whatever their folder layout,
none is lost at activation, and trust is never weakened.

## Report

Not started.
