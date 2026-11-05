---
summary: >-
  Record (`2026-11-04`, Git 2.56.0, scratch repositories): how Git behaves
  with worktrees, as release 1.10.0's slices rely on it. Covers the
  `worktree list --porcelain -z` format and order, bare repositories,
  per-worktree refs and the `worktrees/<id>/HEAD` syntax, the shared stash,
  the exact refusals for a branch checked out elsewhere and the operations
  allowed, the lifecycle (locked worktrees need `-f -f`, a moved worktree
  looks prunable), the admin files, and `%(worktreepath)`.
---

# Git worktree behavior, verified (`2026-11-04`)

Measured with Git 2.56.0 in throwaway repositories under the session
scratchpad, with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`.
The sources are `git-worktree(1)`, `git-for-each-ref(1)`, `git-branch(1)` and
`git-rev-parse(1)`, plus Git's observed output. This is the clean-room basis
for every worktree slice: nothing here was taken from another graph
extension. No minimum supported Git version is recorded in this repository,
so a slice relying on a newer field states its Git version.

## Listing

`git worktree list --porcelain -z` writes one record per worktree. Fields are
NUL-terminated, and an empty field (a second NUL) ends each record:

```text
worktree <abs path>␀HEAD <40-hex>␀branch refs/heads/<name>␀␀
worktree <abs path>␀HEAD <40-hex>␀detached␀␀
worktree <abs path>␀HEAD <40-hex>␀branch refs/heads/<name>␀locked <reason>␀␀
```

- **Order:** the main worktree first, then the linked worktrees sorted by
  path (`wt-detached`, `wt-feat`, `wt-fresh`, `wt-locked` in the test).
- **Fields seen:** `worktree`, `HEAD`, `branch` or `detached`, `locked`
  with an optional reason, `prunable` with a reason, and `bare`.
- **A bare main repository** is listed first as `worktree <path>` followed by
  `bare`, with no `HEAD` or `branch`. `git rev-parse --show-toplevel` fails
  in it ("this operation must be run in a work tree"), and each linked
  worktree's `--git-common-dir` is the bare repository.
- `git branch --list` marks a branch checked out in a linked worktree with
  `+`, and the current one with `*`.
- `git for-each-ref --format='%(refname:short) %(worktreepath)' refs/heads`
  gives every checked-out branch's absolute worktree path, including the
  main worktree's own branch, and an empty field otherwise. Detached HEADs
  appear only in `worktree list`.

## What a linked worktree is

- Its `.git` is a file: `gitdir: <common>/.git/worktrees/<id>`.
- Its admin directory `<common>/.git/worktrees/<id>/` holds `commondir`
  (`../..`), `gitdir` (back to the worktree's `.git` file), `HEAD`, `index`,
  `logs`, `refs`, `ORIG_HEAD` and `FETCH_HEAD`. With
  `extensions.worktreeConfig` it also holds `config.worktree`.
- In a linked worktree, `git rev-parse --git-dir` is the admin directory,
  `--git-common-dir` is the main `.git`, and `--show-toplevel` is the
  worktree itself.
- **Per-worktree state:** `HEAD`, the index, `refs/worktree/*` and
  `refs/bisect/*`. A `refs/worktree/x` made in a linked worktree is invisible
  to `for-each-ref` in the main worktree.
- **Shared state:** every other ref, the objects, the config (unless
  `config.worktree` is used) and **the stash**. A stash made in a linked
  worktree ("WIP on feat") is listed by `git stash list` in the main
  worktree.
- Another worktree's HEAD can be read without opening it:
  `git rev-parse worktrees/<id>/HEAD` from any worktree, and
  `main-worktree/HEAD` from a linked one.

## Refusals: a branch checked out in another worktree

All were run from the main worktree while `feat` was checked out in
`wt-feat`.

| Operation | Result |
| --- | --- |
| `git switch feat`, `git checkout feat` | `fatal: 'feat' is already used by worktree at '<path>'`, exit 128 |
| `git branch -d feat` | `error: cannot delete branch 'feat' used by worktree at '<path>'`, exit 1 |
| `git branch -f feat <rev>` | `fatal: cannot force update the branch 'feat' used by worktree at '<path>'`, exit 128 |
| `git rebase main feat` | `fatal: 'feat' is already used by worktree at '<path>'`, exit 128 |
| `git fetch origin main:main` (from the linked worktree, `main` checked out in the main one) | `fatal: refusing to fetch into branch 'refs/heads/main' checked out at '<path>'`, exit 128. This is what Fetch into Local Branch and Update from Upstream run for a branch that isn't checked out here. |
| `git worktree add <path> feat` | `fatal: 'feat' is already used by worktree at '<path>'`, exit 128 |

Allowed:

- `git branch -m feat feat-renamed` succeeds and **moves the other worktree's
  HEAD along** (`symbolic-ref HEAD` there became `refs/heads/feat-renamed`).
- `git checkout --ignore-other-worktrees feat` succeeds, leaving one branch
  checked out twice. The extension must never offer it silently.
- Reading such a branch is never refused: merge it, compare with it,
  cherry-pick from it.

Git translates all of these messages. A slice decides from the worktree list,
never from the message text, as the fix for issue #30 decided from the file
system.

## Lifecycle

| Operation | Result |
| --- | --- |
| `git worktree remove <locked>` | refused even with one `-f`: "cannot remove a locked working tree, lock reason: … use 'remove -f -f' to override or unlock first" |
| `git worktree move <locked> <new>` | refused the same way ("move -f -f") |
| `git worktree unlock`, then `move` | succeed |
| `git worktree remove <dirty>` | refused: "contains modified or untracked files, use --force to delete it". `--force` deletes the folder with those files; untracked files are in no object store and are gone for good. |
| `git worktree remove <path>` whose folder was already deleted | succeeds and clears the stale entry |
| A worktree folder deleted, or **moved by hand** | listed as `prunable gitdir file points to non-existent location`, and its branch stays blocked |
| `git worktree prune -n -v` | lists what it would remove ("Removing worktrees/<id>: gitdir file points to non-existent location") without removing it |
| `git worktree repair <new path>` after a manual move | fixes the admin link ("repair: gitdir incorrect: …"), and the worktree is listed at its new path again |

So "prunable" does not mean "deleted": it also means "moved by hand", and
pruning then strands the moved worktree, whose `.git` file points at an admin
directory that no longer exists. A UI must offer Repair beside Prune.
