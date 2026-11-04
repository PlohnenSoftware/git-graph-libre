---
summary: >-
  Open (reopened `2026-10-31`), `rbalet` `2026-10-28`: Fetch should also bring
  the current branch up to date. `cktgh` and the maintainer: fetch and pull
  stay separate, one action per Git command; the reporter suggests a setting.
  Recommended: keep Fetch a fetch; at most an unchecked "fast-forward the
  current branch" option in the Fetch dialog, `--ff-only`, its default from a
  setting like `repository.fetchTagsByDefault`.
---

# Issue #40: fetch that also updates the current branch

**Open.** [Issue #40](https://github.com/PlohnenSoftware/git-graph-libre/issues/40),
"feat(fetch): auto pull", opened `2026-10-28` by `rbalet`, label
`enhancement`. The reporter closed it on `2026-10-30` to refile with more
detail and reopened it on `2026-10-31`. Would belong to Phase 9, Repository
and Remote Management. **Decision: pending.** The maintainer's reply of
`2026-10-30` favors keeping actions explicit.

## The request

"Clicking on fetch should also update the current Branch to his latest
version." The screenshot shows Git Graph Libre's toolbar Fetch button, marked,
and the dialog it opens: "Fetch from all remotes?", with ☐ Prune deleted
remote-tracking branches, ☐ Prune deleted tags, ☑ Fetch all tags.

## The thread

- `rbalet` (`2026-10-28`): offered to provide a pull request at the same time.
- `cktgh` (`2026-10-30`): "This should be a separate feature, clicking 'fetch
  button' should `fetch` and clicking a 'pull button' should `pull`."
- `rbalet` (`2026-10-30`): the explanation was too light; closing it, to
  reopen with more detail.
- `zamkorus` (maintainer, `2026-10-30`): Git Graph Libre has a Fetch button
  because VS Code has no dedicated one. VS Code's own status-bar button
  pulls, which per Git's documentation is a fetch followed by a merge.
  Fetching alone gives more flexibility, and as in issue #39, "keeping
  features explicit is the way to go". Pull requests are welcome, but talk
  about an idea first.
- `rbalet` (`2026-10-31`): used to the former Git Graph way of working, which
  "felt natural & faster"; "adding a new settings instead would be a good
  idea"; glad to contribute. Reopened the issue.

## Checked facts (`c47207e`, `2026-11-04`)

- `showFetchDialog()` (`src/webview/main.ts:1459`) offers Prune, Prune tags
  and Fetch all tags. The last is pre-checked from the
  `repository.fetchTagsByDefault` setting. Submitting sends `fetchRemotes`
  and, when Fetch all tags is checked, a second `fetchTags` message
  (`:1482`–`:1494`). An opt-in second step in the Fetch dialog, with its
  default in a setting, is therefore an existing pattern.
- The checked-out branch can already be updated from its upstream
  (`updateBranchFromUpstream`, `src/backend/actions/branchRemote.ts:202`),
  but for the checked-out branch that runs `git pull <remote> <branch>`
  (`:161`–`:170`). That can merge or rebase per `pull.rebase`; it is not
  fast-forward only.

## Proposals and assessment

| Proposal | By | Assessment |
| --- | --- | --- |
| Fetch also updates the current branch | `rbalet` | Not as the default. In a graph view, fetching is valuable precisely because it changes nothing local: incoming commits appear and can be inspected before anything is integrated. A silent merge or rebase also breaks the maintainer's rule that each action matches one Git command. |
| Keep fetch and pull as separate actions | `cktgh`, maintainer | Agreed. |
| A setting that makes Fetch also pull | `rbalet` | Acceptable only if each run shows it. A global switch makes the button's meaning depend on hidden configuration, and a merging pull can produce merge commits nobody asked for. |
| An opt-in option in the Fetch dialog (agent) | agent | Recommended if the maintainer wants to meet the request: "Fast-forward `<current branch>` to `<upstream>`", running `git merge --ff-only @{upstream}` after the fetch. Fast-forward only never creates a merge commit. When the branches have diverged, or local changes would be overwritten, Git refuses and nothing is lost. Default unchecked; a setting in the `repository.fetchTagsByDefault` family pre-checks it for people who want it every time. Lock it with a reason (`lock: { reason }`) when HEAD is detached or the branch has no upstream. |
| A separate toolbar Pull button (agent) | agent | Explicit and simple, but it duplicates VS Code's own status-bar sync and adds a toolbar button. Second choice. |

## Open questions for the maintainer

- Do nothing, beyond pointing to VS Code's sync button, or add the
  fast-forward option to the Fetch dialog?
- If added, should a setting pre-check it, the way `fetchTagsByDefault`
  pre-checks Fetch all tags?
