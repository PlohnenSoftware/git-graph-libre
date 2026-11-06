---
summary: >-
  To tackle, bug and feature (maintainer, `2026-11-04`); `rbalet`,
  `2026-11-02`, label `bug`; #39 closed as its duplicate: checking out a remote
  branch whose local branch exists ends in Git's
  "already exists". Two parts: `cktgh`'s confirmed bug, where the suggested
  local name drops path segments (`origin/feat/admin-gui` becomes
  `admin-gui`), fixed with the existing `parseRemoteBranchName()`; and the
  feature, detect the existing branch first and offer switch, switch and
  fast-forward (`--ff-only`), or another name.
---

# Issue #45: checking out a remote branch whose local branch exists

**Open.** [Issue #45](https://github.com/PlohnenSoftware/git-graph-libre/issues/45),
retitled by the maintainer on `2026-11-02` to "fix(checkout remote branch):
Allow one click switch and pull when checkout on remote branch with existing
local is attempted". Opened `2026-11-02` by `rbalet`, label `bug`, on VS Code
1.144.0, Git Graph Libre 1.9.0, macOS. [Issue
#39](https://github.com/PlohnenSoftware/git-graph-libre/issues/39) was closed
the same day as its duplicate. Would belong to Phase 9, Repository and Remote
Management. **Decision (`2026-11-04`): to tackle, both the name bug and the
feature.** The maintainer had called the name bug "an actual bug" and the rest
"more of a feature" (`2026-11-03`). How the feature works is not chosen yet.
It is planned as W05 (the bug) and W24 (the feature, decision Y14) in Release
1.10.0 — "The Worktrees".

## The request

Steps: double-click a remote branch's name, choose Checkout Branch, and get
an error. Expected: "Let us fetch if needed". The screenshot of the expected
behavior is the reporter's other tool, offering "The name *feat/admin-gui* is
already used by another branch: Choose another branch name / Checkout the
existing branch & pull changes". Actual: Git Graph Libre's prompt "Enter the
name of the branch *origin/feat/admin-gui*" comes pre-filled with
`admin-gui`, then "Unable to Checkout Branch: fatal: a branch named
'admin-gui' already exists".

## The thread of #39, the duplicate

[Issue #39](https://github.com/PlohnenSoftware/git-graph-libre/issues/39),
"feat: auto pull from checkout", `rbalet`, `2026-10-28`. Double-clicking
`main` while it is behind should pull automatically when there are no local
changes, or none the pull would affect. "Was working like that in Git
Graph." The screenshot shows the same prompt for `origin/main`, pre-filled
`main`.

- `cktgh` (`2026-10-30`): pull is fetch plus merge (or rebase). Clicking an
  item already shown implies no fetch, so the feature is really "auto merge
  (fast forward only)", a `merge` or `rebase` with `--ff-only`.
- `rbalet` (`2026-10-30`): "Good analysis, my wording [was] too simple."
- `zamkorus` (maintainer, `2026-10-30`): could be an optional setting, but not
  the default. Double-click checks a branch out and should do only that; "each
  button or action in the GUI [should] match a single Git command", so
  nothing happens unless the user asks for it.
- `rbalet` (`2026-11-02`): the workflow in their other tool. Double-click the
  name; "Enter the name of the new branch you would like to create when
  checking out *origin/release/v3.0.0*"; then "The name *release/v3.0.0* is
  already used by another branch: Choose another branch name / Checkout the
  existing branch & pull changes".
- `zamkorus` (`2026-11-02`): the distinction is switching to a
  remote-tracking branch whose local counterpart is outdated, "a very
  specific edge case", documented in more depth in #45. Closed #39 as a
  duplicate.

## The thread of #45

- `cktgh` (`2026-11-03`): the bug is more accurately "checking out branches
  resolves branch name incorrectly, when branch name includes forward slash".
  `checkoutBranchAction()` takes the last `/` segment
  (`src/webview/main.ts`, L5339 at the time), while a correct function,
  `parseRemoteBranchName()` in `src/webview/refLabels.ts`, already exists.
- `zamkorus` (maintainer, `2026-11-03`): that is a separate thing and an
  actual bug; this request is more of a feature. The same message appears
  with names without slashes when checking out any remote branch whose local
  branch exists. The screenshots show `origin/development_Q2_2026`, pre-filled
  `development_Q2_2026`, then "fatal: a branch named 'development_Q2_2026'
  already exists".

## Checked facts (`c47207e`, `2026-11-04`)

- **The name bug, confirmed.** For a remote ref, `checkoutBranchAction()`
  (`src/webview/main.ts:5326`–`:5352`) pre-fills
  `refName.split("/").at(-1)` (`:5335`, `:5339`), so `origin/feat/admin-gui`
  becomes `admin-gui`. The remote-branch context menu built just above
  (`:4091`) already parses the same ref with
  `parseRemoteBranchName(refName, this.getRemoteNames())`
  (`src/webview/refLabels.ts:16`). That function tries the known remote names
  longest first, so it handles slashes in both remote and branch names.
- A plausible reading of the reporter's error, not verified: their local
  `admin-gui` exists because an earlier checkout through the same wrong
  default created it. Once the name is fixed, the next checkout would propose
  `feat/admin-gui` and create a second local branch for the same remote
  branch. So detection should also find a local branch whose upstream is the
  clicked remote branch, not only one with the same name. That uses the same
  per-branch upstream map as issue #36.
- **Why Git refuses.** For a remote ref, the backend's `checkoutBranch()`
  (`src/backend/actions/branch.ts:72`–`:95`) runs `git checkout -b <name>
  <remote>/<branch>`, which fails whenever `<name>` exists. The webview can
  tell beforehand: `hasLocalBranch()` (`main.ts:4714`).
- **Building blocks that exist.** On a remote branch whose same-named local
  branch exists and is not HEAD, the context menu already offers Fetch into
  Local Branch… (`main.ts:4117`–`:4126`). That runs `git fetch <remote>
  <rb>:<lb>` (`src/backend/actions/branchRemote.ts:190`–`:199`), a
  fast-forward-only update of a branch that is not checked out, since Git
  refuses a non-force refspec that is not a fast-forward. For the checked-out
  branch the same action runs `git pull <remote> <rb>` (`:161`–`:170`), which
  can merge or rebase.
- If the existing local branch is checked out in another worktree,
  `git checkout` fails with "already used by worktree at" (issue #37).

## Proposals and assessment

| Proposal | By | Assessment |
| --- | --- | --- |
| Pre-fill the name with `parseRemoteBranchName()` | `cktgh` | Agreed: a real bug, one line plus tests. Fall back to the full ref name when parsing fails. Ship it whatever is decided about the feature. |
| Offer to check out the existing branch and pull its changes | `rbalet` (#45, #39) | The need is real and common: every second checkout of the same remote branch hits it. Keep it explicit, which also answers the maintainer's rule: detect the collision before running anything and let the user choose. Use fast-forward only, never a merging pull. `git checkout <name>`, then `git merge --ff-only <remote>/<branch>`, brings the branch to the commit the user clicked, needs no network, and fails cleanly when the branches have diverged, leaving the user on the branch. |
| "Auto merge (fast-forward only)" rather than auto pull | `cktgh` (#39) | Agreed; that is the safe operation, and the recommendation above uses it. |
| Double-click auto-pulls, as an optional setting | `rbalet`, maintainer (#39) | Not needed once the explicit choice exists; at most a later opt-in. |

**Recommended dialog, in our own design and wording.** When the proposed name
already exists locally, or a local branch already tracks the clicked remote
branch, offer:

1. switch to `<name>` (`git checkout <name>`);
2. switch to `<name>` and fast-forward it to `<remote>/<branch>` (as above);
3. create a branch with another name, the current input, with inline
   validation that the name is free (the dialog already has an
   `inputInvalid` state).

Option 2 runs two Git commands, but the dialog names both, so the action
still does exactly what it says. Clean-room: the "expected" dialog in the
screenshots is the reporter's other tool, by its wording mhutchie's post-MIT
Git Graph. Use it as a behavioral target only, and write our own wording and
code from Git's documentation.

## Open questions for the maintainer

- Ship the name fix on its own now (recommended), ahead of the feature?
- For the feature: fast-forward only (recommended) or a full pull? From the
  already-fetched remote-tracking ref (recommended) or with a fresh fetch?
- Detect only a same-named local branch, or also one that tracks the clicked
  remote branch under another name (needs issue #36's upstream map)?
