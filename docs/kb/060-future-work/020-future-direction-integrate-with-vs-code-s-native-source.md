---
summary: >-
  Unimplemented future direction that needs maintainer go-ahead: use the
  built-in `vscode.git` API (`repository.ui.selected`, `api.init`) and `scm/*`
  menu contributions instead of the graph's own selector; open questions.
---

# Future direction: integrate with VS Code's native source control (`2026-09-03`)

**Nothing here is implemented, and nothing should be implemented from it
without the maintainer saying so.** These are findings from a survey of what
VS Code 1.136 actually exposes, recorded so the next attempt starts from facts
rather than from a fresh survey. Maintainer's intent: stop treating the graph
as an island and cooperate with the editor's own SCM surfaces for **choosing
which repository is active**, **initialising new repositories**, and **showing
which repository the graph is on**. Repository selection in a graph navbar is
something the non-free Git Graph forks have and this project has only inside
its own toolbar; the maintainer would rather hook the editor's selector than
grow another one.

**The target is the built-in `vscode.git` extension's API** (confirmed by the
maintainer). It is reached with
`vscode.extensions.getExtension("vscode.git")?.exports.getAPI(1)`, and its
package version in 1.136 is `10.0.0`. Read it from
`resources/app/extensions/git/dist/main.js` when the shape matters; the useful
surfaces are:

- `api.repositories`, `api.onDidOpenRepository`, `api.onDidCloseRepository`,
  `api.getRepository(uri)`, `api.getRepositoryRoot(...)`, `api.openRepository`.
- **`repository.ui.selected` plus `repository.ui.onDidChange`** — this is the
  "which repository is active in the SCM UI" signal, and it is the piece worth
  building on. In the bundle it is a small class whose `onDidChange` wraps the
  repository's `onDidChangeSelection`, and `selected` reads straight through.
  Following it would let the graph track the editor's active repository instead
  of keeping an independent notion of one.
- **`api.init(uri)`** for creating a repository, rather than the
  `executeCommand("git.init")` route upstream took in `49c8025`. Both inherit
  the built-in behavior; the API version returns the repository.
- The workbench keeps `scm.activeRepositoryName` and
  `scm.activeRepositoryBranchName` context keys, usable in `when` clauses.

**On sitting "next to the branch selector":** that indicator is not a status
bar item an extension can neighbour reliably. The Git extension publishes it
through `SourceControl.statusBarCommands`, which the workbench renders itself —
the only `window.createStatusBarItem` in the whole Git extension is
`git.blame` (Right, priority 200). So the options are a status bar item of our
own with a tuned priority (fragile, ordering is a popularity contest), or the
sanctioned route: contribute to the SCM menus. The contribution points that
exist in 1.136 are `scm/title`, `scm/sourceControl`, `scm/repository`,
`scm/repositories/title`, `scm/resourceState/context`,
`scm/resourceGroup/context`, `scm/resourceFolder/context`, `scm/change/title`,
`scm/history/title`, `scm/historyItem/context`, `scm/historyItemRef/context`,
`scm/artifact/context`, `scm/artifactGroup/context` and `scm/inputBox`. An
"Open in Git Graph" on `scm/sourceControl` or `scm/repository` is the obvious
first step and costs almost nothing.

Open questions for whoever picks this up: whether the graph's own repository
dropdown should follow `ui.selected` or keep an independent selection (they
will disagree the moment someone changes one of them); whether selecting a
repository in the graph should write back through the Git extension at all,
given the API exposes selection as read-only state; and what happens in
multi-root workspaces where the graph currently tracks its own last-active
repository in `ExtensionState`.
