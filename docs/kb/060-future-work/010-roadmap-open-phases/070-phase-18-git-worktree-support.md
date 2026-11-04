---
summary: >-
  Planned (`2026-10-27`, issue #37): show Git worktrees and which branches or
  commits are checked out in each worktree, with clean-room CLI and Rust-engine
  parity, worktree discovery, and branch-action awareness; issue #38 (removing
  a leftover worktree that blocks a branch) is undecided.
---

# Phase 18: Git Worktree Support

**Status: planned (`2026-10-27`, [issue #37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37))** — requested by `@KristjanESPERANTO` on `2026-10-26` and acknowledged by the maintainer on `2026-10-27` for the upcoming release (first half of November). [Issue #38](https://github.com/PlohnenSoftware/git-graph-libre/issues/38) (`@rbalet`, `2026-10-28`, undecided) asks for removing a leftover worktree that blocks a branch, the action side of slice 18.4.

Both threads, the facts checked on `2026-11-04` and the options are in Issue #37: show Git worktrees and Issue #38: remove a leftover worktree that blocks a branch, under Open GitHub issues. The facts:

- `git branch` already marks other worktrees' branches with `+`, and simple-git parses that as `linkedWorkTree` in CLI-only `loadBranches`, then drops it. Display could ride there with no engine work, an alternative to slice 18.1's engine parity.
- `%(worktreepath)` gives the paths.
- A worktree whose folder was deleted still blocks its branch, as a `prunable` entry.
- `git worktree remove --force` deletes the worktree's uncommitted and untracked files.

Goal: let users who work across multiple Git worktrees in parallel see which branches (and detached commits) are checked out where, switch between a repository's worktrees without hunting for external folders, and avoid confusing Git errors when acting on a branch that is checked out in another worktree.

Clean-room rule: `vscode-git-graph-rs` carries worktree code in its restricted `src/` and `web/` layers (see the `vscode-git-graph-rs` licensing verdict under Licensing). Do not read, consult, or copy from those layers. Implement from Git's own documentation (`git-worktree(1)`, `git-for-each-ref(1)`), `gix`'s worktree APIs (`gix::Repository::worktrees()`), VS Code extension APIs, and this repository's existing patterns.

What already exists in this repository:

- Workspace scanning and `.git` file watching already accept linked worktrees when they sit inside a workspace folder within `maxDepthOfRepoSearch` (`src/backend/utils/git.ts`, `src/backend/utils/repositoryProbe.ts`, `src/extension/workspaceWatcher.ts`).
- Per-repository Git ownership trust (`safe.directory`) and `ConfigStamp` (`config.worktree`, `commondir`) already handle linked worktrees (`src/backend/utils/repositoryProbe.ts`, `engine/native/core/src/repository.rs`).

What is missing:

1. **Worktree checkout attribution in the graph ([issue #37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37)):** `loadCommits` and `loadRepoInfo` only report the active worktree's `HEAD`. Branches or detached commits checked out in other worktrees of the same repository carry no indicator or path.
2. **Sibling worktree discovery and switching:** `git worktree add ../feature-wt` places the linked worktree outside the main repository's folder, so workspace directory scanning at depth `0` never sees it unless the user adds the folder to the workspace.
3. **Branch-action awareness:** checking out or deleting a branch that is checked out in another linked worktree fails in Git (`fatal: '<branch>' is already checked out at '<path>'`) with no prior indication in the UI.

Implementation plan:

- **Slice 18.1 — Backend and engine worktree query with parity:**
  - Read the repository's worktrees (worktree root path, `HEAD` commit hash, checked-out local branch name or detached status, main vs. linked, locked/prunable markers) on the CLI (`git worktree list --porcelain -z`) and in the Rust engine (`gix` main repo + `worktrees()` proxies), with a cross-backend parity test.
  - Respect the existing Git ownership trust gate (`RepoSearch.isVerified`): never read an untrusted worktree through the engine.
- **Slice 18.2 — Graph badges and tooltips for worktree checkouts:**
  - Distinguish a branch (or detached commit) checked out in another linked worktree from both ordinary local branches and the current worktree's checked-out `HEAD` (for example, a worktree icon/sub-segment on the ref badge and the worktree path/folder name in the tooltip and commit details).
- **Slice 18.3 — Worktree discovery and quick switching:**
  - Offer discovered linked worktrees of known repositories in the repository selector (or allow switching the graph to the worktree where a branch is checked out / opening that worktree in VS Code), keeping per-worktree verification and settings intact.
- **Slice 18.4 — Branch context-menu and dialog awareness:**
  - When a branch is checked out in another worktree, surface that fact in checkout/delete flows (or offer switching to that worktree instead of running a `git checkout` that Git will refuse).

Acceptance:

- Opening a repository with linked worktrees shows which branches (or detached commits) are checked out in which worktrees, with their paths visible on hover.
- CLI and Rust engine return identical worktree records in parity tests.
- Touched code meets `biome.strict.jsonc`, OKLCH color rules, localization (`100%` across all shipped locales), headless visual verification, and the SonarQube quality gate.
