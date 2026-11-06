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

Status: done — awaiting integration
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

- **Agent / date:** Claude Sonnet 5.5, 2026-11-06. Branch `wt-1.10.0/W32`, base `4d03668`.
- **Built:**
  - **Setting (Y9 (c)):** `git-graph-libre.repository.worktreesOutsideWorkspace`, boolean, default `true`; `config.worktreesOutsideWorkspace()`; host-only like `maxDepthOfRepoSearch` (the webview does not read it, so `webviewHtml`/`global.d.ts`/the hub echo carry no copy); `extension.ts` rescans when it changes. Text in the five `package.nls*.json`.
  - **Grouping:** `src/extension/repoLayout.ts` reads each listed repository's common dir through `resolveGitDirs` (symlinks resolved); `loadRepos` and the boot state carry `layout` (`RepoLayout`: per-repository `commonDir`, `linked`, `branch`, `detached`; plus `outside`). `src/webview/repoOptions.ts` (`buildRepoOptions`) replaces the path-prefix indent helpers: main worktree first, linked worktrees beneath, labelled `name (branch)` or `(detached)`, in any folder layout (sibling, nested, bare-repository clones). Submodules and plain repositories still nest by path prefix. A parent loop cannot drop a row.
  - **Discovery:** `src/extension/worktreeDiscovery.ts` runs `git worktree list` (engine reader when verified, else CLI) once per common dir after each scan, and after a watcher finds a repository. A listed worktree inside a workspace folder that the scan missed (nested `.worktrees/x`) is added once Git accepts it as a root. A worktree outside the workspace becomes an "outside workspace" entry while the setting is on; choosing it sends W31's `switchGraphToWorktree` (add and focus), and the dropdown stays on the current repository until the host answers. A linked worktree outside the workspace that Git no longer lists as present (for example moved by hand) is dropped.
  - **Activation purge:** with the setting on, an outside repository survives only if it is a linked worktree whose main worktree is a known repository inside the workspace; the scan then drops it if Git does not list it. With the setting off, the purge is the old one.
  - **Trust (Y10 (b)):** `confirmGitTrust` gathers the other worktrees of the repository that Git also rejects (`untrustedSiblingEntries`: the main worktree and each linked worktree the admin data names, read from the file system because Git will not list an untrusted repository; accepted only when the folder names the same common dir back and Git still answers "untrusted") and asks once, listing every exact `safe.directory` entry. Declining writes nothing. A repository with no untrusted sibling gets the unchanged single prompt. The requested repository must still be a discovered untrusted one; entries are never globs or parents.
- **Branch and commits:** `wt-1.10.0/W32` — see the final message for hashes; all signed (`G`).
- **Files changed (outside tests):** `src/types.ts`, `src/config.ts`, `package.json`, `package.nls*.json` (5), `src/extension/repoLayout.ts` (new), `src/extension/worktreeDiscovery.ts` (new), `src/extension/repoManager.ts`, `src/extension/workspaceSearch.ts`, `src/extension/repositoryRecovery.ts`, `src/backend/utils/repositoryProbe.ts`, `src/extension.ts`, `src/extension/webviewPanel.ts`, `src/extension/webviewHtml.ts`, `src/extension/messageHandler.ts` (the `loadRepos` reply only), `src/extension/webviewL10n.ts`, `src/webview/repoOptions.ts` (new), `src/webview/main.ts`, `src/webview/settingsWidget.ts` (two helpers removed), `l10n/bundle.l10n*.json` (5). About 720 added and 93 removed source lines outside tests (`git diff --numstat -- src`; budget ~250; mostly the three new modules, about 480 of them, and the strings).
- **Flagged, outside the Touch list:** `package.json`, `package.nls*.json`, `src/config.ts` (the setting, required by Y9); `src/extension.ts`, `webviewPanel.ts`, `webviewHtml.ts`, `messageHandler.ts`, `webviewL10n.ts`, `src/webview/main.ts` (wiring); `src/extension/repositoryRecovery.ts` (Y10's confirmation lives there); three new modules.
- **Tests added or changed:** backend 1,341 before to 1,370 after, webview 913 before to 932 after (counts from W30's report and this run). New: `tests/backend/extension/worktreeDiscovery.test.ts` (10), `repoLayout.test.ts` (8), `tests/webview/repoOptions.test.ts` (10), `repoDropdownWorktrees.test.ts` (4), `repoManager.test.ts` (+5), `workspaceSearch.test.ts` (+2), `repositoryProbe.test.ts` (+5, real Git, global config pointed at a temp file), `repositoryRecovery.test.ts` (+2), `config.test.ts` (+1 and a row). Fixtures include a path with a space, one with a non-ASCII character, a nested worktree, a bare repository and a symlinked spelling. The path-prefix assertions in `dropdown.test.ts` now go through `buildRepoOptions`, with the same expected rows.
- **Gates:** strict Biome (`--error-on-warnings`) on every touched `.ts` and `package.json`: clean; `pnpm run typecheck`: clean; `pnpm run test`: backend 1370 of 1370, webview 932 of 932, no "Unhandled Errors"; `pnpm run l10n:check`: 100% in all five bundles; Sonar: integrator.
- **Acceptance:** met. Worktrees of one repository appear together whatever their folder layout (grouping tests); none is lost at activation (purge tests; a kept outside worktree stays while Git lists it); trust is never weakened (the same exact-path write, the requested repository still checked, siblings only when the folder names the common dir back and Git says untrusted, a forged admin file is ignored).
- **Deviations from the slice:**
  - `ResponseLoadRepos` carries `layout` (per-repository group info plus the outside list) rather than a bare `commonDir` per repository, because the labels and outside entries need the branch and a path.
  - Outside entries are not repositories until selected, so they travel in `layout.outside`, not in `repos`.
  - A bare common dir gets no header row (W33): its linked worktrees are listed flat, adjacent, labelled with their branch.
  - Nested and outside discovery asks Git, so it does not work for a repository Git rejects for ownership (the trust confirmation then covers its worktrees, and the next scan finds them).
  - A deleted outside folder is left to the existing existence check; the discovery drop rule covers the "moved by hand" case, where the folder still resolves to its repository.
  - No README or changelog entry (outside Touch).
  - The four non-English translations (nl, pl, zh-cn, zh-tw) of the setting text and the three new strings are my own, worth a native glance.
- **Open questions / follow-ups:**
  - An untrusted repository's nested worktrees are found only after it is trusted (Git cannot list them before).
  - Editing the new key in VS Code's own settings UI rescans via `extension.ts`; the hub echo needs no change, since the webview never reads the key.
  - `README.md`/`CHANGELOG.md` could mention the setting.

