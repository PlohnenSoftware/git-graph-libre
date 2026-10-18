---
summary: >-
  D22 · wave C · stretch, needs D21 and X5 = (b) · Rust: Phase 17's port of
  VS Code's diff algorithm into `engine/native/diff`, cut into ten sub-slices
  of about 150–300 lines each (17.2–17.8). Each has its own acceptance; any
  not done and gated moves to the next release.
---

# D22 — Phase 17 port sub-slices (stretch)

Status: stretch — waiting on D21 and X5
Needs: D21
Decisions: X5 = (b); Phase 17 D1, D2 and D5
Kind: Rust, the Rust arm applies · Size budget: per sub-slice, as listed
Source: Phase 17 under Future work, "Architecture", "Slices" and "Exactness rules"

**Read Phase 17 in full first.** Its exactness rules aren't optional:
UTF-16 code units, text-model line splitting, `libm` log, an injectable
clock. Each sub-slice is claimed and reported like a slice, by appending a
`### 22x Report` heading to this file, and uses its own branch
`diff-1.9.0/d22<x>`.

| Sub | Content | Acceptance |
| --- | --- | --- |
| 22a | crate skeleton: core types, the UTF-16 text model, line splitting, the clock trait, the fixture-format printer (≤300 lines) | unit tests |
| 22b | `diffAlgorithm` and `myersDiffAlgorithm` (≤250) | ported unit tests |
| 22c | `dynamicProgrammingDiffing` and `lineSequence` (≤200) | ported unit tests |
| 22d | `linesSliceCharSequence` (≤300) | unit tests, including UTF-16 and emoji |
| 22e | `heuristicSequenceOptimizations` (≤350) | unit tests |
| 22f | the `defaultLinesDiffComputer` flow, without moves (≤250) | all 58 fixtures match without moves, in `cargo test` |
| 22g | `computeMovedLines` (≤300) | all fixtures match exactly, moves included |
| 22h | the `wasm` feature build and the five-way Vitest comparison (≤200) | zero mismatches beyond the documented moves |
| 22i | `pnpm run diff:parity` over real history (≤200) | results recorded in Phase 17 |
| 22j | the `diff_texts` and `diff_file_at_revisions` napi exports, the TS seam, and removal of `load_commit_file_diff` (≤250) | seam parity test |

The UI surface (Phase 17's slice 17.8) is planned: D4 is answered (G4,
option (c), `2026-10-19`), and the GGL Diff tab is wave D, slices
D40–D48. Only D45 and the slices after it need 22j.

**Never use gix or Git's diff in this crate** (decision X7). It reproduces
VS Code alone, and gix stays Git's.
