---
summary: >-
  Done (`2026-09-23`): commit details and comparison via the engine
  (`details.ts`) with eager `load_line_counts`; `DiffDocProvider` reads file
  content from the engine; merges, the `*` row and failed counts reroute to
  the CLI.
---

# Slice 16.6 — Commit details, comparison, and line counts

`load_commit_details`, `load_stash_details`, `load_uncommitted_details`,
`compare_commits`, `load_line_counts`, `load_commit_file`,
`load_commit_file_diff`.

1. The engine returns file lists as statuses only and settles `+N/-M`
   separately, because each count reads two blobs. This project renders counts
   eagerly. Either adopt the deferred shape (a real UX change, so its own
   slice) or call `load_line_counts` for the whole list — measure both before
   choosing, and record the numbers here.
2. `load_commit_file_diff` covers the commit↔parent case only; an arbitrary
   from→to pair stays CLI.
3. Rename detection matches git's `-M50%`. Parity must cover renames, copies,
   binary files, a root commit, an unborn branch, and a file that is modified
   but unstaged.

Implementation record (`2026-09-23`, six subslice commits, all signed):

- 16.6a `src/backend/engine/details.ts`: strict parsers and mapping for
  the details payload, the bare `compare_commits` list, the `+N/-M` map,
  and the stash entries (find-by-hash plus the `stash_json` argument) —
  bodies through the CLI's own trailing-blank trim, counts joined by path
  exactly like the CLI's numstat pass, `Untracked` mapped to added (what
  `git stash show` reports).
- 16.6b reader `loadCommitDetails`/`loadCommitComparison` with eager
  whole-list `load_line_counts` fill, and both routes reading through the
  reader. Reroutes back to the whole CLI read: blank hashes/refs (the CLI
  rejects them before any git call), the `*` row (the engine would serve
  uncommitted-shaped data — a UX change for its own slice), multi-parent
  merges (the engine diffs the first parent only, the CLI passes `-m`),
  stash hashes (through `load_stash_details` diffed against the base with
  untracked appended), and any failed or malformed counts call (counts are
  the point of the read; serving them null would be silently wrong).
- 16.6c1/c2 file content: the addon seam gains `loadCommitFile`, and
  `DiffDocProvider` serves text from the engine on `auto`, falling back to
  `git show` on the `git-cli` preference, a missing addon, any engine
  throw, a malformed payload, or the binary marker — keeping the
  byte-identical binary presentation instead of an empty document.
- 16.6d parity table (against the built addon, `1.0.24`): a deterministic
  fixture proves renames arrive as `R` with settled counts, copies as `A`
  on both sides (neither passes `-C`), binary rows carry null counts on
  both sides, the root commit reports added files, merges stay CLI-served,
  unborn errors on both sides, and a dirty worktree leaks into no answer;
  `load_commit_file` bytes equal `git show` output, file for file,
  including across the rename, with the binary marker and matching
  failures on missing paths.
- Deferred-shape decision (item 1): eager whole-list fill, measured at
  7.8ms versus 7.5ms for the CLI's three spawns on a 200-file commit and
  1.1ms versus 4.3ms on a two-file one — within noise on large pages and
  decisively faster on small ones, with no UX change.
- `load_commit_file_diff` (item 2) has no TypeScript consumer and gains
  none here: both sides of `viewDiff` resolve through the single-revision
  provider, so an arbitrary from→to pair stays CLI by construction, and
  wiring the unified diff would be a renderer change for its own slice.
- `load_uncommitted_details` is likewise unwired: the `*` row stays on the
  CLI (see the 16.6b reroute), so the uncommitted shape is a later slice
  with the deferred-counts question if it ever renders counts.
- Gate: numbers in the 16.6e commit.
