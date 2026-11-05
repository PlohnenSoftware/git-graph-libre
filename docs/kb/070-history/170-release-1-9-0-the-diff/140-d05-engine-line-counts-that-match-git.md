---
summary: >-
  D05 · wave A · ready · Rust · ≤200 lines: make the engine's `+N/−M` match
  `git diff-tree --numstat`. Count lines with their endings kept (gix strips
  them), rename empty files the way Git does (`track_empty`), and count
  submodule changes as Git does (1/0, 0/1, 1/1). Each gets a parity test.
---

# D05 — Engine line counts that match Git

Status: integrated c534f40
Needs: —
Decisions: —
Kind: Rust (the Rust arm applies) · Size budget: ≤ 200 changed lines outside tests
Source: Phase 16 candidate 6; the "Diff parity against real history" record, root causes 1, 5 and 6

## Goal

Remove the three engine-side differences from Git's numstat that the
`2026-10-18` audit isolated. The rest come from gix's Myers and land with
D07.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `engine/native/core/src/diff.rs`: `collect_changes`, `line_counts`, `classify`
- `engine/native/core/tests/git_parity.rs` and `tests/common/`: how the
  tests drive real `git`
- The diff-parity record under Phase 16, "Root causes"

## Facts (checked `2026-10-18` against gix `0.89`)

- `line_counts` calls gix `Platform::line_counts()`, which diffs
  `PrepareDiff::interned_input()`. That input strips LF and CRLF. So:
  - a final line gaining its newline counts `+N/−0`, where Git says
    `+N+1/−1`;
  - a CRLF-to-LF conversion counts `+0/−0`, where Git counts every line.
- `gix::object::blob::diff::Platform` exposes `resource_cache` publicly, and
  `PrepareDiff` exposes `operation`, `old` and `new`. So the engine can
  build `InternedInput::new(prep.old.intern_source(), prep.new.intern_source())`,
  which keeps line endings, and count with `Diff::compute(algorithm, &input)`
  without changing gix.
- `gix::diff::Rewrites` defaults `track_empty` to `false`, while Git's
  `diff_setup` sets `rename_empty = 1`. A renamed empty file shows up as an
  add plus a delete.
- Git's numstat for a gitlink is `1 0` when added, `0 1` when deleted and
  `1 1` when moved (its `Subproject commit` line). The engine reports none.

## Steps

1. In `line_counts`, replace `platform.line_counts()` with a local helper,
   `count_lines(platform)`. It prepares the diff, returns `None` for
   `SourceOrDestinationIsBinary`, and otherwise counts additions and
   removals over `intern_source()` tokens with the operation's algorithm.
2. Set `track_empty: true` in both `Rewrites` literals in `diff.rs`.
3. In `line_counts`, when either side is a gitlink (`entry_mode.is_commit()`),
   set the counts to Git's: added `(1,0)`, deleted `(0,1)`, modified `(1,1)`.
4. Change nothing else in `diff.rs`.
5. Mark the helper from step 1 as a temporary shim, with a comment: remove
   it once gix ships numstat-compatible counts (D30b), and switch back to
   `line_counts()`.

## Touch

`engine/native/core/src/diff.rs`, `engine/native/core/tests/git_parity.rs`

## Tests (each compares with `git diff-tree -r --numstat --find-renames` on the same commit)

- A final line gaining its newline.
- A file converted from CRLF to LF.
- `git mv empty.txt moved.txt` reported as one rename, matching
  `git diff-tree --name-status -M`.
- A submodule added, then moved to a new commit.

## Acceptance

- The Rust arm and the TypeScript gates pass, and all four tests fail on the
  old code.
- The engine version is unchanged: the TypeScript doesn't rely on anything
  new.

## Report

- **Agent / date:** Muse Code sub-agent D05, 2026-10-19 00:06
- **Branch and commits:** `diff-1.9.0/d05` — `01ff09b G fix(engine): match git numstat line counts (D05)`; plus this report commit
- **Files changed:** `engine/native/core/src/diff.rs` +68/−4; `engine/native/core/tests/git_parity.rs` +136/−0; this slice file +9/−2 (status and report)
- **Tests added or changed:** four parity tests in `git_parity.rs` — `a_final_line_gaining_its_newline_counts_as_git_counts_it`, `a_crlf_to_lf_conversion_counts_every_line_as_git_does`, `a_renamed_empty_file_is_one_rename_as_git_reports_it`, `a_submodule_counts_as_git_counts_it`; `git_parity.rs` 6 → 10 tests, engine total 115 → 119
- **Gates:** biome n/a (no `.ts`/`.mjs`/`.json` touched); typecheck pass; test backend 820 passed / 849 (29 skipped: "Engine addon not built" engine halves under `tests/backend/engine/`, the addon was not built in this worktree, so those halves did not exercise the new Rust code), webview 589/589; l10n n/a (no user-visible text changed); kb:check pass; Rust arm pass (`engine:fmt` check, `engine:lint` clippy `-D warnings`, `engine:check`, `engine:test` 119 passed); Sonar: integrator
- **Acceptance:** Rust arm and TypeScript gates pass — met, numbers above. All four tests fail on the old code — met: before the fix the newline test got `(0, 0)` against git's `(1, 1)`, the CRLF test `(0, 0)` against `(3, 3)`, the empty rename two changes (add plus delete) against git's `R100`, and the submodule add `(None, None)` against `(1, 0)`; all four pass after the fix. Engine version unchanged — met: workspace version still `1.0.25` in `engine/Cargo.toml`, no wire change, no `engine:build` run.
- **Deviations from the slice:** Step 3 also covers gitlink rewrites, which the slice did not name: a rename keeping the same submodule commit counts `(0, 0)`, one moving it counts `(1, 1)`. `count_lines` returns `None` for `ExternalCommand` as well as for binary (unreachable once external diffs are disabled; gix itself uses `unreachable!()` there). No other deviations; changes outside tests are +68/−4 in `diff.rs`, inside the ≤200 budget.
- **Open questions / follow-ups:** For the integrator: run `pnpm run engine:build` and the TypeScript tests so the 29 skipped backend engine halves exercise the new counts end to end, then Sonar.
