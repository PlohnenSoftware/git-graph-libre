---
summary: >-
  Register of the eight open GitHub issues, read in full with `gh` on
  `2026-11-04` (#46 on `2026-11-05`). To tackle (maintainer, `2026-11-04`):
  #36 push dialog defaults, #37 worktrees, #38 removing a leftover worktree,
  #41 whole-row checkboxes, #45 checking out a remote branch whose local
  branch exists (#39 closed as its duplicate); and (`2026-11-05`) #46 which
  remotes hold a tag, implemented by the reporter's PR #47. On hold in the backlog, as matters of taste: #40
  fetch that also updates the current branch, #42 lighter ref badge icons.
  One subsection per issue holds the thread, the verified facts and an agent
  assessment; how to implement each is still open.
---

# Open GitHub issues (`2026-11-04`)

Every open issue of `PlohnenSoftware/git-graph-libre`, read in full on
`2026-11-04` with `gh issue list --state all`, `gh issue view` and the issue
timelines, including every comment and screenshot. Each subsection below
records what was asked, every proposal made in the thread and by whom, the
maintainer's replies, the code and Git facts checked while reading it, and an
agent assessment of each proposal.

**Decisions (maintainer, `2026-11-04`).** #36, #37, #38, #41 and #45 are to
tackle. #46, opened `2026-11-05`, was added to them the same day, with the
reporter's draft PR #47 that implements it. #40 and #42 are on hold in the backlog: they are matters of taste,
parked until the maintainer picks them up again. Each subsection's `Decision`
line records this. **How** to implement each issue is not decided yet: the
assessments below are recommendations, and the maintainer records the chosen
approach in the issue's subsection, answering its open questions.

Closed issues, with the proposals made in their threads, are in Closed GitHub
issues and their threads under History. The tracker table in Implementation
Roadmap lists open and closed issues together. When an issue closes, move its
subsection to History with `git mv` in the same change, as Order of this
document says. Numbers missing from the issue list are pull requests: GitHub
numbers both in one sequence.

**Clean-room note.** Two threads point at the post-MIT Git Graph lineage,
whose license forbids distributing derivative works:

- The "expected" dialogs in #45 and its duplicate #39 ("The name … is already
  used by another branch: Choose another branch name / Checkout the existing
  branch & pull changes") are screenshots of the reporter's other tool, by
  their wording mhutchie's Git Graph.
- #42 names "Git Branch & Tag Graph" (`Gxl.git-graph-3`, source
  `git-hub-tig/vscode-git-graph`) as its model. The license text shipped with
  its Marketplace package (`1.37.19`) reads "Copyright (c) 2019-2021,
  mhutchie / Copyright (c) 2022-2025, hansu / Copyright (c) 2025-present, gxl
  … Permission is NOT GRANTED to publish, distribute, sublicense, and/or sell
  derivative works of the Software."

Both may serve only as a behavioral or visual target. Never read, consult or
copy their code, CSS, SVGs or strings; design and word our own, as License
review of the graph and stash UI slices and the `vscode-git-graph-rs`
licensing verdict under Licensing require.

## To tackle (maintainer, `2026-11-04`; #46 `2026-11-05`)

All six are planned in Release 1.10.0 — "The Worktrees" under Ongoing work
(`2026-11-04`):
- #36 as W25;
- #37 as the release's core: W02–W04, W10–W12 and W30–W33;
- #38 as W20 and W21;
- #41 as W06;
- #45 as W05 (the bug) and W24 (the feature);
- #46 as W26, which reviews and lands the reporter's PR #47 (`a109e9a`).

Their open choices are that release's decisions: Y11 for #36, Y3, Y4 and Y22
for #37, Y5 for #38, Y13 for #41, Y14 for #45, and Y23 and Y24 for #46. Each
issue closes through the commit that completes it (Closing issues from
commits, under Rules).

| Issue | Opened by | Has a point? | Recommended direction (agent; details in the subsection) | Maintainer on GitHub |
| --- | --- | --- | --- | --- |
| [#36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36) push dialog defaults | `cktgh`, `2026-10-26` | Yes, both points | Pre-check the remote plain `git push` would use (`%(push:remotename)`: `branch.<b>.pushRemote`, then `remote.pushDefault`, then the upstream's remote), then `origin`, then the first remote. Honor Git's `remote.pushDefault` instead of adding a setting. Pre-check Set upstream only for a branch with no upstream. Fix `-u` on several remotes, where the last remote pushed ends up tracked | Agreed `2026-10-27`, for 1.10.0 |
| [#37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37) worktree support | `KristjanESPERANTO`, `2026-10-26` | Yes | Phase 18. First slice is display only: a marker on branches checked out in another worktree, with the path on hover. Cheapest route is CLI-only `loadBranches`, where simple-git already parses the marker as `linkedWorkTree` and drops it | On the roadmap `2026-10-27`, for 1.10.0 |
| [#38](https://github.com/PlohnenSoftware/git-graph-libre/issues/38) delete worktree | `rbalet`, `2026-10-28` | Yes, but not as a force button | Detect the worktree up front (Phase 18's data) and offer a plain `git worktree remove` in the Delete Branch dialog. Use `--force` only after a second confirmation naming the files it deletes. A stale entry (folder already gone) and `git worktree prune` are safe | No reply yet |
| [#41](https://github.com/PlohnenSoftware/git-graph-libre/issues/41) wide checkbox selection | `rbalet`, `2026-10-28` | Yes | Make the checkbox `<label>` full width (`media/dialogs.css:198`, one rule), with a CSS regression test and a headless render | No reply yet |
| [#45](https://github.com/PlohnenSoftware/git-graph-libre/issues/45) checkout remote branch, local exists | `rbalet`, `2026-11-02` (duplicate: #39) | Yes, a bug and a feature | Bug (`cktgh`, confirmed): the suggested name drops path segments, so fix it with `parseRemoteBranchName()`. Feature: detect the existing branch before `git checkout -b` and offer switch, switch and fast-forward (`--ff-only`), or another name | Bug acknowledged `2026-11-03`; the rest is a feature |
| [#46](https://github.com/PlohnenSoftware/git-graph-libre/issues/46) tag on origin | `rbalet`, `2026-11-05` | Yes | Already implemented by the reporter's draft [PR #47](https://github.com/PlohnenSoftware/git-graph-libre/pull/47) (`a109e9a`): remote segments on tag badges from background `git ls-remote`, exact object match. Decide when remotes are contacted (Y23); rebase onto `main` and land with Rebase and merge (Y24) | No reply yet |

## On hold: backlog (maintainer, `2026-11-04`)

Matters of taste, parked until the maintainer picks them up again. Their
subsections keep the assessment and options for that day.

| Issue | Opened by | Has a point? | Recommended direction (agent; details in the subsection) | Maintainer on GitHub |
| --- | --- | --- | --- | --- |
| [#40](https://github.com/PlohnenSoftware/git-graph-libre/issues/40) fetch also pulls | `rbalet`, `2026-10-28` | Partly: the need, not the coupling | Keep Fetch a fetch. If anything, add an unchecked "fast-forward the current branch" option to the Fetch dialog (`--ff-only`), pre-checked by a setting like `repository.fetchTagsByDefault` | Keep actions explicit (`2026-10-30`) |
| [#42](https://github.com/PlohnenSoftware/git-graph-libre/issues/42) lighter icons | `rbalet`, `2026-10-28` | Taste; partly | Ask which part reads as bulky. If pursued, build an opt-in light badge style of our own, contrast-checked for any `graphColors`. The model extension is no-derivatives licensed, so it is a visual target only | No reply yet |

Cross-issue links: #36 and #45 both want a per-branch upstream map. #37, #38
and #45 meet where a branch is checked out in another worktree, and Git then
refuses both checkout and delete. #40 and #45 (with #39) share one principle
in the maintainer's replies: each action does what it says, and nothing is
integrated without being asked for, so fast-forward only, offered explicitly.
