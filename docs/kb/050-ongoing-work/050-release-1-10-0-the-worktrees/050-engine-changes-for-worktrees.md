---
summary: >-
  Analysis (`2026-11-04`, engine `1.0.26` on gix `0a49d46`): how the Rust
  engine treats linked worktrees today and what release 1.10.0 changes. gix
  opens a linked worktree correctly, so most of the 33 exports already answer
  for that worktree; the gaps are `config_list`'s local scope (empty), no
  worktree listing, other worktrees' HEADs missing from authors and stats,
  stale handles after a removal, and trust inherited by siblings. Engine
  slices: W01, W03, W07, W12, W40, W41.
---

# Engine changes for worktrees (`2026-11-04`)

Read-only analysis of `engine/` at `c47207e`, with the gix sources pinned in
`Cargo.lock` (gitoxide `0a49d46`) and the TypeScript seam under
`src/backend/engine/`. Line numbers are those of that commit. Re-check each
fact after W01, which moves gix to 0.90.

## How the engine opens a linked worktree

- Every export reaches the repository through `RepoManager::global().get(&path)`
  (`engine/native/node/src/lib.rs:30`), then `Repo::discover`
  (`engine/native/core/src/repository.rs:308`), then `gix::discover(path)`
  (`:38`) with default options: no trust map, and `bail_if_untrusted` false.
- gix resolves a linked worktree properly:
  - the `.git` file leads to the private `HEAD`, and `commondir` to the
    shared `objects` and `refs`;
  - the private git dir is `<common>/worktrees/<id>`, the work dir is the
    worktree itself, and the index is the private one;
  - the ref store is linked, `config.worktree` is loaded when
    `extensions.worktreeConfig` is on, and an inherited `core.bare=true` is
    ignored.
- In the engine, `git_dir` is the private dir (`repository.rs:51`), and
  `root` is gix's `workdir()` (`:52`–`:55`), never the parent of the git dir.
  `is_bare` is `work_tree.is_none()` (`:97`–`:99`); gix's own `is_bare()`
  would say true for a worktree of a bare repository. `ConfigStamp`
  (`:119`–`:164`) stamps `common_dir()/config` and `git_dir()/config.worktree`,
  so a config change reopens the handle correctly. `uses_reftable`
  (`:183`–`:213`) follows `commondir`.

## The 33 exports on a linked worktree

| Exports | Answer for a linked worktree |
| --- | --- |
| `open_repository`, `repo_root`, the close and count exports | that worktree's root; one handle per path |
| `load_repo_info`, `load_refs` | its own HEAD, with its branch first; the shared heads, tags, remotes and stash. Other worktrees' HEADs are never read. |
| `load_commits` | its own HEAD in the walk, and the uncommitted row from its own status |
| `search_commits`, `count_commits_before`, the commit, stash, tag, file and line-count reads, `diff_file_at_revisions` | the shared objects: correct |
| `load_uncommitted_details`, `count_uncommitted_changes`, `compare_commits` (to the working tree), `new_path_of_renamed_file`, `load_index_file` | its own index and work tree: correct |
| `load_stashes` | the shared stash, as Git does |
| `load_config`, `remote_url`, `submodules` | correct |
| `authors`, `author_stats`, `activity_heatmap` | **miss other worktrees' HEADs**, which the CLI's `git log --all` (`src/backend/queries/loadRepoInfo.ts:201`) includes |
| `config_list` (local scope) | **wrong:** reads `git_dir().join("config")` (`engine/native/core/src/config.rs:147`), a file Git does not use in a linked worktree, so it returns an empty map |

The ref scans cover heads, tags and remotes only, so `refs/worktree/*` and
`refs/bisect/*` are never shown, which matches the CLI's own scans.

The TypeScript side has the same `config_list` mistake.
`resolveLocalGitConfigPath()` (`src/backend/utils/gitConfigPaths.ts:48`–`:64`)
follows the `.git` file to `<common>/worktrees/<id>` and appends `config`.
`loadEngineConfig` (`src/backend/engine/repoInfo.ts:188`–`:217`) then finds
no file and skips the local identity, while the CLI's `git config --list
--local` returns it. That path is right for a submodule, whose `.git` file
names a full git dir, and wrong for a linked worktree, whose admin dir holds
a `commondir` file. **W07** fixes both sides with a parity test.

## gix's worktree API (`0a49d46`, gix 0.89)

Not behind a feature flag (`pub mod worktree`), so the engine's current
features suffice:

- `Repository::worktrees() -> Result<Vec<worktree::Proxy<'_>>>`: only entries
  that still have a `gitdir` file.
- `Repository::worktrees_including_main()`: the main repository first, even
  when bare.
- `Repository::worktree_proxy_by_id()`, `main_repo()`, `worktree()`, and
  `kind()` (`Common`, `Submodule`, `LinkedWorkTree`).
- `Proxy::base()`, `git_dir()`, `id()`, `is_locked()`, `is_prunable()`,
  `lock_reason()`, `into_repo()` and
  `into_repo_with_possibly_inaccessible_worktree()`.
- Another worktree's HEAD **without opening it**:
  `find_reference("worktrees/<id>/HEAD")`, and `main-worktree/HEAD`.

Gaps against `git worktree list`:

- An admin entry with no `gitdir` file is skipped, while Git lists it as
  prunable.
- `is_prunable()` has no reason text and no expiry.
- The main entry has to be added separately.
- `checked_out_branches()`, which includes rebase and bisect reservations,
  is crate-private.

**W03** therefore declines to the CLI whenever its answer could differ: any
entry without a `gitdir` file, any prunable entry, and any state it cannot
phrase as Git does.

## Trust, handles and writes

- **Trust.** The engine has no trust code. gix opens a repository that fails
  the ownership check with reduced trust, and it can be stricter than Git,
  since it also counts the common dir's owner. Untrusted config sections are
  then filtered out silently, and remotes and identity vanish. The real gate
  is TypeScript's `isVerified` per path, which matches Git: a worktree can be
  trusted without its main repository. Opening a sibling with `into_repo*()`
  or `main_repo()` inherits the parent's options, so **W03 never opens
  siblings**: it reads their HEADs through `worktrees/<id>/HEAD`. **W41**
  takes the deferred `bail_if_untrusted(true)` slice, with its own error
  kind (the Git trust handoff under Ongoing work).
- **Handles.** There is one handle and one object store per worktree path.
  `ConfigStamp` covers config files only, so a handle for a removed or moved
  worktree still counts as current, and answers from the shared refs with no
  HEAD (`refs.rs:32` `.ok()`) instead of declining. Design rule 5 already
  requires closing the handle. W21 and W23 do that, and **W40** adds a
  freshness check, so a vanished worktree declines as `NotARepository`.
- **Writes.** Every worktree write stays on the CLI (Non-goals, permanently).

## The engine slices of release 1.10.0

| Slice | Engine change | Engine version |
| --- | --- | --- |
| W01 | gix 0.90 from GitHub `main`, plus the Cargo refresh | unchanged (nothing new to rely on) |
| W03 | `list_worktrees`, an optional export with a parity test, declining where gix cannot match Git | unchanged (optional, feature-detected) |
| W07 | `config_list` local reads `common_dir()/config` | bump: TypeScript relies on the fix |
| W12 | extra tips (other worktrees' HEADs) in `load_commits`, the same on both backends | bump if the request shape changes |
| W40 | every wired read proven on a linked worktree; other worktrees' HEADs in authors and stats; the freshness decline; two stale doc comments (`repository.rs:28`, `api.rs:143`) | bump if TypeScript relies on it |
| W41 | `bail_if_untrusted(true)` and an `Untrusted` error kind (decision Y12) | bump |

Bumps follow Phase 16's engine version rule. `EXPECTED_ENGINE_VERSION` in
`src/backend/engine/addon.ts:27` must equal `engine/Cargo.toml`'s version,
and an optional export is declared like `loadIndexFile?` (`addon.ts:98`) and
left out of `isEngineAddon` and `REQUIRED_EXPORTS`
(`engine/scripts/verify-vsix.mjs:48`–`:68`).

Clean-room: `vscode-git-graph-rs` carries worktree code in its restricted
`src/` and `web/`, which are never read. Its MIT `native/` was not checked
for worktree code in this analysis (no network). Porting any of it would need
the manual license audit its verdict requires.
