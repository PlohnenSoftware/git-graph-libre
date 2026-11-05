---
summary: >-
  W04 · wave A · ready · TypeScript · ~180 lines: a bug today. The refresh
  watcher only knows `<repo>/.git/...`, so a graph opened on a linked
  worktree (whose `.git` is a file) never refreshes for commits, checkouts or
  fetches made outside the extension, and the main worktree's graph misses
  another worktree's HEAD moving. Watch the resolved git dir and common dir,
  and the other worktrees' HEAD, lock and admin entries.
---

# W04 — Refresh a graph when a worktree changes

Status: done — awaiting integration
Needs: —
Decisions: —
Kind: TypeScript · Size budget: ~180 changed lines outside tests
Source: the TypeScript worktree map (`2026-11-04`); Engine changes for
worktrees

## Goal

A graph refreshes for the same Git events whether it is opened on the main
worktree or on a linked one, and the worktree markers (W11, W12) stay current
when another worktree checks something out, is locked, added or removed.

## Facts (checked `2026-11-04`, `c47207e`)

- `RepoFileWatcher.start` (`src/repoFileWatcher.ts`, called from
  `selectRepo`, `src/extension/messageHandler.ts:999`–`:1004`) watches
  `RelativePattern(repo, "**")` and `RelativePattern(repo, ".git/**")`. It
  refreshes for `.git/{config,index,HEAD,packed-refs,refs/stash}` and the
  `.git/refs/{heads,remotes,tags}/` prefixes (`:5`–`:12`), and drops any path
  outside `${repo}/`. `RelativePatternFactory` is injectable for tests
  (`:17`–`:20`).
- In a linked worktree, `.git` is a file. Its HEAD and index sit in
  `<common>/.git/worktrees/<id>/`, and refs and `packed-refs` in `<common>/.git/`,
  all outside the base. So only working-tree edits refresh it today.
- From the main worktree, `.git/worktrees/<id>/HEAD` matches no list, so a
  checkout in a linked worktree is missed. A commit there moves
  `.git/refs/heads/<b>`, which is caught.
- The workspace watcher ignores every path containing `/.git/`
  (`src/extension/workspaceWatcher.ts:56`, `:67`, `:86`, `:91`–`:97`), so
  `git worktree add` and `prune` metadata never reaches discovery either.

## Steps

1. Add `resolveGitDirs(repo)` to `src/backend/utils/gitConfigPaths.ts` (or a
   new `gitDirs.ts`), returning `{ gitDir, commonDir }`. Read the `.git` file
   and the admin dir's `commondir` from the file system, with
   `git rev-parse --git-dir --git-common-dir` as the fallback. W07 uses the
   same helper.
2. `RepoFileWatcher`:
   - watch `gitDir` for `HEAD` and `index`;
   - watch `commonDir` for `config`, `packed-refs`, `refs/stash` and the
     `refs/{heads,remotes,tags}/` prefixes;
   - watch `commonDir/worktrees/*/{HEAD,locked,gitdir}`, and the creation
     and removal of `commonDir/worktrees/<id>`.

   Bases outside the workspace are fine for `RelativePattern`. Keep the
   existing debounce, and the rule that the working tree refreshes for files
   outside `.git`.
3. Tests, with the injected pattern factory and real fixtures:
   - a linked worktree's graph refreshes on a commit, a checkout and a
     fetch made in a terminal;
   - the main graph refreshes when a linked worktree checks out, is locked,
     or is removed;
   - a submodule's graph is unchanged: its `.git` file names a full git dir
     with no `commondir`.

## Touch

`src/repoFileWatcher.ts`, `src/backend/utils/gitConfigPaths.ts` (or a new
`src/backend/utils/gitDirs.ts`), `tests/backend/**` for both

## Acceptance

All the cases above refresh once (debounced), and nothing refreshes twice for
one event. Submodules behave as before.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05 18:10
- **Branch and commits:** `wt-1.10.0/W04` — `04166e6 G` claim; `e139c61 G` feat(watcher): resolve a repository's git dir and common dir (W04); `46d3253 G` fix(watcher): refresh a graph for worktree changes (W04); `8a0d6e9 G` test(watcher): cover worktree and submodule refresh (W04)
- **Files changed:** `src/backend/utils/gitDirs.ts` (new, ~75 lines), `src/repoFileWatcher.ts` (~+70/-45), `tests/backend/utils/gitDirs.test.ts` (new), `tests/webview/repoFileWatcher.test.ts` (extended)
- **Tests added or changed:** 7 in `gitDirs.test.ts`; 5 new plus 1 pattern expectation updated in `repoFileWatcher.test.ts`. Backend 1152 passed, 60 skipped, 1212 total; webview 797/797 (was one fewer before for the new tests).
- **Gates:** biome strict clean on touched files; typecheck clean; test backend 1152/1212 (60 skipped, not from this slice), webview 797/797; l10n n/a; kb:check not run (only the status line and report changed); Rust arm n/a; Sonar: integrator
- **Acceptance:** met. Linked graph refreshes on commit, checkout, fetch paths; main graph refreshes on linked HEAD, lock, unlock, add and removal of `worktrees/<id>`; submodule keeps one git dir (no commondir); two watchers reporting one event give one debounced refresh. Event paths in tests are checked to exist after the real git command, but the watchers are stubs (no real fs events).
- **Deviations from the slice:** the watcher tests sit in the existing `tests/webview/repoFileWatcher.test.ts` (the backend project has no `vscode` alias), not `tests/backend/**`. For a normal repo the git watcher is now `{base: <repo>/.git, pattern: "**"}` instead of `{base: <repo>, pattern: ".git/**"}`. `RepoFileWatcher` gained an optional sixth constructor argument, `resolveDirs`, for tests. `.git/config` is no longer refreshed from the working-tree watcher (it never was; unchanged).
- **Open questions / follow-ups:** none. Bare-repo graphs resolve through the `git rev-parse` fallback (no `.git`), left to W33.
