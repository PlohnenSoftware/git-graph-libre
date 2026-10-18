---
summary: >-
  Done (`2026-09-22`): `loadCommits` served by the engine (`commits.ts`),
  declining up front for the signature column, reflog, unreachable commits,
  `--glob=` and `topo`; parity table, known deviations.
---

# Slice 16.5 — `loadCommits`, and the three declines

The largest slice and the one that can most easily regress this fork's
distinguishing features. **Read the non-goals above before starting.**

1. Route to the engine **only** when none of the declines apply: reflog off,
   unreachable-commit discovery off, no `--glob=` branch patterns, and the
   signature column not requested. Anything else goes straight to the CLI —
   decided *before* the call, not by catching a failure.
2. Signature handling is the trap. `git-graph-libre.columns.signature` is off
   by default, so the engine path is the common one; but the moment the column
   is on, the whole load must take the CLI path, or `parseGpgsigPresence` and
   the `unverifiable` status disappear. A test must pin that turning the
   column on changes which backend serves the load.
3. Stash rows: the engine's `GitStash.base_hash` is this project's
   `sourceHash`, and injection above the base commit with parent-0-only
   linking must be preserved exactly — the layout walker loops forever
   otherwise (see the Slice 4 note under the graph/stash section).
4. Uncommitted-changes row, `more_commits_available`, author and path filters,
   and the three commit orderings all have engine equivalents; the engine's
   ordering is exact within a bounded window rather than over the whole
   history, which is a real behavioral difference — pin it with a parity test
   over a branchy history and record the result, then decide whether it is
   acceptable or whether this read stays CLI.

Acceptance: parity across filters, orderings, page sizes and stash display;
every declined shape provably lands on the CLI; the `1.2.0` signature
behavior unchanged.

Implementation record (`2026-09-22`, twelve subslice commits, all signed):

- 16.5a `src/backend/engine/commits.ts`: the pre-call decline predicate
  (`showSignature`, `Author Date`, reflog/unreachable discovery on
  show-all loads, `--glob=` patterns; the `Author Date` decline was lifted
  on `2026-10-16` by engine `1.0.25`, see "Author Date through the engine,
  and the status indicator") plus the `LogOptions` builder reusing
  the CLI's own ref/author/remote helpers with CLI-equivalent constants.
- 16.5b wire guard (`parseEngineCommitData`) and node mapping
  (`mapEngineCommitData`): heads/tags/remotes onto project refs, no
  `signature` key except the CLI-pinned null on stash rows, in-place stash
  marks stripped, rows dropped when the caller did not opt in.
- 16.5c reader `loadCommits` with the 16.3 routing shape, the route reading
  the preference live, and the loader refusing binaries without the new
  export. Routing cases with a counted CLI module, including the pin that
  turning the signature column on moves the load from engine to CLI.
- 16.5d1 ref labels re-sorted into `for-each-ref` order (heads, remotes,
  tags, byte-sorted) and the root `[""]` parse artifact mirrored, so the
  parity table stays a strict `toEqual` that fails loudly on CLI change.
- 16.5d2 the tag scan flag covers shown *or* selected tags (the CLI scans
  `refs/tags` for both) while only shown tags become walk tips.
- 16.5d3/d5 two CLI fills, each gated on page content so remoteless loads
  pay no spawn: symbolic remote HEADs (`origin/HEAD`) attached in CLI
  order, and signed-tag badges flipped reusing the loader's own signature
  atom (probed end to end against a crafted PGP-signed tag).
  **Both were removed on `2026-09-23`** — the engine now carries the two
  fields itself and the `loadCommits` engine path spawns nothing. See "The
  two ref fills, removed from the engine rather than optimised".
- 16.5d4 post-call reroutes: unborn stays on the CLI, which owns the
  empty-graph error shape; unfiltered show-all pages that lost HEAD go back
  to the whole CLI read, mirroring the move-HEAD-onto-page contract.
  Filtered loads exclude HEAD by request on both backends.
- 16.5d6 `topo` declined to the CLI: the engine walks each history line
  depth-first while git interleaves branch lines by date under the same
  topological constraint — both valid, visibly different row orders. Date
  and author-date agree byte for byte past the window floor.
- 16.5d7 parity table: deterministic fixtures (branchy clean/dirty, clone,
  detached deep/tip, unborn, 30-commit roomy) across orderings, filters,
  page sizes and stash display, strict `toEqual` with the served flag. Only
  the `*` date is masked; author cases collapse the pre-existing CLI
  duplication quirk below.
- Probe findings (throwaway scripts, `/tmp/parity*`, preserved for review):
  date/author-date exact on a 433-commit branchy history past the
  256-commit window floor, so the window never materialized; same-second
  ties can order differently on either backend (inherent to equal
  timestamps, recorded); the CLI duplicates an author match when HEAD is
  filtered out — its detached recovery re-queries HEAD alone and prepends
  a row that already appears below, adjacently or not — while the engine
  is provably correct, so the loader keeps that bug for its own behavior
  slice; `for-each-ref` sorts globally (heads < remotes < tags) while the
  engine annotates heads, tags, remotes; unborn errors on the CLI where the
  engine returns null; a detached HEAD deeper than the page needs the
  CLI's move-onto-page.
- Known engine deviations, recorded not fixed (exotic layouts): Gerrit
  `/changes/` refs are dropped from labels, remote tag refs
  (`refs/remotes/*/tags/*`) classify as tags rather than remotes, and a
  dangling symref HEAD with no other remote label on the page gets no fill
  (the fill gates on page remotes).
- Gate: numbers in the 16.5e commit.
