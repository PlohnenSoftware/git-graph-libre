---
summary: >-
  Upstream engine audits through `c9be390` (`2026-11-08`), compared with
  GGL engine 1.0.31: prioritized candidates for ref-error reporting, bounded
  reads, author-date pagination, encoding, gitlink content, topo seeding,
  first-parent path filtering and allocation reductions. Includes reproduced
  failures, adoption caveats, already-covered changes and licensing boundaries.
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

Historical candidates as of `2026-10-16`. Every row was reproduced against
our then-built addon, except where noted. None was ported at that time; the
`2026-11-08` follow-up below records current findings and supersedes this
table for implementation planning:

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
| 9 | ours | The engine drops remote branches containing `/changes/` (a Gerrit leftover) and classifies `<remote>/…/tags/…` as tags; the CLI shows both as remote branches. Remove both special cases rather than port upstream's narrowing. Corrected `2026-11-08`: only the `/changes/` half holds. Since W26J (`2026-11-06`) the CLI also shows `<remote>/…/tags/<t>` as a `<remote>/<t>` tag, by the maintainer's decision, so that classification stays on both backends. | medium |

Not worth taking: the JSON `dispatch` layer and the `fileBytes` hex-viewer
exports (an unstrippable export and a `base64` dependency for a surface
nothing uses); single-file diff headers (`load_commit_file_diff` is unwired);
and `tag_details` and mailmap in `author_stats`, until the Statistics tab
exists.

## Follow-up review (`2026-11-08`)

Reviewed GGL `main` at `9a3281e`, engine source and installed local addon
`1.0.31`, against freshly fetched source `origin/main` at
`c9be390a2dbd0f174c74d8f9b078ae9b1ac79ccf` (`2026-10-31`). The source checkout
itself remains at `6357ec1`; it is 22 commits behind that remote ref. Three
of those commits touch `native/`: `8accdd1`, `f007528`, and `634ca6c`.
No upstream code was incorporated by this review.

The source root LICENSE has no changes since `6357ec1`. The existing
licensing verdict still defines the review boundary: inspect native patches,
exclude Gerrit source/tests and the restricted host/webview implementation.
A filename-only grep of the fetched tree for all nine Mission markers
returned no matches. Both newer large commits also touch Gerrit and restricted
layers, so importing either whole commit is inappropriate. Adapt selected
native hunks and their tests, with provenance/notices updated when adopted.

Recommended candidates, in implementation priority order:

| Source | Candidate | Current evidence and qualification |
| --- | --- | --- |
| `f007528` | Propagate ref-read failures in `graph.rs` | Both `repo_info` and `load_commits` still use `read_refs(...).unwrap_or_default()`. A temporary corrupt `packed-refs` fixture made the addon return empty branches, null HEAD and `error: null`; Git returned a fatal error. Small, high-value correction. Preserve our error-routing contract: genuine Git errors need not automatically fall back. Per-entry errors discarded inside `refs.rs` are a separate concern. |
| `634ca6c` | Bound blob/index/working-file reads before allocation | Our `blob.rs` loads full blobs without a size cap. The diff tab's disk read also reads the whole file before applying `maxFileSize`. Upstream checks object headers / file metadata against 100 MiB. Adapt to our limit policy (the diff tab CLI read caps at 64 MiB), rather than copying that constant. A metadata check alone does not bound a file that grows during the read. Source inspection only; no huge-file stress run. |
| `634ca6c` | Correct author-date page selection | Confirmed with 301 commits: a side tip with newest author date but old committer date comes first in Git; our addon instead starts at `c300`, having cut its window by committer date. Upstream walks all reachable commits to count children before choosing the author-date page. Benchmark CPU/memory and retain first-parent/shallow/worktree coverage before adoption; the upstream change only addresses unfiltered walks. This concerns ordering, separately from the date column already implemented here. |
| `ff4aafe` | Encoding-aware commit metadata and subject handling | Still absent: no `text.rs`, `read_commit` uses raw identity strings and `message.summary()`. An ISO-8859-1 fixture yielded `café` from Git and `caf�` from our addon. Adapt across graph, details, bodies, search and authors. Check Git output-encoding settings and unsupported labels; upstream's encoding_rs fallback is not universal Git encoding parity. |
| `f007528` | Gitlink content for revision/index reads | Confirmed: our revision reader reports the gitlink missing; the index reader expects a blob and errors on a commit object. Upstream returns `Subproject commit <hash>\n`. Useful for diff display, but explicitly align the CLI/display contract: this synthetic text is diff semantics, not necessarily raw `git show <rev>:<path>` output. |
| `ff4aafe` | Reverse initial ready-set seeding for topo order | Still missing in our `log::order`; the TS adapter still declines topo. Worth a focused parity experiment to remove that fallback, not enough evidence by itself to lift it. The previous pass tested a scratch build; this pass inspected the patch/current source, without rebuilding it. |
| `f007528` | First-parent path filtering | Confirmed fixture: Git lists `merge`, `base`; addon lists only `base`. Our `touches_paths` still compares every parent. Lower product priority because `buildLoadCommitsOptions` pins `filterPaths: []`. |
| `634ca6c` | Allocation reductions | Precompute author-match patterns once per walk; build the ref-annotation lookup once; avoid formatting remote prefixes per ref. Applicable but lower priority; no performance claim measured here. |

Do not take blindly:

- `8accdd1`'s symbolic remote HEAD correction: our `refs.rs` already resolves
  symbolic refs. Its title mentions SHA-256, but the native patch adds no
  SHA-256 support; that title is not an engine feature to import.
- Working-tree UTF-8/path hardening in `8accdd1`/`634ca6c`: our Rust library
  facade `Engine::file` still has the older behavior, but the live GGL Diff
  route already validates paths and decodes UTF-8 strictly in
  `src/extension/diffTab/engineSource.ts`. File size remains a live gap.
  Upstream's lexical path check is not symlink containment.
- `634ca6c`'s stash-base tips under branch filters: our CLI deliberately
  inserts stash rows only when their base is already on the selected page.
  Taking this engine change alone would break parity / branch-filter behavior.
- `f007528`'s regex history-search fix: our literal `search_commits` replaced
  that upstream `search_history` implementation.
- JSON dispatch and raw-byte exports: remain unused here. Old numstat,
  shallow-boundary, non-commit-tag and status candidates have been addressed
  here; the replace-ref workaround was superseded by our newer gix.
- Remote names containing `/changes/` remain a separate local cleanup
  candidate from the previous review. Our engine still hides them, the CLI
  does not, and upstream's Gerrit-oriented policy is not the desired
  replacement. The `/tags/` classification is not a candidate: W26J
  (`2026-11-06`) made both backends show those refs as `<remote>/<tag>`
  tags (corrected `2026-11-08`, when R06 found it).

Verification: refreshed both repositories' remote refs, inspected native-only
changes and current GGL call sites, and ran isolated Git fixtures through the
existing Linux x64 addon using `/tmp/ggl-upstream-review.cjs`. The final run's
fixtures are `/tmp/ggl-engine-review-mzQn8z` (temporary evidence, not durable
artifacts). Reproduced author-date selection, corrupt refs, revision/index
gitlinks, ISO-8859-1 metadata and first-parent path filtering. The addon reports
1.0.31 and agrees with the inspected source behavior; it was not rebuilt in
this review. No implementation changes, full gate, commit or push. Next slice:
ref-error propagation with regression tests, then bounded reads.

Documentation checks: `node docs/kb/housekeeping.mjs --check` and
`git diff --check` passed. `pnpm run kb:check` and `pnpm run kb:graph`
could not start because pnpm could not open its store operation lock on
the read-only filesystem. The equivalent direct KB check passed; graph
artifacts were not refreshed. The review note remains uncommitted.
