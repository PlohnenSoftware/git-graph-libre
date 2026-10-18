---
summary: >-
  Audit of upstream `native/` to `6357ec1`: license still MIT, no new tainted
  port; ranked unported candidates (config staleness, tags of trees/blobs,
  shallow clones, status counts, topo seeding, numstat, encoding, replace
  refs, remote-ref special cases).
---

# Upstream engine review, first pass (`2026-10-16`)

At the maintainer's request, upstream's engine was audited for fixes worth
taking. Only `native/` was read, per the licensing verdict.

- **Where upstream is.** Tip `6357ec1` (`2026-09-30`, "bump version to
  1.0.26"). There are 23 commits after our `f93e8b2` baseline, and 8 touch
  `native/`. `gerrit.rs` is untouched since the baseline, and the root
  `LICENSE` is unchanged — `native/` is still MIT, by penghongxia. All 29
  `native/` commits of the imported range are in our history.
- **No new tainted port**, but some `ff4aafe` comments describe their
  TypeScript CLI backend ("trimmed as the CLI backend trims `%B`"). Reword
  those in terms of git when porting, as with `types.rs`. Taking any upstream
  commit means extending the `LICENSE.mit` roster date range and the boundary
  recorded in `engine/NOTICE.md` in the same change.
- **Upstream's `1.0.25` and `1.0.26` are different code from ours.** The
  version numbers collide; our line is independent of theirs.
- **Upstream did not add `use_author_date`.** Their graph rows always carry
  the committer date, so this project's `1.0.25` is its own work.

Ranked candidates. Every row was reproduced against our built addon, except
where noted. None is ported yet:

| # | Source | Bug in our engine | Value |
| --- | --- | --- | --- |
| 1 | ours (prompted by `5e25de8`'s message) | The handle reads config once, so remotes go stale after a remote edit. Suggested fix: reopen when `.git/config` or the global and XDG config mtimes change, which also catches terminal edits. Upstream closed handles from their own TypeScript instead. | high |
| 2 | `ff4aafe` `all_tips` | A tag naming a tree or blob stops `authors()` early (git.git and linux both carry one), truncating the author filter | high |
| 3 | `ff4aafe` shallow | At a shallow boundary, commit details and line counts fail with a genuine error (no CLI fallback), and the graph shows a missing parent | high |
| 4 | `ff4aafe` `status.rs` | The uncommitted count differs from the CLI: `add -N` 0 vs 1, `rm --cached` 1 vs 2, `status.renames=false` 1 vs 2 | high/medium |
| 5 | `ff4aafe` topo | Topological order seeded oldest-first; git seeds newest-first (`prio_queue_reverse`). A scratch build with upstream's ~6-line fix matched `git log --topo-order`, so the 16.5d6 explanation may be a misdiagnosis. Our parity table has not been run against it. | medium (could lift the `topoOrdering` decline) |
| 6 | `ff4aafe` `diff.rs` | Numstat misses a last line gaining its newline, submodule line counts, and empty-file renames | medium |
| 7 | `ff4aafe` `text.rs` | Non-UTF-8 commits ignore the `encoding` header; a subject after leading blank lines is lost | medium/low |
| 8 | `ff4aafe` | `refs/replace/*` is honored backwards by gix 0.88 — decline when any exist | medium/low |
| 9 | ours | The engine drops remote branches containing `/changes/` (a Gerrit leftover) and classifies `<remote>/…/tags/…` as tags; the CLI shows both as remote branches. Remove both special cases rather than port upstream's narrowing. | medium |

Not worth taking: the JSON `dispatch` layer and the `fileBytes` hex-viewer
exports (an unstrippable export and a `base64` dependency for a surface
nothing uses); single-file diff headers (`load_commit_file_diff` is unwired);
and `tag_details` and mailmap in `author_stats`, until the Statistics tab
exists.
