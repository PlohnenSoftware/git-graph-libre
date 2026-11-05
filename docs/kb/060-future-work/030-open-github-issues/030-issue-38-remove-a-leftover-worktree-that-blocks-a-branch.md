---
summary: >-
  To tackle (maintainer, `2026-11-04`); `rbalet`, `2026-10-28`: a button on
  "Unable to Delete Branch" (the branch is used by a worktree an agent left
  behind) that
  force-removes the worktree. Verified: deleting the folder does not free the
  branch (the entry turns `prunable`); `git worktree remove --force` deletes
  uncommitted and untracked files. Recommended: detect it up front, offer a
  plain remove, `--force` only after a second confirmation, and a safe prune.
---

# Issue #38: remove a leftover worktree that blocks a branch

**Open.** [Issue #38](https://github.com/PlohnenSoftware/git-graph-libre/issues/38),
"feata: delete worktree", opened `2026-10-28` by `rbalet`, label
`enhancement`. Belongs with Phase 18, Git Worktree Support: it is the action
side of issue #37. **Decision (`2026-11-04`): to tackle.** The approach is not
chosen yet, and there is no maintainer reply on GitHub yet. It is planned as
W20 and W21 in Release 1.10.0 — "The Worktrees", with the policy as decision
Y5.

## The request

"Being able to force worktree deletion." The problem it solves: "When working
with agents, sometime they forgot to delete their worktree." The proposed
solution is "A button here on error". The screenshot shows Git Graph Libre's
"Unable to Delete Branch" error dialog for `error: cannot delete branch
'codex/docs-parser-interpolation-context' used by worktree at
'/private/tmp/ngx-translate-docs-interpolation-context'`. The new button is
marked to the left of Dismiss.

## The thread

No comments yet.

## Checked facts (`c47207e`, Git 2.56.0, `2026-11-04`)

Verified in a scratch repository with two linked worktrees:

- `showErrorDialog()` (`src/webview/main.ts:7465`) shows the message, Git's
  error text and a Dismiss button, nothing else. `showDialog()` supports one
  action button beside the dismiss button, so the reporter's layout is
  buildable.
- **Deleting the worktree's folder does not free the branch.** After
  `rm -rf` of the folder, `git branch -d` still fails with the same "used by
  worktree at" error, and `git worktree list --porcelain` marks the entry
  `prunable gitdir file points to non-existent location`. This is the likely
  state an agent leaves behind under `/tmp`. `git worktree remove <path>` on
  the missing folder succeeded and cleared the entry; `git worktree prune`
  clears every such entry.
- **A worktree with local work refuses plain removal**: `fatal: '../wt-x'
  contains modified or untracked files, use --force to delete it`. With
  `--force` the folder goes, and its uncommitted changes and untracked files
  go with it. Untracked files exist in no object store, so they cannot be
  recovered afterwards. Per `git-worktree(1)`, a locked worktree needs
  `--force` given twice.
- Reacting to the error means parsing Git's message for the path, and Git
  localizes its messages. The fix for issue #30 deliberately decided from the
  file system rather than from "Git's possibly localized message", which sets
  the precedent.

## Proposals and assessment

| Proposal | By | Assessment |
| --- | --- | --- |
| A button on the error dialog that force-removes the worktree | `rbalet` | The need is real and growing. Agents create a worktree per task, and the release 1.9.0 agent protocol does too (a worktree per slice). Two parts are wrong, though: force by default, which deletes the worktree's uncommitted and untracked work, and parsing a localized error to find the path. |
| Detect it up front (agent) | agent | Recommended. With the worktree data issue #37 brings, the Delete Branch dialog knows before running anything that the branch is checked out at `<path>`. It can offer "Also remove the worktree at `<path>`", running plain `git worktree remove`. |
| `--force` behind a second confirmation (agent) | agent | Recommended. Only when Git refuses because of local changes, ask again, naming the consequence: uncommitted and untracked files in `<path>` are deleted for good. Show a locked worktree's lock reason, and do not force it by default. |
| Stale entries and prune (agent) | agent | Recommended, and it covers most leftover agent worktrees. An entry whose folder is already gone (`prunable`) can be removed without any warning, since nothing on disk is lost. A repository-level "Prune Stale Worktrees" (`git worktree prune`) clears them all at once. |

Guard rails for any variant: never offer to remove the main worktree or the
worktree this VS Code window has open. Show the full path before removing,
and keep the action out of bulk flows.

If the maintainer prefers the reporter's reactive button, show it only when
the worktree data (not the message text) says the branch is checked out
elsewhere, and still confirm `--force` separately.

This is Phase 18's slice 18.4 (branch-action awareness) plus a worktree
removal action and a prune action, neither of which the plan lists yet.

## Open questions for the maintainer

- Proactive offer in the Delete Branch dialog (recommended), or the
  reporter's button on the error?
- Allow `--force` at all from the UI, and if so behind which confirmation?
- Add "Prune Stale Worktrees" as its own action?
