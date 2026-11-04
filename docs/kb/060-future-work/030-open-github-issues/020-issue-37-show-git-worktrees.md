---
summary: >-
  Open, `KristjanESPERANTO` `2026-10-26`, on the roadmap for 1.10.0 as Phase
  18: show which branches are checked out in which worktree. Verified:
  `git branch` marks them `+`; simple-git already parses that as
  `linkedWorkTree` in CLI-only `loadBranches` and drops it; `%(worktreepath)`
  and `git worktree list --porcelain` give the paths; checkout and delete of
  such a branch fail with "used by worktree at". Recommended: a display-only
  first slice.
---

# Issue #37: show Git worktrees

**Open.** [Issue #37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37),
"Feature Request: Git worktree support", opened `2026-10-26` by
`KristjanESPERANTO` (who also wrote PR #1, submodule support), label
`enhancement`. Roadmap: Phase 18, Git Worktree Support, which holds the
implementation plan. **Decision: pending** on the scope of the first slice.

## The request

"I've started using Git worktrees to work on multiple branches in parallel.
Would it be possible to show them in Git Graph Libre? It would be handy to see
which branches are checked out where." The issue proposes no implementation.

## The thread

- `zamkorus` (maintainer, `2026-10-27`): "definitely on the roadmap"; busy
  with university work, but will try to add it in the upcoming release,
  "probably somewhere in the first half of November".

No other proposals were made. Issue #38, filed two days later by another
user, asks for removing a worktree that blocks a branch, which is the action
side of the same feature.

## Checked facts (`c47207e`, Git 2.56.0, `2026-11-04`)

Verified in a scratch repository with two linked worktrees:

- `git branch --list` prints `+` before a branch checked out in another
  worktree, and `*` before the current one.
- `loadBranches` (`src/backend/queries/loadBranches.ts:29`) reads branches
  through simple-git's `git.branch()`. In simple-git `3.36.0` every
  `BranchSummaryBranch` carries `linkedWorkTree: boolean`, parsed from that
  marker, but the query keeps only `summary.all`, so the information is
  received and dropped. `loadBranches` is CLI-only: the engine's `branches`
  field is "carried but never consumed" (`src/backend/engine/repoInfo.ts:51`).
  Worktree attribution added there therefore needs no engine parity.
- `git for-each-ref --format='%(refname:short)|%(worktreepath)' refs/heads`
  prints each checked-out branch's absolute worktree path, including the main
  worktree's own branch, and an empty field for the rest.
- `git worktree list --porcelain` also reports what branch listings cannot:
  detached worktrees (`HEAD` with no `branch` line), `locked`, and
  `prunable gitdir file points to non-existent location` for a worktree whose
  folder was deleted. Issue #38 needs that last state.
- Git refuses to act on such a branch:
  - `git checkout feat/x` fails with `fatal: 'feat/x' is already used by
    worktree at '<path>'` (exit 128);
  - `git branch -d feat/x` fails with `error: cannot delete branch 'feat/x'
    used by worktree at '<path>'` (exit 1).
- No minimum supported Git version is recorded anywhere in this repository.
  Check `%(worktreepath)` and the porcelain fields against the oldest Git the
  project wants to support before relying on them.

## Proposals and assessment

The issue itself proposes nothing beyond "show which branches are checked out
where", and that is the right first slice.

| Option | Assessment |
| --- | --- |
| Display only: a worktree marker on the branch badge, and the worktree path in its tooltip and the context menu header | Recommended for 1.10.0. It answers the issue fully and explains Git's two refusals before the user hits them. |
| Data from `loadBranches` (CLI-only already): `git worktree list --porcelain -z`, or the `linkedWorkTree` flag simple-git already parses plus paths on demand | Recommended. No engine work, and the porcelain form also yields detached and prunable worktrees. It costs one extra spawn per refresh, or none if only the flag is used and paths are fetched lazily. |
| Data in the graph load's ref records (`%(worktreepath)` in `buildRefFormat()`, `src/backend/queries/loadCommits.ts:97`) | Works on the CLI, but the engine path would need the same field from gix (`Repository::worktrees()`) with a parity test. On the engine path `loadCommits` spawns nothing today, so a CLI fill there would regress that. This is Phase 18's slice 18.1 as currently written. |
| Branch-action awareness (Phase 18's 18.4): checkout or delete of such a branch offers "open that worktree" or explains the refusal | Next after display; it also carries issue #38. |
| Worktree discovery and switching (18.3): open a worktree in a new window, or list worktrees in the repository selector | Later; not asked for in the issue. |
| Creating worktrees (`git worktree add`) | Not asked for; leave it out of 1.10.0. |

Clean-room: `vscode-git-graph-rs` carries worktree code in its restricted
`src/` and `web/` layers. Do not consult them, as Phase 18 already says.

## Open questions for the maintainer

- Is display only (marker plus path) enough for 1.10.0, with 18.4 and #38
  following?
- Carry the data on `loadBranches` (CLI-only, recommended), or in the graph
  load with engine parity (Phase 18's 18.1 as written)?
