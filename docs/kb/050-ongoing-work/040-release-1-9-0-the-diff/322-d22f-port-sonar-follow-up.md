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

Status: ready
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
2. Behavior must not change: every oracle corpus test (Myers,
   dynamic programming, line sequence, char sequence) and every unit test
   passes unchanged.
3. Fix the generator findings as the table says. After the change, every
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

_(not started)_
