---
summary: >-
  D22 · wave C · committed scope, needs D21 and X5 = (b) · Rust: Phase 17's port of
  VS Code's diff algorithm into `engine/native/diff`, cut into ten sub-slices
  of about 150–300 lines each (17.2–17.8). Each has its own acceptance; the full port is required for 1.9.0 under the maintainer's X5 answer.
---

# D22 — Phase 17 port sub-slices

Status: in progress — 22a integrated 425fb63 (499 accepted, X9); 22b ready
Needs: D21
Decisions: X5 = (b); Phase 17 D1, D2 and D5
Kind: Rust, the Rust arm applies · Size budget: per sub-slice, as listed
Source: Phase 17 under Future work, "Architecture", "Slices" and "Exactness rules"

**Read Phase 17 in full first.** Its exactness rules aren't optional:
UTF-16 code units, text-model line splitting, `libm` log, an injectable
clock. The full port is committed 1.9.0 scope under X5 (`2026-10-19`).
Each sub-slice is claimed and reported like a slice, by appending a
`### 22x Report` heading to this file, and uses its own branch
`diff-1.9.0/d22<x>`.

**Budgets (decision X9, `2026-10-19`).** For the Rust sub-slices (22a–22g),
a budget counts **production lines**: non-blank lines that aren't comments,
outside `#[cfg(test)]` modules and test files. License headers, doc
comments and unit tests are left out, because the legal plan and the
acceptance require them. Each budget is about 1.5× the code lines of the
VS Code source it translates (measured at `28a5623`, blanks and comments
left out; 22a came out at 1.7×). 22h–22j are TypeScript, build and seam
work, counted as the protocol counts any slice. A sub-slice over its budget
is reported and held for the maintainer, as before.

| Sub | Content | Acceptance |
| --- | --- | --- |
| 22a | crate skeleton: core types, the UTF-16 text model, line splitting, the clock trait, the fixture-format printer (accepted at 499, X9) | unit tests |
| 22b | `diffAlgorithm` and `myersDiffAlgorithm` (≤450; source 284) | ported unit tests |
| 22c | `dynamicProgrammingDiffing` and `lineSequence` (≤200; source 113) | ported unit tests |
| 22d | `linesSliceCharSequence`, with the helpers it needs from `utils` (≤350; source 190 + 59) | unit tests, including UTF-16 and emoji |
| 22e | `heuristicSequenceOptimizations` (≤520; source 341) | unit tests |
| 22f | the `defaultLinesDiffComputer` flow, without moves (≤350; source 222) | all 58 fixtures match without moves, in `cargo test` |
| 22g | `computeMovedLines` (≤420; source 270) | all fixtures match exactly, moves included |
| 22h | the `wasm` feature build and the five-way Vitest comparison (≤200) | zero mismatches beyond the documented moves |
| 22i | `pnpm run diff:parity` over real history (≤200) | results recorded in Phase 17 |
| 22j | the `diff_texts` and `diff_file_at_revisions` napi exports, the TS seam, and removal of `load_commit_file_diff` (≤300) | seam parity test |

The UI surface (Phase 17's slice 17.8) is planned: D4 is answered (G4,
option (c), `2026-10-19`), and the GGL Diff tab is wave D, slices
D40–D48. Only D45 and the slices after it need 22j.

**Never use gix or Git's diff in this crate** (decision X7). It reproduces
VS Code alone, and gix stays Git's.

22a claimed by Muse Code (muse-wonder-full-1.0, general-purpose, inherited runtime model) on 2026-10-19 10:50 Europe/Warsaw.

### 22a Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0, general-purpose, inherited runtime model; no named-model selector), 2026-10-19 11:05 Europe/Warsaw.
- **Branch and commits:** `diff-1.9.0/d22a` — `10f2209 G feat(engine): Phase 17 diff crate skeleton (D22a)`; plus the signed report commit carrying this section. No push.
- **Files changed:** new crate `engine/native/diff/` (`Cargo.toml` + `src/{lib,offset_range,line_range,position,range,range_mapping,lines_diff,text,clock,fixture}.rs`, 827 lines); `engine/Cargo.toml` +1/−1 (workspace member); `engine/Cargo.lock` +4; `engine/.gitignore` +1 (`!native/diff/` — see Deviations); this file (claim + report). Sources, file by file in each header: public MIT `microsoft/vscode` at `28a562309973a386b2bdefae78127788a4742fe8` (`core/ranges/{offsetRange,lineRange}.ts`, `core/{position,range}.ts`, `diff/{rangeMapping,linesDiffComputer}.ts`, `diff/defaultLinesDiffComputer/algorithms/diffAlgorithm.ts` for the timeout, `base/common/strings.ts` line splitting, the `test/node/diffing` fixture format cross-checked against D21's oracle suite). No wasm read; `@vscode/diff` embedded TypeScript not needed.
- **Tests added or changed:** 11 new unit tests in the crate (one module per file: range/line/offset basics incl. reversed-range behavior, position ordering, mapping flips, text-model splitting on `\r\n`/`\n`/`\r`, UTF-16 surrogate-pair counting, timeout expiry/latching on a fake clock, fixture-format printing with the `EOL` rule). Engine test totals: all workspace suites green (diff crate 11/11; core/node unchanged).
- **Gates:** biome n/a (no TS/JSON touched); typecheck n/a; `pnpm run test` not run (no TS change; engine addon untouched — the new crate is not yet linked into `native/node`); l10n n/a; kb:check pass (see report commit); Rust arm: `engine:fmt` clean, `engine:lint` (clippy `-D warnings`) clean, `engine:check` clean, `engine:test` all suites pass; Sonar: integrator.
- **Acceptance:** unit tests — met (11/11, above). Crate skeleton per Phase 17 17.2 — met: core types (`OffsetRange`, `LineRange`, `Position`, `Range`, `RangeMapping`, `LineRangeMapping`, `DetailedLineRangeMapping`, `LinesDiff`, `MovedText`, options), UTF-16 text model + line splitting, clock trait (`Clock`/`SystemClock`/`Timeout`, latching like `DateTimeout`), fixture-format printer (`[2,3)`, `[2,1 -> 2,5]`, ` EOL`, `moves` omitted when empty). Legal placements landing with real files — met: every ported Rust file carries its source file + commit, Microsoft's MIT copyright ("see LICENSE.mit") and the AGPL-3.0-or-later changes line; the crate's `Cargo.toml` license is `AGPL-3.0-or-later AND MIT` (D1), std-only, `#![forbid(unsafe_code)]`, no gix (X7), no new dependency.
- **Deviations from the slice:** (1) **Size budget exceeded — integrator decision needed.** The 22a row budgets ≤300 lines; the crate is 827 file lines, of which 499 are production code (excluding unit tests, license headers and doc comments), ~62 are the mandatory per-file legal headers and ~180 are the unit tests the acceptance requires. Even the production-only count exceeds 300: the named scope (seven core types + text model + clock + printer) does not fit 300 lines under the headers/tests discipline, so the work is committed whole for the integrator to accept or split (the natural split, if wanted: move `fixture.rs` to 22f, its first real user). Speculative helpers were already cut; later sub-slices add methods with their callers. (2) `engine/.gitignore` gained `!native/diff/`: its `native/*/` rule ignored the whole Phase-17-named placement, mirroring the existing `core`/`node` exceptions. (3) `Range` columns are `u32`; VS Code's `Number.MAX_SAFE_INTEGER` end-of-line sentinel has no skeleton user yet and will be normalized by the slices that need it.
- **Open questions / follow-ups:** the workspace `license = "MIT"` conflict (licensing verdict, Phase 17 legal item 6) is untouched, as instructed — the new crate overrides it locally with `AGPL-3.0-or-later AND MIT`, but `native/core`/`native/node` still inherit `MIT`; the maintainer must settle the workspace field. 22b builds on this skeleton unchanged.
