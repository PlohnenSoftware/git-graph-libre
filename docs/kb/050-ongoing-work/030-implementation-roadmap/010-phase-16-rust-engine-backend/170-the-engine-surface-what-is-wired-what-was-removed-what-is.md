---
summary: >-
  Audit of the 31 `#[napi]` exports (18 wired): five removed
  (`search_history`, write-flow helpers), dropping the `regex` crate; table of
  the exports kept unwired; a planned engine-only Statistics tab.
---

# The engine surface: what is wired, what was removed, what is kept (`2026-09-23`)

An audit of every `#[napi]` export against the TypeScript that calls it. **31
exports, 18 wired, 13 unwired.** The unwired ones are not an oversight — each
is listed below with why it is there — but they are not free either: a
`#[napi]` function is an exported symbol, so it is a linker *root* and LTO
cannot strip it. Dead exports are genuinely in every shipped binary.

**Removed (`2026-09-23`).** Five exports, chosen because a recorded permanent
non-goal blocks them forever, not because nothing calls them today:

| removed | why it could never be wired |
| --- | --- |
| `search_history` | superseded by `search_commits`; its regex semantics are wrong here |
| `current_branch_name` | consumer is a write flow |
| `current_branch_upstream` | consumer is a write flow |
| `remote_names` | consumer is a write flow |
| `load_commit_subject` | only consumer is the amend action |

"Every write stays on `runGitRaw`" is the first permanent non-goal, so the
last four had no reachable future. Their `api::Engine` methods, tests and the
orphaned `GitHistoryMatch`, `SEARCH_LIMIT` and `collapse_whitespace` went with
them. `Repo::remote_names` is a *different* function and stays — `graph.rs`
needs it for `load_commits`.

The TypeScript side lost `currentBranchName` too. It was declared on
`EngineAddon` **and in the `isEngineAddon` load-time guard**, so it could have
rejected a perfectly good engine binary over a method nothing called.

**What it saved.** `search_history` was the only consumer of the `regex`
crate, so the dependency went as well:

| | bytes |
| --- | ---: |
| before | `6,183,072` |
| after | `4,814,416` |
| saving | **`1,368,656` (22.1%) per platform, ~10.4 MB across all eight** |

**Kept deliberately — available for later wiring.** Nothing below is dead by
intent; each is a function whose consumer does not exist *yet*:

| kept | what it would serve |
| --- | --- |
| `activity_heatmap`, `author_stats` | **a Statistics tab** — see below |
| `load_uncommitted_details` | the `*` row, if it moves off the CLI (16.6) |
| `count_uncommitted_changes` | that row's count — redundant while `load_commits` builds it |
| `load_commit_file_diff` | a unified-diff renderer, replacing VS Code's diff editor |
| `new_path_of_renamed_file` | rename tracking between a commit and the working tree |
| `load_commit_bodies`, `load_commit_summaries` | batch message reads, if a view ever wants them |
| `count_commits_before` | anything needing `rev-list` counts |
| `load_tag_details` | blocked on signature verification, a permanent non-goal |
| `repo_root`, `submodules` | blocked on discovery semantics diverging from the CLI's |
| `open_repository` | explicit handle opening; handles currently open implicitly |

The last three rows are blocked rather than merely unwired, and could be
removed on the same reasoning as the five above. They are kept because the
maintainer may want the option, and because the saving is already taken.

**Planned: a Statistics tab.** The maintainer intends to add one
(`2026-09-23`). `stats.rs` already provides both halves — `author_stats`
(commit counts per author across every ref, merges excluded) and
`activity_heatmap` (author-local weekday/hour cells, sparse, merges excluded).
Both are inherited from `vscode-git-graph-rs`, where they backed that
project's own Statistics view, and neither has ever been wired here. Wiring
them is a feature slice, not a parity slice: there is no CLI implementation to
agree with, so the usual "two implementations, proven to agree" rule does not
apply and the engine would be the *only* backend. That is a deliberate
exception to design rule 2 and must be recorded as one when it happens —
including what the view does when the engine is unavailable, which for every
other read is "fall back to the CLI" and here would have to be "the tab is not
offered".
