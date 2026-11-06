---
summary: >-
  Closed `2026-11-06` by `613fbb4`, shipped in 1.10.0 as W25 (`decdf71`).
  `cktgh`, `2026-10-26`, agreed on `2026-10-27`: the Push Branch dialog
  pre-checked `origin` and Set upstream. Verified before the change: the
  webview knows no upstreams; `%(push:remotename)` names the remote plain
  `git push` uses (`branch.<b>.pushRemote`, `remote.pushDefault`, upstream);
  `-u` on several remotes leaves the last one tracked. Recommended, and built
  by W25: Git's push remote, then `origin`, then the first; Set upstream only
  for a branch with none.
---

# Issue #36: push dialog default remote and Set upstream

**Closed on `2026-11-06`.** [Issue #36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36),
"Updating push dialog box to better align with default git behavior", opened
`2026-10-26` by `cktgh` (who also wrote PRs #22–#25), label `enhancement`.
Roadmap: Phase 9, Repository and Remote Management. **Decision
(`2026-11-04`): to tackle.** The maintainer agreed with the request on
`2026-10-27` and put it on the to-tackle list on `2026-11-04`. When it was
decided, the options below were not yet chosen. It was planned as W25 in
Release 1.10.0 — "The Worktrees", with the choice as decision Y11, and
integrated as `decdf71`. Closed by `613fbb4`, the integrator's gated record
of W25, when the maintainer pushed `main` on `2026-11-06`.

## The request

The Push Branch dialog differs from plain `git push` in two ways. The
screenshot shows "Push branch *master*?", with Remotes: ☑ Push to origin,
☐ Push to personal, then ☑ Set upstream, ☐ Bypass Git Hooks, and Push mode
Normal.

1. It pre-checks `origin`, from `defaultPushRemoteName()`, where Git pushes to
   the branch's upstream remote.
2. It pre-checks **Set upstream**, though Git changes tracking only when
   `--set-upstream` is given explicitly.

The issue's own proposals:

- default to the remote of the branch's upstream tracking branch, falling
  back to today's behavior when the branch has none;
- possibly make the default remote name a setting instead of the hardcoded
  `origin`;
- leave Set upstream unchecked by default.

## The thread

- `zamkorus` (maintainer, `2026-10-27`): agreed, it had annoyed them more than
  once; to be fixed in the upcoming release, "probably somewhere in the first
  half of November".

No other proposals were made.

## Checked facts (`c47207e`, Git 2.56.0, `2026-11-04`)

- `showPushBranchDialog()` (`src/webview/main.ts:4573`) builds its remote
  checkboxes with `remoteCheckboxInputs()` (`:4372`). That pre-checks
  `defaultPushRemoteName()` (`:4706`), which returns `origin` if it exists and
  the first remote otherwise. Set upstream is hardcoded `value: true` (`:4579`).
  The same `remoteCheckboxInputs()` serves the tag and all-tags push dialogs
  (`:4291`, `:4327`), and `defaultPushRemoteName()` also seeds the
  pull-request settings dialog (`:2679`).
- The webview knows only remote names (`gitRemotes`) and branch names
  (`gitBranches`), so nothing tells it a branch's upstream or push remote. The
  backend can find out: `resolveBranchUpstream()`
  (`src/backend/actions/branchRemote.ts:62`) runs `git rev-parse --abbrev-ref
  --symbolic-full-name <branch>@{upstream}` for Update from upstream.
- `pushBranch()` (`branchRemote.ts:101`) pushes to each selected remote in
  turn and adds `--set-upstream` to every one of those pushes (`:112`).
  Verified with two local bare remotes. Pushing `b` to `origin` and then to
  `personal`, each with `--set-upstream`, leaves `b@{upstream}` as
  `personal/b`; in the reverse order it leaves `origin/b`. **With two remotes
  checked and Set upstream on, tracking silently ends on whichever remote was
  pushed last.** That is a bug independent of the defaults.
- `git for-each-ref --format='%(upstream:remotename) %(push:remotename)'
  refs/heads/<b>` answers both questions in one spawn, and
  `%(push:remotename)` follows Git's own precedence:
  - with nothing configured, it equals the upstream's remote;
  - with `remote.pushDefault=personal`, a branch that tracks `origin/a`
    reports `personal`, the remote plain `git push` would use;
  - adding `branch.a.pushRemote=origin` brings it back to `origin`;
  - a branch with no upstream and no push default reports both fields empty.

## Proposals and assessment

| Proposal | By | Assessment |
| --- | --- | --- |
| Default to the upstream's remote, else today's behavior | `cktgh` | Right in the common case. It misses triangular setups (fetch from one remote, push to a fork), where `remote.pushDefault` or `branch.<b>.pushRemote` sends `git push` elsewhere. Prefer `%(push:remotename)`, which is exactly what plain `git push` uses, then the upstream's remote, then `origin`, then the first remote. |
| A setting for the default remote name | `cktgh` | Not needed. Git already has this setting, `remote.pushDefault`, and `%(push:remotename)` honors it. An extension-only setting would put the extension out of step with Git again, which is the issue's own complaint. |
| Uncheck Set upstream by default | `cktgh` | Right for a branch that already tracks something, where `-u` silently retargets the upstream; that is worst when pushing to a second remote. But the first push of a new branch is the one case where tracking is usually wanted; VS Code's own Publish Branch sets it. Recommended: pre-check Set upstream only when the branch has no upstream yet. Optionally, add a `dialog.pushBranch.setUpstream` default beside the existing `dialog.*` dialog-default settings. |
| Several remotes with Set upstream (found while checking) | agent | Set the upstream on one remote only, the pre-checked push remote. Alternatively, lock the box with the existing `lock: { reason }` support while more than one remote is checked. |

**Data path.** Recommended: a read-only request when the dialog opens, on the
pattern of D11's `resolveRef`, returning `%(upstream:remotename)` and
`%(push:remotename)` for the branch. That is one `for-each-ref` spawn per
dialog, needs no engine work, and can never be stale. Carrying the fields in
the graph load instead (`buildRefFormat()` in
`src/backend/queries/loadCommits.ts:97`) would need engine parity under the
Phase 16 design rules, and on the engine path `loadCommits` spawns nothing
today. A per-branch upstream map would also serve issue #45, which needs to
find a local branch that tracks the clicked remote branch under another name.

Tag pushes keep their behavior, since tags have no upstream. Whether they
should honor `remote.pushDefault` too is a separate choice.

## Open questions for the maintainer

- Choose the pre-checked remote by `%(push:remotename)` (recommended) or by
  the upstream's remote (as proposed)?
- Leave Set upstream always unchecked (as proposed), or check it only for a
  branch with no upstream (recommended)? With or without a `dialog.*`
  setting?
- Fix the several-remotes `-u` case in the same slice?
