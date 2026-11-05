---
summary: >-
  The choices only the maintainer makes for release 1.10.0, each with
  options, a recommendation and the slices it unblocks: Y1 integration
  branch; Y2 gix source (answered: GitHub `main`); Y3 the worktree list; Y4
  the marker; Y5 removal policy; Y6 refused actions; Y7–Y8 creation; Y9–Y10
  outside worktrees and trust; Y11 #36; Y12 engine trust; Y13 #41; Y14 #45;
  Y15–Y22 housekeeping, dispatch, bare, settings, telemetry, local changes,
  name, detached HEADs.
---

# Maintainer decisions for release 1.10.0

Agents: read the answers, never write them. A slice gated on an unanswered
decision is not ready.

| ID | Question | Options | Recommendation | Unblocks | Answer |
| --- | --- | --- | --- | --- | --- |
| Y1 | Integration branch, and may agents push slice branches? | branch name; push yes or no | `the-worktrees`, local; no pushing (as X6) | every slice | open |
| Y2 | Where does gix come from in W01? | (a) gitoxide `main` on GitHub, pinned to the newest commit (gix 0.90); (b) crates.io `gix = "0.90"`, released `2026-10-22` with D07's fixes, so Dependabot could track it; (c) stay on `0a49d46` | (a) | W01 | **(a), `2026-11-04`**: "please also do updates to cargo stuff including gix which we grab from GH" |
| Y3 | Where does the worktree list live (W30)? | (a) a Worktrees toolbar button opening a popup, shown always or only when linked worktrees exist; (b) a list in the top bar, like the stash list; (c) no list, only context menus | (a), shown always, since the list also creates worktrees | W30, W23, W51 | open |
| Y4 | What does the "checked out in another worktree" marker look like (W11, W12)? | (a) a small segment inside the branch badge, styled like the signed-tag badge, with an octicon: `file-directory`, `repo-clone`, `stack`, `versions` or `file-directory-symlink`; (b) a separate badge after the branch; (c) tooltip text only | (a) with `file-directory` (a worktree is a folder) | W11, W12 | open |
| Y5 | Removal policy (W21, issue #38) | (a) plain `remove`; `--force` only after a second confirmation naming the loss; locked: unlock first, never `-f -f`; stale entries without a warning; Prune with a preview from the list; (b) (a) plus Prune Stale Worktrees in the Command Palette; (c) never `--force` from the UI | (b) | W21 | open |
| Y6 | A branch checked out in another worktree: what happens to Checkout, Fetch into Local Branch and Pull (W20)? | (a) Checkout becomes "Open Worktree…", Fetch into Local Branch and Pull are locked with a reason, Rename gets a note; (b) hide them instead of locking; (c) leave them, and explain Git's error afterwards | (a) if the context menu can show a locked item with a reason, otherwise (b) plus a header line; never `--ignore-other-worktrees` | W20 | open |
| Y7 | Default location of a new worktree (W22) | (a) `<parent>/<repo>.worktrees/<branch>`; (b) `<parent>/<repo>-<branch>`; (c) no default, remember the last parent; (d) any of these as a setting with `${repo}` and `${branch}` | (a), with (d) | W22 | open |
| Y8 | After creating a worktree (W22) | (a) ask: Open in New Window, Add to Workspace, Switch Graph, Nothing; remember the last choice; (b) always switch the graph; (c) always open a new window | (a) | W22 | open |
| Y9 | Linked worktrees outside the workspace (W32) | (a) list them as "outside workspace", added when selected and kept while Git lists them; (b) only worktrees inside workspace folders; (c) a setting, defaulting to (a) | (c) | W32 | open |
| Y10 | Trust for a repository with several worktrees (W32) | (a) one prompt per path, as today; (b) one confirmation listing every worktree of the repository that needs trust, each added to `safe.directory` as Git spells it | (b) | W32 | open |
| Y11 | Issue #36's push dialog defaults (W25) | (a) as in Issue #36's subsection: `%(push:remotename)`, then the upstream's remote, then `origin`, then the first remote; Set upstream only when the branch has none; `-u` on one remote only; (b) the issue's own proposal: the upstream's remote, Set upstream always unchecked; (c) (a) or (b), plus a `dialog.pushBranch.setUpstream` setting | (a) | W25 | open |
| Y12 | Take the engine trust slice (W41) in 1.10.0? | (a) yes; (b) later | (a): W01 rebuilds every binary anyway, and worktrees mix owners | W41 | open |
| Y13 | Issue #41's scope (W06) | (a) modal dialogs only, no hover tint; (b) every checkbox in the webview; (c) (a) or (b) with a hover tint | (a) | W06 (ready under (a)) | open |
| Y14 | Issue #45's feature (W24) | (a) switch; switch and fast-forward (`--ff-only`) to the clicked remote-tracking ref; another name. Detect same-name and tracking branches; (b) a full `git pull` instead of fast-forward only; (c) fetch first, then fast-forward | (a) | W24 | open |
| Y15 | Promote the release agent protocol and integrator procedure into Rules (W00)? | (a) no, a copy per release; (b) yes, `020-rules/040-multi-agent-releases.md` | (b): a second release now uses them | W00 step 3 | open |
| Y16 | Agent type and model for dispatch | as for 1.9.0 (`general-purpose`; Haiku, Sonnet, Opus by difficulty, cheapest first), or another choice | as for 1.9.0 | every dispatch | open (the integrator asks before the first dispatch) |
| Y17 | Bare repositories with worktrees (W33) | (a) the bare repository as its worktrees' group header; (b) also a read-only graph of the bare repository, as its own slice | (a) | W33 | open |
| Y18 | Git Graph Libre's own per-repository settings across worktrees (W34) | (a) a new linked worktree inherits the main worktree's issue linking and pull-request settings; (b) share repository-level settings by common dir; (c) per worktree, as today | (a) | W34 | open |
| Y19 | Worktree telemetry (W50) | (a) add `view.worktreeMarker` and `view.linkedWorktreeRepo`, once per session, booleans only; (b) none | (a) | W50 | open |
| Y20 | Other worktrees' local changes (W51) | (a) on demand, when the worktree list opens; (b) defer | (a) | W51 | open |
| Y21 | Release name and version | (a) 1.10.0, "The Worktrees"; (b) another | (a) | W90 | open |
| Y22 | Other worktrees' detached HEADs in the graph (W12) | (a) always shown and marked; (b) shown, with a setting to hide them; (c) not shown | (a) | W12 | open |

**How to answer:** replace *open* with the choice, the date and any
condition, for example `(a), 2026-11-05`. Then flip the gated slices to
`Status: ready` in their own files, or ask the integrator to.
