---
summary: >-
  Register of the three open GitHub issues, read in full with `gh` on
  `2026-11-04` and updated on `2026-11-06`. To tackle: #37 worktrees, still
  open, its core planned for release 1.10.0. On hold in the backlog, as
  matters of taste: #40 fetch that also updates the current branch, #42
  lighter ref badge icons. The five issues closed on `2026-11-06` (#36, #38,
  #41, #45, #46) moved to Closed GitHub issues and their threads under
  History. One subsection per open issue holds the thread, the verified facts
  and an agent assessment; how to implement #37 is still open.
---

# Open GitHub issues (`2026-11-04`)

**Updated `2026-11-06`.** GitHub closed #36, #38, #41, #45 and #46 when the
maintainer pushed `main`. Their subsections moved to History with `git mv`,
under Closed GitHub issues and their threads. Still open: #37 (to tackle),
and #40 and #42 (on hold). The rest of this register is as read on
`2026-11-04`.

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

Five of the six are closed as of `2026-11-06`, when the maintainer pushed
`main` and GitHub closed #36, #38, #41, #45 and #46. They are no longer listed
here: their subsections, with the closing commits and the slices that shipped
them, are under History in Closed GitHub issues and their threads.

Only #37 is still open to tackle. It is planned in Release 1.10.0 — "The
Worktrees" under Ongoing work, as the release's core: W02–W04, W10–W12 and
W30–W33 (`2026-11-04`). Its open choices are that release's decisions Y3, Y4
and Y22. It closes through the commit that completes it (Closing issues from
commits, under Rules), which the integrator writes once W33 is integrated.

| Issue | Opened by | Has a point? | Recommended direction (agent; details in the subsection) | Maintainer on GitHub |
| --- | --- | --- | --- | --- |
| [#37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37) worktree support | `KristjanESPERANTO`, `2026-10-26` | Yes | Phase 18. First slice is display only: a marker on branches checked out in another worktree, with the path on hover. Cheapest route is CLI-only `loadBranches`, where simple-git already parses the marker as `linkedWorkTree` and drops it | On the roadmap `2026-10-27`, for 1.10.0 |

## On hold: backlog (maintainer, `2026-11-04`)

Matters of taste, parked until the maintainer picks them up again. Their
subsections keep the assessment and options for that day.

| Issue | Opened by | Has a point? | Recommended direction (agent; details in the subsection) | Maintainer on GitHub |
| --- | --- | --- | --- | --- |
| [#40](https://github.com/PlohnenSoftware/git-graph-libre/issues/40) fetch also pulls | `rbalet`, `2026-10-28` | Partly: the need, not the coupling | Keep Fetch a fetch. If anything, add an unchecked "fast-forward the current branch" option to the Fetch dialog (`--ff-only`), pre-checked by a setting like `repository.fetchTagsByDefault` | Keep actions explicit (`2026-10-30`) |
| [#42](https://github.com/PlohnenSoftware/git-graph-libre/issues/42) lighter icons | `rbalet`, `2026-10-28` | Taste; partly | Ask which part reads as bulky. If pursued, build an opt-in light badge style of our own, contrast-checked for any `graphColors`. The model extension is no-derivatives licensed, so it is a visual target only | No reply yet |

Cross-issue links, as of `2026-11-04` (#36, #38 and #45 are closed now): #36
and #45 both wanted a per-branch upstream map. #37, #38
and #45 meet where a branch is checked out in another worktree, and Git then
refuses both checkout and delete. #40 and #45 (with #39) share one principle
in the maintainer's replies: each action does what it says, and nothing is
integrated without being asked for, so fast-forward only, offered explicitly.
