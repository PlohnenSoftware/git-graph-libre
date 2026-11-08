---
summary: >-
  R03: Traversal correctness. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R03 — Traversal correctness

Status: integrated `ac2fec4`

Needs: none

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/log.rs; new engine/native/core/src/log/*.rs; engine/native/core/tests/traversal_parity.rs; src/backend/engine/commits.ts; tests/backend/engine/commits.test.ts; tests/backend/engine/parity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Fix author-date page membership (including filters), topo initial seeding, first-parent path filtering and relevant author-pattern allocations. Read upstream permitted native patches 634ca6c and ff4aafe/f007528. Test against Git with divergent clocks, merges, equal dates, shallow clones, pagination and filtered histories. Benchmark larger history and record CPU/memory tradeoffs. Remove topo decline only when proven, updating relevant tests. Keep public helper used by search compatible. Can add modules under log/ to avoid complexity.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-08
- **Branch and commits:** `engine-review/R03`
  - `3d9c405 G` fix(engine): judge first-parent path filters against the first parent (R03)
  - `6b28535 G` fix(engine): match git's topological order, seeded newest tip first (R03)
  - `9a8f3db G` fix(engine): hold exactly git's author-date page, filtered or not (R03)
  - `c331f7a G` perf(engine): prepare author patterns once per walk (R03)
  - `1669f98 G` feat(engine): serve topological order from the engine (R03)
  - (the re-claim commit `282c7b5 G` precedes them; the body of `6b28535` says "0 of 1080" where the exploration run was 0 of 1224)
- **Files changed:** `engine/native/core/src/log.rs` (restructured walk, `touches_paths` first-parent), new `engine/native/core/src/log/ranked.rs` and `log/authors.rs`, new `engine/native/core/tests/traversal_parity.rs` (14 tests), `src/backend/engine/commits.ts`, `tests/backend/engine/commits.test.ts`, `tests/backend/engine/parity.test.ts`.
- **Tests added or changed:** 14 Rust tests in `traversal_parity.rs` (first-parent path filter; topo seeding, merges, criss-cross, old tips a date window would cut, shallow clone, path filter; generated-history parity for topo, date and author-date across Ticking, Equal and Skewed clocks, branch subsets, author filters, pages across the 256-commit window floor; the 301-commit author-date fixture; filtered author-date pages; a path-filtered author-date page; page boundary for all three orderings). TypeScript: the decline test now pins that topo is served, and the parity table runs topo as engine-served (branchy, roomy, skewed, with branch, author and page-size variants). Vitest `commits`/`parity`: 58 passed. Mutations checked: a windowed topo walk fails the old-tips test; a windowed author-date walk fails the 301-commit test; the first-parent test failed before the fix.
- **Gates:** `cargo test -p git-graph-core` all suites ok (traversal_parity 14 passed, plus log_and_refs, git_parity, search and the rest); `pnpm run engine:fmt` ok; `pnpm run engine:lint` (clippy `-D warnings`) ok; `pnpm run engine:test` ok; `pnpm run engine:build` ok; `npx vitest run --project backend tests/backend/engine/commits.test.ts tests/backend/engine/parity.test.ts` 58 passed (not skipped); `pnpm run typecheck` ok; strict Biome on the three TypeScript files ok. All with `CARGO_BUILD_JOBS=8`. Sonar: integrator.
- **Acceptance:**
  - First-parent path filter: met (matches `git log --first-parent --all -- <path>`).
  - Topo seeding, adapted from `ff4aafe`: met. Seeding alone did not give parity (equal dates: 38 of 40 generated histories differed, skewed large histories 4 of 8), so date and topo pages now use a git-shaped traversal (`log/ranked.rs`): committer-date visit with first-found ties, then Kahn ranking. Parity then held in 1224 of 1224 exploration comparisons (topo; clocks Ticking/Equal/Skewed; 40 and 320 commits; subsets of tips; no/Alice/Bob author filter; page 12/25/1000), the committed tests cover a subset of that matrix. **The topo decline is lifted** (`loadCommitsDecline` no longer returns `topoOrdering`). Topo reads the whole reachable history (headers only), as git does; a date window cannot be exact, because an old-dated tip surfaces as soon as the line above it ends.
  - Author-date page membership, adapted from `634ca6c` (idea and test shape only): met for unfiltered and filtered (author, branch, path) walks, no bounded heuristic. Full-history ranked walk for `author-date` and `topo` commit orderings only. **Cost note (corrected by the integrator):** it is paid for the `author-date` and `topo` commit orderings, a per-repository choice whose default is `date`; it is not tied to the `dateType` display setting `Author Date`. Release build, page of 100, min of 3 runs: this repository (1,458 commits) 4 ms before, 18 ms after, 16 MB resident both; generated 150,000-commit history (linear spine, 8% merges, skewed dates) 1 ms before, 614 ms after (0.62 s CPU), 16 MB before, 81 MB after; author filter on the same history 1 ms before, 602 ms after. `git log --author-date-order -n 100` on the same history takes 0.39 s with no commit-graph. Committer-date order is unchanged (about 1 ms there).
  - Allocation reduction (`634ca6c`): author patterns prepared once per walk (`log/authors.rs`): met; no timing claimed. The ref-annotation lookup and remote-prefix items of `634ca6c` are in `graph.rs`/`refs.rs`, not in this slice's Touch list, and were left to R06.
  - Public helper for `search.rs`: `commit_matches_author` keeps its signature.
- **Upstream adaptation (for `engine/NOTICE.md`):** `f007528` `native/core/src/log.rs` (the `touches_paths` `first_parent_only` hunk); `ff4aafe` `native/core/src/log.rs` (`order()`: reverse the initial queue for topo) and the shapes of its topo tests in `native/core/tests/log_and_refs.rs`; `634ca6c` `native/core/src/log.rs` (the author-date idea: count children, rank the ready set by author date; `prepare_author_patterns`) and the shape of its 301-commit fast-import test in `native/core/tests/log_and_refs.rs`. `native/core/tests/common/mod.rs` was read and not adapted. The traversal module, the filters and all tests are our own code. The commits carry the `Co-authored-by: neophack` trailer, except the TypeScript commit and the re-claim.
- **Deviations from the slice:** (1) The date ordering of an unfiltered walk also moved to the new traversal, for tie parity with git; it reads only headers for the window, then full records for the page. (2) `GraphLoadDecline` in `src/types.ts` still lists `topoOrdering` and the webview/l10n strings remain: both are outside the Touch list and now unreachable. (3) The date ordering of a *filtered* walk is unchanged: it still reads in commit-time order and is not re-ranked, so `--date-order --author=<x>` can differ from git when committer clocks are skewed or equal (measured in the exploration; not part of this slice).
- **Open questions / follow-ups:** an incremental walk using commit-graph generation numbers could bound the full-history cost, as git does. The integrator may want to remove the unused `topoOrdering` decline reason from `src/types.ts`, the webview and the l10n bundles. Equal-date ties between tips depend on the order tips are passed: the engine passes heads before remotes and stashes, the CLI passes ref order, so on equal dates the two can differ; the generated parity tests give both the same tip order. Scratch benchmark binaries and a 150,000-commit repository remain in the session scratchpad (outside the worktree).

