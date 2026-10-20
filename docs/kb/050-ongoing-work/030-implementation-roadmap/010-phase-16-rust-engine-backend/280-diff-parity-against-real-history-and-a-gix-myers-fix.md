---
summary: >-
  How a diff is produced on each backend; a sweep of 5,500 commits and 300
  ranges of git.git and gitoxide against the CLI's own commands; root causes
  (gix strips line endings before counting, gix Myers differs from xdiff, the
  unreleased rename-limit and replace-ref fixes, rename scoring, empty-file
  renames, gitlink counts, CLI merge and stash bugs); the two-commit gix
  branch taking 373 of 72,702 differing files to 0; ranked engine follow-ups.
---

# Diff parity against real history, and a gix Myers fix (`2026-10-18`)

**Status: analysis done; the gix fix is pushed to the `PlohnenSoftware/gix`
fork, and the maintainer opens the upstream PR (draft text kept with the
branch's commit messages); nothing in this repository changed except this
record.** The maintainer asked how diffs work here, which engine gaps are
worth filling, and what could be added to gix, and to contribute it there.

**How a diff is produced today.**

- *File list and `+N/-M`.* Commit Details goes through `readCommitDetails`
  (`src/backend/engine/index.ts`): the engine's `load_commit_details`
  (`diff::diff_commit`, a gix tree diff against the first parent, renames at
  50%, no copies, type changes dropped) and then `load_line_counts`
  (`diff::line_counts`, gix `Platform::line_counts()`) for the whole list.
  The CLI side (`commitDetails.ts`) runs `git diff-tree -z -r -m --root
  --find-renames --diff-filter=AMDR` twice, `--name-status` and `--numstat`,
  and `diffFileChanges.ts` joins them by path. The engine hands `*`, blank
  hashes, merges and failed or malformed counts back to the CLI.
- *Stashes.* The engine reads `load_stash_details`: the stash against its
  base, with the third parent's files appended as untracked. The CLI runs the
  same `diff-tree -m` as for any commit.
- *Compare with HEAD.* `readCommitComparison` reads the engine's
  `compare_commits` (`diff::diff_revisions`) plus `line_counts` from the base.
  The CLI runs `git diff -z --find-renames --diff-filter=AMDR` with
  `--name-status` and `--numstat`.
- *The `*` row.* CLI only, `git status --porcelain=v1 -z
  --untracked-files=normal`, with no counts. The staging panel opens no diffs.
- *The diff itself.* This project renders no unified diff. `viewDiff` opens
  VS Code's `vscode.diff` on two `git-graph-libre:` URIs (`<hash>^` and
  `<hash>`, or the comparison's two refs), and `DiffDocProvider` fills each
  side from the engine's `load_commit_file`, or `git show <rev>:<path>` for
  binary or non-UTF-8 files, and `""` on failure.
  `compareFileWithWorkingTree` puts the working file on the right side.
  `load_commit_file_diff`, the engine's own unified diff, stays unwired.

**Method.** A scratch Rust harness outside the repository linked
`git-graph-core` and compared `diff_commit` plus `line_counts` with the exact
CLI commands above. It covered the last 4,000 non-merge commits of `../git`
(git.git at `6de20f6092`) and 1,500 of `../gix` (gitoxide at `d568e8b78`),
plus 150 ranges of 30 first-parent commits in each through `git diff`. A
second build replaced gix with `../gix` `main` through `[patch.crates-io]`,
and a fixture repository covered the edge cases. The harness is not kept;
this paragraph is the recipe.

**Results, engine `1.0.25` on gix `0.89`.**

| corpus | compared | file lists differ | counts differ |
| --- | ---: | ---: | ---: |
| git.git commits | 4,000 | 1 | 78 |
| gitoxide commits | 1,500 | 1 | 37 |
| git.git ranges | 150 | 2 | 67 |
| gitoxide ranges | 150 | 21 | 42 |

**Root causes, each reproduced:**

1. **Line counts: gix ignores line endings.**
   `PrepareDiff::interned_input()` diffs lines with their LF/CRLF stripped,
   a deliberate gix choice (`intern_source_strip_newline_separators`). So a
   last line gaining its newline counts `+N/-0` where git says `+N+1/-1`,
   and a CRLF-to-LF conversion counts `+0/-0` where git counts every line.
   106 files in the corpus. Engine-local fix: in place of
   `Platform::line_counts()`, diff an `InternedInput` built from
   `prep.old.intern_source()` and `prep.new.intern_source()`, which keep the
   terminators. This is candidate 6's first half.
2. **Line counts: gix's Myers is not git's.** 373 of the 72,702
   modified or renamed files differ even with terminators kept. There are two
   causes in `gix-imara-diff`, both fixed on the gix branch below: it counted
   line frequencies only between the trimmed common ends, and it numbered
   `xdl_split()`'s edit cost from 0.
3. **Renames, gix `0.89`.** `Rewrites::limit` compares sources × destinations
   against the unsquared limit, so more than 1,000 pairs turns off inexact
   rename detection. In the fixture, 40 deletes × 30 adds gave 70 adds and
   deletes instead of 30 renames. Upstream fixed this in `e571a9273`, not yet
   released; on gix `main` the ranges' file-list differences fall from 21 to 8
   and from 2 to 1.
4. **Renames, scoring.** gix scores similarity by the bytes a line diff
   keeps; git scores it by hashed byte chunks (`diffcore-delta.c`).
   gitoxide `248186c` renames `make_transport_repos.sh` at git's 65%, which
   gix scores 0.457 and splits into an add and a delete. This accounts for
   every file-list difference left on gix `main`. It is an upstream
   candidate and needs a discussion first.
5. **Renames, empty files.** gix defaults `Rewrites::track_empty` to `false`,
   while git's `diff_setup()` sets `rename_empty = 1`. The engine builds its
   own `Rewrites`, so `track_empty: true` is a one-line engine fix.
6. **Submodule counts.** git's numstat gives a gitlink `1/0` when added and
   `1/1` when moved (its `Subproject commit` lines). The engine reports none,
   which renders like a binary file. Engine-local fix.
7. **Replacement refs.** The gix `0.89` inversion behind `decline_replace_refs`
   is fixed upstream in `1b6d8da7a`, not yet released. Drop the decline with
   the gix bump.
8. **Merges, a CLI bug and the reason for the engine reroute.** `-m`
   concatenates one section per parent. A clean merge therefore lists the
   second parent's files too (`A main-only.txt` in the fixture), and
   `viewDiff` opens `<merge>^` against `<merge>`, two identical sides. The
   first-parent list the engine already computes matches `viewDiff`. Choosing
   it is a user-visible change, so it is the maintainer's decision and its
   own slice; it would also lift the `mergeCommit` reroute.
9. **Stashes on the CLI, a bug.** Take a fixture with one staged change, one
   unstaged change and one untracked file. The CLI lists `feature.txt` three
   times, `shared.txt` twice, a foreign `A main-only.txt`, and the untracked
   file as `D`. `git stash show -u` and the engine list three rows. Anyone on
   `backend: "git-cli"`, or without the engine, sees the wrong list, and no
   parity case covers stash details.
10. **Stashed untracked files diff empty on both backends.** `viewDiff` reads
    `W:<path>`, but the file is in `W^3`, so the provider serves `""`.
11. **Type changes are dropped on both backends** (`--diff-filter=AMDR`), so
    a commit turning a file into a symlink lists nothing. The backends agree;
    it is a UX gap.
12. Checked and not gaps: `diff.algorithm=patience` (the engine opens
    config leniently), the `binary` and `-diff` attributes, and mode-only
    changes.

**The gix contribution.** Branch `fix/imara-myers-whole-file-occurrences` in
`../gix`, whose `origin` is the `PlohnenSoftware/gix` fork, holds two signed
commits, rebased onto upstream `7540f69bf`:

- `bf62edd59` counts line frequencies over the whole input and takes the
  limits from the whole input's length, as `xdl_classify_record()` and
  `xdl_cleanup_records()` do. It also stops `MyersMinimal` pruning frequent
  lines, as `XDF_NEED_MINIMAL` does.
- `abdfc45db` numbers `xdl_split()`'s edit cost from 1. `MyersMinimal` stays
  bounded by the cost limit where git's is unbounded: unbounding it made the
  clusterfuzz timeout test take 94 s.

Result: 373 of 72,702 files → 0, and 216 pseudo-random pairs disagreeing
37 → 0. Two new integration tests carry counts from `git diff --no-index
--numstat`, and each fails without its commit. These suites passed:
`gix-imara-diff`, `gix-diff` (including the strict slider smoke baseline),
`gix-blame`, `gix-merge`, `gix-status`, and the `gix` diff and status
tests. `clippy -D warnings` and `fmt` are clean. Every step of gitoxide's
`just test` recipe was then run by hand, since neither `just` nor
`cargo-nextest` is installed here, with `cargo test` in place of nextest:
47 of 51 steps passed. The 4 failures also fail on a clean `upstream/main`
worktree. Six `gix-path`/`gix-config` tests need an `/etc/gitconfig`, which
this machine lacks. Eight `pack receive` journey snapshots record pack
hashes that this machine's Git 2.56 builds differently. With the stored
snapshots cleared, all four journey suites run to the end, and the snapshots
they regenerate on the branch are byte-identical to upstream's. Gitoxide's `CONTRIBUTING.md`
requires an agent to identify itself in PR text and asks for a discussion
before more than ~500 SLOC; this change is ~130 lines.

**Engine follow-ups, ranked.**

1. **One slice, engine only:** count lines with terminators kept,
   `track_empty: true`, and gitlink counts. Parity cases: newline at EOF,
   CRLF conversion, submodule add and move, and an empty-file rename.
2. Bump gix once a release carries the Myers fix, `e571a9273` and
   `1b6d8da7a`, then delete `decline_replace_refs`. **Done `2026-10-20`
   (D07, `7d87525`)** without waiting for the release. At the maintainer's
   choice, gix and all its crates come from gitoxide `main` `0a49d46f6a0b`,
   which carries all three, through `[patch.crates-io]`. Last 500
   non-merge commits, files whose counts differ from Git, before and
   after: git.git 16 of 1,315 → 0; `../gix` 17 of 7,835 → 1; this
   repository 12 of 2,001 → 9, all in the generated `graphify-out/graph.json`.
   The 40 × 30 rename fixture lists 30 renames, as Git does. Once a gix
   release carries the fixes, replace the patch with it.
3. Fix the CLI stash details: diff against `W^1` and list `W^3` as added.
   Fix the stashed-untracked diff side. Add a stash-details parity case.
4. The maintainer's call on merges: first-parent, then lift `mergeCommit`.
5. Upstream: git-compatible rename scoring, after a gix discussion.
