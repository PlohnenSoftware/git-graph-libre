---
summary: >-
  D22 · wave C · committed scope, needs D21 and X5 = (b) · Rust: Phase 17's port of
  VS Code's diff algorithm into `engine/native/diff`, cut into ten sub-slices
  of about 150–300 lines each (17.2–17.8). Each has its own acceptance; the full port is required for 1.9.0 under the maintainer's X5 answer.
---

# D22 — Phase 17 port sub-slices

Status: in progress — 22a–22d integrated (last 22748ed); 22e and 22g ready, in parallel; 22f after both
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

**Helpers (decisions X12, `2026-10-19`).** A ported function over Sonar's
cognitive-complexity limit (16) is split into helpers in the same file. Each
helper's doc comment names the VS Code function it comes from (file and
function at `28a5623`) and exactly which lines and which part of that
function it replaces. The entry point lists its helpers in call order, so a
re-sync can map every upstream line to its Rust home. The oracle corpora must
match byte for byte after any split.

**Order (integrator, `2026-10-19`).** `computeMovedLines` imports neither the heuristics nor the main computer, so 22e and 22g run in parallel. 22f wires both into the flow, so it runs after them and takes over the full fixture match, moves included. Oracle generators print their corpus to stdout, as `gen-myers.mjs` does, so a rerun can be compared with `cmp`.

| Sub | Content | Acceptance |
| --- | --- | --- |
| 22a | crate skeleton: core types, the UTF-16 text model, line splitting, the clock trait, the fixture-format printer (accepted at 499, X9) | unit tests |
| 22b | `diffAlgorithm` and `myersDiffAlgorithm` (≤450; source 284) | ported unit tests |
| 22c | `dynamicProgrammingDiffing` and `lineSequence` (≤200; source 113) | ported unit tests |
| 22d | `linesSliceCharSequence`, with the helpers it needs from `utils` (≤350; source 190 + 59) | unit tests, including UTF-16 and emoji |
| 22e | `heuristicSequenceOptimizations` (≤520; source 341) | unit tests |
| 22f | the `defaultLinesDiffComputer` flow, wiring in 22e's heuristics and 22g's moves (≤350; source 222) | all 58 fixtures match exactly, moves included, in `cargo test` |
| 22g | `computeMovedLines` (≤420; source 270) | an oracle corpus against VS Code's own `computeMovedLines` |
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

22b claimed by Claude Sonnet 5.5 (sub-agent for the integrator) on 2026-10-19.

### 22b Report

Status: done — awaiting integration

- **Agent / date:** Claude Sonnet 5.5 (sub-agent for the integrator), 2026-10-19.
- **Branch and commits:** `diff-1.9.0/d22b` — claim `ac741c8`; `748556d` OffsetRange `delta_start`, `delta_end`, `intersects_or_touches`; `3686bf4` `diff_algorithm.rs`; `6fdd191` `myers_diff_algorithm.rs` with the oracle corpus; plus the signed report commit. All `G`. No push.
- **Files changed:** new `engine/native/diff/src/{diff_algorithm,myers_diff_algorithm}.rs`, new `engine/native/diff/tests/data/myers-oracle.txt` (437 cases); `offset_range.rs` and `lib.rs` extended. Flat modules like 22a (`diffAlgorithm.ts` to `diff_algorithm.rs`, `myersDiffAlgorithm.ts` to `myers_diff_algorithm.rs`); `DateTimeout` stays `clock::Timeout`, and `diff_algorithm.rs` adds the `ITimeout` trait (implemented for `Timeout`) and `InfiniteTimeout`.
- **Production lines: 389** (budget 450). Measured: non-blank, non-`//`/`///` lines before `#[cfg(test)]`: `diff_algorithm.rs` 174, `myers_diff_algorithm.rs` 200, plus 8 added to `offset_range.rs` and 7 in `lib.rs`.
- **Tests added or changed:** 5 in `diff_algorithm.rs` (trivial results, `invert` against values from running VS Code, `SequenceDiff` arithmetic, `assert_sorted`, timeouts), 5 in `myers_diff_algorithm.rs` (VS Code's `suite('myers')` test `1`, trivial cases, UTF-16 units, expired timeout, the oracle corpus), 1 extended in `offset_range.rs`. Diff crate: 11 tests before, 22 after.
- **Gates:** `engine:fmt`, `engine:lint` (clippy `-D warnings`), `engine:check` and `engine:test` clean at each commit; `kb:check` run at the claim; Sonar: integrator.
- **Acceptance (ported unit tests):** met, with a caveat. The only VS Code test touching these files is `suite('myers')` test `1` (`hello world` against `hallo welt`), which asserts nothing and builds its sequences with `LinesSliceCharSequence` (22d). It is ported with a stand-in one-element-per-UTF-16-unit sequence and a stronger assertion taken from running VS Code's TypeScript. The real acceptance is the oracle corpus: the TypeScript files, run with esbuild on Node, produced the expected output for 437 seeded random and hand cases, all of which pass in Rust.
- **Deviations from the slice:** (1) Myers keeps x, y and V as `f64` with NaN-propagating `Math.max`/`Math.min`, because VS Code reads its `Int32Array` past the allocation (`undefined`, NaN) on diagonals outside the grid; the corpus has 179 such reads and a dropped-write/NaN-as-0 model reproduces VS Code on all of them. A NaN path reaching the result never happened in 620,000 random cases; the port asserts it in debug builds. (2) `OffsetPair.max` is `u32::MAX` (`Number.MAX_SAFE_INTEGER` there); 22e must avoid arithmetic on it that overflows. (3) The optional `getBoundaryScore` is `ISequence::get_boundary_score -> Option<f64>`, default `None`; 22e tests presence with `is_some()`. (4) `ISequence::get_element` returns `u32`, and `compute` takes `&dyn ISequence` and `&mut dyn ITimeout` (callers without a limit pass `&mut InfiniteTimeout`). (5) `offset_range.rs` and `lib.rs` (22a files) were extended, needed by `SequenceDiff`. (6) `forEachAdjacent` and `BugIndicatingError` are inlined as a loop and panics.
- **Open questions / follow-ups:** none blocking.
- **Follow-up (2026-10-19):** `engine/native/diff/tests/oracle/gen-myers.mjs` regenerates `tests/data/myers-oracle.txt` from VS Code's sources fetched at the pinned commit; a rerun matches the committed file byte for byte (`cmp`), with the same 179 reads past the allocation.

### 22c Report

Status: done — awaiting integration

- **Agent / date:** Claude Sonnet 5.5 (sub-agent 22c for the integrator), 2026-10-19.
- **Branch and commits:** `diff-1.9.0/d22c`, from `the-diff` at `a7a20f7`: claim `a218182`; `212a1ef` `line_sequence.rs`; `7feb9fd` `dynamic_programming_diffing.rs`; `0892573`/`98ef82f` the DP oracle generator and its first data; `04d3510`/`fe575c7` three more DP hand cases (VS Code's myers test 1 input, a UTF-16 case) and regenerated data; `7014eb0` DP unit tests and corpus test; `bf76db6`/`3b15d51` `lineSequence` generator and data; `a3ef015` `lineSequence` unit tests and corpus test; plus the signed report commits. All `G`. No push.
- **Files changed:** new `engine/native/diff/src/{line_sequence,dynamic_programming_diffing}.rs`, `tests/oracle/gen-{dynamic-programming-diffing,line-sequence}.mjs`, `tests/data/{dynamic-programming,line-sequence}-oracle.txt`; `lib.rs` +4 lines (two `pub mod`, two `pub use`).
- **Production lines: 187** (budget 200). Measured: non-blank, non-`//`/`///` lines before `#[cfg(test)]` (awk): `line_sequence.rs` 49, `dynamic_programming_diffing.rs` 134, plus 4 in `lib.rs`.
- **Tests added:** `line_sequence.rs` 4 (boundary scores, strong equality, `get_text` clamping, 90-case oracle corpus); `dynamic_programming_diffing.rs` 6 (VS Code myers test 1 input, trivial cases, UTF-16 units, expired timeout, trait method, 619-case oracle corpus). Diff crate: 22 tests before, 32 after.
- **Gates:** `engine:fmt`, `engine:lint` (clippy `-D warnings`), `engine:check`, `engine:test` clean at the final commit (tests: all workspace suites pass); `kb:check` run at the claim and after this report; Sonar: integrator.
- **Acceptance:** met, with a caveat. VS Code has no unit test for either file: `suite('myers')` test `1` has a dead `true ? new MyersDiffAlgorithm() : new DynamicProgrammingDiffing()` branch and builds `LinesSliceCharSequence` (22d), so it is ported as a stand-in input plus the value VS Code returns; `LineSequence` has no test. The real acceptance is the oracle corpora, from VS Code's TypeScript bundled with esbuild: 619 `DynamicProgrammingDiffing.compute` cases (hand cases, 560 seeded random over alphabets of 2-5, 40 timeout cases with a counting timeout, fixed fractional score function) and 90 `LineSequence` cases (every boundary score, all strong-equality pairs, every `getText` range, indentation by spaces/tabs, non-breaking and ideographic spaces, emoji, escape characters). All pass in Rust. Both generators rerun byte for byte (sha256 checked twice) and fetch the pinned sources from GitHub at run time through an esbuild plugin.
- **Deviations from the slice:** (1) `Array2D` (`utils.ts`) is a private type in `dynamic_programming_diffing.rs`, so as not to collide with 22d's `utils` helpers; the integrator can move it. (2) `compute` takes the TypeScript optional fourth argument through `compute_with_score(.., Option<&dyn Fn(u32, u32) -> f64>)`; the trait `compute` calls it with `None`. (3) Scores are `f64` with exact `==` ties; the equality score is assumed not NaN (asserted in debug builds), since a NaN would leave table cells unwritten (`undefined`) in VS Code. (4) The oracle's fractional score function uses exact arithmetic only, not `Math.log`: the real score `1 + Math.log(1 + length)` belongs to 22f, which must settle `libm::log` against V8. (5) `LineSequence::new(&[u32], &[String])` borrows its hashes and lines. The `Map`-based line-identity numbering (hash of the trimmed line in order of first occurrence) is in `defaultLinesDiffComputer.ts`, not in `lineSequence.ts`, so it is 22f's; the generator numbers lines that way and the data carries the hashes. 22f must reproduce JavaScript's `String.prototype.trim` (it trims NBSP and other Unicode spaces, unlike `str::trim_ascii`). (6) `getIndentation` counts leading ASCII space/tab bytes, identical to counting UTF-16 units there. `getBoundaryScore` returns `Some(f64)`, per 22b's `ISequence`. (7) The `the-diff` branch has moved since I branched (it carries `gen-myers.mjs`); my `lib.rs` edit is the two `pub mod` and two `pub use` lines, which may overlap trivially with 22d's.
- **Open questions / follow-ups:** none blocking.

### 22d Report

Status: done — awaiting integration

- **Agent / date:** Claude Sonnet 5.5 (sub-agent 22d for the integrator), 2026-10-19.
- **Branch and commits:** `diff-1.9.0/d22d` — claim `e8695bb`; `c9ab7a5` `utils.rs` `is_space`; `b0fb417` elements and constructor; `7cb33d3` boundary score; `8cc9a25` offset translation and line extension; `db181e7` text and word finding; `c3a444a` boundary score past the end reads `undefined` as Other; then the oracle generator, its code-unit fix, the data (first and regenerated), the corpus test, and this report, each its own signed commit (all `G`). No push.
- **Files changed:** new `engine/native/diff/src/{lines_slice_char_sequence,utils}.rs`, `tests/oracle/gen-lines_slice_char_sequence.mjs`, `tests/data/lines-slice-char-sequence-oracle.txt` (412 cases); `lib.rs` +3 lines (two `pub mod`, one `pub use`); this file.
- **Production lines: 263** (budget 350): 255 in `lines_slice_char_sequence.rs`, 5 in `utils.rs`, 3 in `lib.rs`. Measured as non-blank, non-`//` lines before the single trailing `#[cfg(test)]` module of each file.
- **Tests added or changed:** 11 unit tests in `lines_slice_char_sequence.rs` (elements, UTF-16 and emoji, JavaScript trim set, boundary scores, translation incl. a cut slice past an emoji, line extension, words and sub-words, strong equality, the oracle corpus), 1 in `utils.rs`. Diff crate: 22 tests before, 34 after. VS Code has no unit test for these two files (checked `src/vs/editor/test/`: only the `myers` test already ported in 22b builds one).
- **Oracle:** `tests/oracle/gen-lines_slice_char_sequence.mjs` fetches VS Code's TypeScript at `28a5623` at run time, bundles it with the repository's esbuild, and covers 12 hand-picked and 400 seeded cases (ASCII, camelCase, digits, tabs, NBSP, U+3000, U+2028, U+FEFF, U+0085, `\r`, combining marks, emoji, a ZWJ sequence, CJK, empty lines, ranges with columns past the line end). Per case it checks elements, `getBoundaryScore` for 0..=len+2, `translateOffset` (both preferences) for 0..=len+2, `findWordContaining`/`findSubWordContaining` for -1..=len+1, and 8 random ranges each for `translateRange`, `countLinesIn`, `extendToFullLines` and `getText`, plus 8 `isStronglyEqual` pairs including past-the-end. All 412 match in Rust; a rerun of the generator reproduces the data byte for byte.
- **Gates:** `engine:fmt`, `engine:lint` (clippy `-D warnings`), `engine:check` and `engine:test` clean at the final commit (the 34 diff tests pass); `kb:check` run on this report; Sonar: integrator.
- **Acceptance:** unit tests including UTF-16 and emoji — met; oracle corpus exact — met.
- **Deviations from the slice:** (1) `LinesSliceCharSequence::new` takes `&TextModel` (22a's UTF-16 lines) instead of `string[]`, and the TypeScript's public `lines` field is dropped: nothing reads it. (2) `get_text` and `text` return `Vec<u16>`, because a range may split a surrogate pair, which a Rust `String` cannot hold; the callers in 22e only trim and measure. (3) `find_word_containing` and `find_sub_word_containing` take an `i64` offset, since the TypeScript accepts -1 and out-of-range values. (4) `translate_offset` takes a `Preference` enum (`Left`, `Right`) for the string literal. (5) `get_boundary_score` is `Some(..)` via an inherent `boundary_score -> f64`; a `length` past the end reads `undefined` as category Other, as VS Code does. (6) `is_strongly_equal` compares `Option`s, so two offsets past the end are equal (`undefined === undefined`). (7) `utils.rs` holds only `is_space` (the one helper `LinesSliceCharSequence` needs); `Array2D` (22c) and `LineRangeFragment` (22g) are left to those slices. 22c may also create `utils.rs`: expect a trivial merge there and in `lib.rs`. (8) `OffsetRange::delta*` and friends were not touched.
- **Open questions / follow-ups:** none blocking. Note for 22g: `computeMovedLines` builds `new Range(1, 1, 1, line.length)` (end column without +1), which this constructor handles through its end-column clamp.
