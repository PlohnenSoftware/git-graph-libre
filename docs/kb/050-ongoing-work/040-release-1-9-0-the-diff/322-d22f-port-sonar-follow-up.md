---
summary: >-
  D22F · ready · Rust and oracle scripts · ≤150 lines: bring 22b–22d under
  SonarQube's rules per X12/X13. Split three ported functions over cognitive
  complexity 16 into helpers, with every oracle corpus still matching byte for
  byte, and fix the oracle generators' valid findings (`replaceAll`, `fetch`
  instead of `gh`). The `charCodeAt` findings stay and are marked false
  positive.
---

# D22F — Port Sonar follow-up

Status: claimed by Claude Sonnet D22F on 2026-10-19 15:11
Needs: 22b, 22c, 22d (integrated)
Decisions: X12 (a), X13 (a)
Kind: Rust in `engine/native/diff/` and its oracle scripts; the Rust arm applies · Size budget: ≤ 150 changed production lines
Source: wave gate 5 (Sonar analysis `b9aa9fc4-ef2d-4999-be3a-eb922a5b15a3`)

## Goal

The quality gate's port findings are fixed without changing any result: the
three complexity findings by splitting functions, the generators' valid
findings by small rewrites.

## Facts (wave gate 5, `2026-10-19`)

| Rule | Where | What to do |
| --- | --- | --- |
| `rust:S3776` (high) | `engine/native/diff/src/myers_diff_algorithm.rs:23` | split into helpers in the same file, complexity ≤ 16 each |
| `rust:S3776` (high) | `engine/native/diff/src/dynamic_programming_diffing.rs:60` | the same |
| `rust:S3776` (high) | `engine/native/diff/src/line_sequence.rs:139` | the same |
| `javascript:S7781` ×5 | `tests/oracle/gen-line-sequence.mjs:113` | `replaceAll` |
| `javascript:S4036` (security) | `tests/oracle/gen-myers.mjs:49` (`execFileSync("gh")` through `PATH`) | fetch the sources with Node's `fetch` from `https://raw.githubusercontent.com/microsoft/vscode/<sha>/<path>`, as 22c's generators do, and drop the subprocess |
| `javascript:S7780` ×6, `S1516`, `S7758` in `gen-myers.mjs` | the generators | fix the `String.raw` and multiline-string ones if trivial |
| `javascript:S7758` ×4 | `gen-lines_slice_char_sequence.mjs:108,111`, `gen-dynamic-programming-diffing.mjs:99`, `gen-myers.mjs:116` | **keep `charCodeAt`**: the oracles measure UTF-16 code units, and `codePointAt` would change them. The integrator marks these false positive in Sonar (X13). |

The paths in the second column are under `engine/native/diff/`.

## Steps

1. Refactor each flagged Rust function into helpers in the same file,
   keeping VS Code's function names for the entry points and naming the
   helpers after what they do. Count cognitive complexity the way Sonar's
   S3776 does, and say in the report how you estimated it.
2. **Document every helper precisely (maintainer, `2026-10-19`).** Each
   helper's doc comment names the VS Code function it was split from (file
   and function, at `28a5623`) and exactly which part of that function it
   replaces: the lines (`myersDiffAlgorithm.ts` L<from>–L<to>) and a short
   description, for example "the inner `while` loop that extends a diagonal
   snake". The entry point's doc comment lists its helpers in call order,
   so someone re-syncing from a newer VS Code commit can map every upstream
   line to its Rust home.
3. Behavior must not change: every oracle corpus test (Myers,
   dynamic programming, line sequence, char sequence) and every unit test
   passes unchanged.
4. Fix the generator findings as the table says. After the change, every
   generator still reproduces its committed corpus byte for byte. For a
   generator that prints to stdout, check with
   `node <gen> | cmp - <data>`. For one that writes its own file, check
   that `git status` stays clean.

## Touch

The three Rust files above; the oracle generators under
`engine/native/diff/tests/oracle/`; this slice file's status and report.

## Acceptance

- Rust arm green: `engine:fmt`, `engine:lint`, `engine:check`,
  `engine:test`.
- Every generator reproduces its corpus byte for byte (paste the four
  checks).
- The integrator's next Sonar scan shows none of the table's findings
  except the four `S7758`, which it marks false positive.

## Report

- **Agent / date:** Claude Sonnet D22F, 2026-10-19
- **Branch and commits:** `diff-1.9.0/d22f`; see `git log --format='%h %G? %s' 7b54320..HEAD` (claim, Myers split, DP split, `line_sequence` test split, `replaceAll`, `String.raw`, `fetch`, this report); all signed `G`.
- **Files changed:** `myers_diff_algorithm.rs`, `dynamic_programming_diffing.rs`, `line_sequence.rs` (tests only), `gen-line-sequence.mjs`, `gen-myers.mjs`, this file.
- **Tests added or changed:** none added or changed in assertions; the `line_sequence` corpus test body was split into helpers with the same assertions. Rust arm: 166 tests passed, 0 failed (the Myers 437-case, DP and line-sequence 90-case corpus tests among them); no flaky failure seen.
- **Gates:** `engine:fmt`, `engine:lint`, `engine:check`, `engine:test` green; kb:check run before the final commit; Sonar: integrator.
- **Complexity (hand count, Sonar S3776 rules: +1 per `if`/`else if`/`else`/loop/`match`/labeled `break`/operator sequence, plus nesting; closures add nesting only):**
  - `MyersDiffAlgorithm::compute`: about 44 before; after `compute` 3, `x_after_snake` 4, `find_final_diagonal` 8, `extend_diagonal` 11, `backtrack_diffs` 6, `new` 0.
  - `DynamicProgrammingDiffing::compute_with_score`: about 60 before; after `compute_with_score` 3, `fill_tables` 6, `fill_cell` 4, `record_direction` 7, `extended_seq_score` 6, `AlignmentReport::report` 2, `backtrack_diffs` 6.
  - `line_sequence.rs:139` is the corpus test `matches_vscode_on_the_oracle_corpus`, not a ported function: about 25 before; after the test 3, `parse_case` 2, `check_elements_and_scores` 2, `check_strong_equality` 3, `check_texts` 3.
- **Byte-for-byte checks:** `node gen-myers.mjs | cmp - myers-oracle.txt` identical; `node gen-lines_slice_char_sequence.mjs | cmp - lines-slice-char-sequence-oracle.txt` identical; `node gen-dynamic-programming-diffing.mjs` and `node gen-line-sequence.mjs` (they write their files) leave `git status` clean.
- **Acceptance:** met, except that the Sonar re-scan is the integrator's.
- **Deviations from the slice:** (1) the `line_sequence.rs` finding is in the unit test, so its helpers are test helpers with no VS Code lines to map; their docs say so. (2) `S7780`: converted the backslash literals in `gen-line-sequence.mjs` to `String.raw`; the lone `'\\'` and the header comment strings (they contain backticks) stay, and I found no `S7780`, `S1516` or other trivial finding in `gen-myers.mjs` to fix (the `\n\t` patches need real escapes). The four `charCodeAt` `S7758` stay. (3) Myers `x_after_snake` is a method of a new private `MyersSearch` struct that holds the TypeScript's locals.
- **Open questions / follow-ups:** none.
