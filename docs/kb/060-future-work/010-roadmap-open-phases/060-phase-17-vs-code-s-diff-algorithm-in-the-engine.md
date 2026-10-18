---
summary: >-
  Planned (`2026-10-18`), nothing implemented: port VS Code's MIT `advanced`
  diff algorithm (line diff, character refinement, heuristics, moved code)
  into a Rust crate in the engine, prove it against VS Code's 58 fixtures and
  against `@vscode/diff`'s TypeScript and WebAssembly backends (a pinned
  devDependency), then use it for diffs shown inside Git Graph Libre. Holds
  the research, architecture, slices 17.0–17.8, the legal plan, and the five
  decisions the maintainer must make first.
---

# Phase 17: VS Code's diff algorithm in the engine

**Status: planned `2026-10-18`; nothing implemented. Decisions D1–D5 below
come first. Release 1.9.0 schedules 17.0 and 17.1 as D20 and D21, and the
port as D22 (stretch). The maintainer confirmed this port over a gix-based
display diff (1.9.0 decision X7, `2026-10-18`).**

**Goal.** Compute diffs exactly the way VS Code's diff editor does,
character-level highlights and moved code included, in Rust inside the
engine, so Git Graph Libre can show them without opening VS Code's diff
editor. Prove the port equal to VS Code's own implementation and to both
backends of Microsoft's `@vscode/diff` package with a differential test
suite, and ship it under the notices its MIT license requires.

This is not the numstat path. The `+N/-M` counts must keep matching
`git diff --numstat`, which uses Git's xdiff Myers. This algorithm only
decides what a diff *looks like*. The two never share code (see "Diff parity
against real history, and a gix Myers fix" under Phase 16).

## What exists to port

Facts checked on `2026-10-18`:

| Source | What it is | License |
| --- | --- | --- |
| `microsoft/vscode` `src/vs/editor/common/diff/defaultLinesDiffComputer/` at `28a5623` | The `advanced` algorithm: `defaultLinesDiffComputer.ts`, `heuristicSequenceOptimizations.ts`, `linesSliceCharSequence.ts`, `lineSequence.ts`, `computeMovedLines.ts`, `utils.ts`, `algorithms/{diffAlgorithm,myersDiffAlgorithm,dynamicProgrammingDiffing}.ts` (≈67 KB), plus `../rangeMapping.ts`, `../linesDiffComputer.ts` and the range types in `src/vs/editor/common/core/` | MIT, "Copyright (c) 2015 - present Microsoft Corporation" |
| the same repository, `src/vs/editor/test/node/diffing/fixtures/` | 58 cases: `1.*` diffed against `2.*`, with `advanced.expected.diff.json` holding line ranges, character ranges and moves | MIT |
| npm `@vscode/diff`, `0.0.2-87` (`next` tag; `latest` still points at `0.0.2-0`) | The same algorithm extracted into a standalone package, with a TypeScript backend and a WebAssembly backend built from Rust. Published by Microsoft's `vscode-bot` and `microsoft1es`; no runtime dependencies, no install scripts | MIT, "Copyright (c) Microsoft Corporation." |
| that package's Rust (`rust/crates/diff_wasm`) | Not public: the repository the package names, `microsoft/vscode-packages`, returns 404, and the tarball holds only the compiled `.wasm` | — |

**There are no algorithm fixes in `@vscode/diff` to take.** With comments
stripped, its seven algorithm files are byte-identical between `0.0.2-7`
(what VS Code pins) and `0.0.2-87`. Against VS Code `main` the differences
are refactoring only: renamed members, inlined helpers (`Array2D`, `Range`,
`Position`, `forEachWithNeighbors`, `findLastMonotonous`, …), removed debug
assertions. There is one behavioral gap: `computeMovedLines` is a TODO, and
both backends always return no moves. So **VS Code's own source is the
reference**, being the only complete one.

The package is still useful three ways:
- as the minimal dependency set for an extraction;
- as two test oracles (its TypeScript and WebAssembly backends);
- as its API layer, which shows how it converts between line ranges and
  string edits.

Each new release must be rechecked for genuine algorithm changes (see the
re-sync procedure below).

**How VS Code wires it in** (traced `2026-10-18`, `main` at `28a5623`):
- `diffEditor.diffAlgorithm` reaches `DiffEditorOptions`, then
  `WorkerBasedDocumentDiffProvider`, then `editorWorkerService.computeDiff`,
  and finally the worker's `resolveLinesDiffComputer`.
- `advanced-external` and `advanced-wasm` go through
  `externalLinesDiffComputer.ts`. That adapter ignores two settings, forcing
  `ignoreTrimWhitespace: true` and passing no `maxComputationTimeMs`, both
  per its own TODOs.
- The provider's static result cache leaves the algorithm out of its key.
- The source-control gutter, notebook cell diffs, chat code blocks and test
  results hard-code `advanced`.
- "Format modified lines" uses the legacy line diff.

## Architecture

- **A crate of its own,** `engine/native/diff`, std-only with no gix
  dependency, `#![forbid(unsafe_code)]`. Its modules mirror VS Code's file
  names one for one, so a later upstream diff maps straight onto our files.
  The public API mirrors `ILinesDiffComputer.computeDiff(original, modified,
  options) -> LinesDiff { changes: [DetailedLineRangeMapping { original,
  modified, inner_changes }], moves, hit_timeout }`, with the options
  `ignore_trim_whitespace`, `max_computation_time_ms`, `compute_moves` and
  `extend_to_subwords`.
- **Exactness rules,** because the result must match VS Code's output byte
  for byte:
  - **Text is UTF-16 code units.** VS Code's character sequence is built from
    `charCodeAt`, and its columns and the `Math.log(1 + length)` score count
    UTF-16 units. The crate converts each line to `Vec<u16>` once; positions
    in the output are UTF-16 columns, exactly as VS Code reports them.
  - **Lines split the way a VS Code text model splits them,** on `\r\n`, `\n`
    and `\r`, with line endings removed.
  - **Floating point matches V8's.** The alignment score uses `Math.log`. Use
    the `libm` crate's `log`, an fdlibm port like V8's, rather than the
    platform's `ln`, and let the differential tests catch any last-bit tie
    that still differs.
  - **Ordering:** reproduce the `Map`-based line identities and every
    sort's stability exactly.
  - **The clock is injectable.** `wasm32-unknown-unknown` has no
    `std::time::Instant`, which is likely the "Time is not implemented in this
    environment" that keeps VS Code's adapter from passing a timeout. Native
    builds use `Instant`, the WebAssembly build uses JavaScript's
    `Date.now()` through `wasm-bindgen`, and tests use a fake clock.
- **Builds:**
  - the native library, linked into `engine/native/node` behind new `#[napi]`
    exports (below);
  - a `wasm` feature built with `wasm-bindgen --target nodejs` for the
    differential tests and the benchmark;
  - optionally a crates.io release, depending on D1.
- **Engine exports,** both taking and returning JSON like the rest of the seam:
  - `diff_texts(original, modified, options)`, pure, for tests and the
    benchmark;
  - `diff_file_at_revisions(path, from, to, old_path, new_path, options)`,
    which reads both blobs in process and diffs them; binary files return
    the binary marker, as `load_commit_file` does.
- **It replaces `load_commit_file_diff`,** the unwired unified-diff export,
  with the same reasoning as the `2026-09-23` export audit.

## Test strategy: five implementations, one answer

| Oracle | Moves | How it runs |
| --- | --- | --- |
| VS Code's `advanced.expected.diff.json` for the 58 fixtures | yes | vendored files, compared in `cargo test` |
| `@vscode/diff` TypeScript backend | no | Vitest, from the pinned devDependency |
| `@vscode/diff` WebAssembly backend | no | Vitest; the package reads its `.wasm` with `node:fs` under Node |
| our crate, native | yes | `cargo test`, and Vitest through the engine addon |
| our crate, WebAssembly | yes | Vitest, from the `wasm` build |

1. **Rust unit tests** ported from VS Code's `defaultLinesDiffComputer.test.ts`.
2. **Golden fixtures in `cargo test`.** All 58 VS Code fixtures are vendored
   with their expected JSON, and the output is formatted exactly as VS Code's
   runner formats it (`[2,3)`, `[2,1 -> 2,5]`). The suite also checks that
   applying the diff reproduces the modified text, as VS Code's
   `assertDiffCorrectness` does.
3. **A differential Vitest suite in `tests/backend/`.** It runs every oracle
   on the fixtures and on a deterministic generated corpus (a seeded linear
   congruential generator, as the gix tests use), and requires identical
   canonical JSON. Moves are compared only between our crate and VS Code's
   fixtures, since the package can't produce them. As a by-product this
   finally answers whether `@vscode/diff`'s TypeScript and WebAssembly
   backends really are identical: so far that rests on Microsoft's word.
4. **`pnpm run diff:parity`,** a benchmark-style script outside the default
   test run, like `bench:backends`. It diffs file pairs from real history
   (the last N commits of a repository given by an environment variable) on
   every backend, and reports mismatches and timings.
5. **Continuous integration.**
   - `engine.yml` runs the cargo layers.
   - The TypeScript test job runs layer 3, which needs the WebAssembly build.
     `wasm-bindgen-cli` is pinned to the `wasm-bindgen` crate version, the
     same discipline as the pinned zig.

## Using it in Git Graph Libre (decision D4)

VS Code's public API has no way to hand a precomputed diff to its diff
editor, which always computes its own. So the port's payoff is in our own
surfaces:

- **G1, an inline diff in commit details.** Expanding a file shows its hunks
  with character highlights in the webview, computed in process. Rendering
  is cheap, but there's no syntax highlighting.
- **G2, a patch document.** A read-only virtual document of the hunks, with
  editor decorations for the character-level changes. It's a native editor,
  so it's fast and searchable.
- **G3, both,** keeping `vscode.diff` for the full side-by-side view.

Either way it's an engine-only feature, an exception to design rule 2 that
must be recorded the way the planned Statistics tab's is. Without the engine,
the action falls back to `vscode.diff`.

## Slices

- **17.0 Legal groundwork.** Record the license decision (D1) as a verdict
  under Licensing. Add the notices below with an empty port. Pin the
  devDependency (D3). No code.
- **17.1 Oracles first.** Vendor the 58 fixtures. Add the Vitest suite
  running `@vscode/diff`'s two backends against the fixtures and the
  generated corpus. *Acceptance:* both backends match the expected JSON on
  every fixture without moves. Every difference is listed, including any
  between the two backends.
- **17.2 Crate skeleton.**
  - Core types: `OffsetRange`, `LineRange`, `Position`, `Range`,
    `RangeMapping`, `DetailedLineRangeMapping`, `LinesDiff`.
  - The UTF-16 text model, line splitting, the clock trait, and the
    canonical JSON format.
  - Unit tests.
- **17.3 Line algorithms.** Myers, the dynamic-programming pass, the
  sequence interfaces and `LineSequence`, plus the ported unit tests.
- **17.4 Character refinement and heuristics.**
  - `LinesSliceCharSequence`, `heuristicSequenceOptimizations`, and the
    `DefaultLinesDiffComputer` flow, moves aside.
  - *Acceptance:* every fixture matches without moves.
- **17.5 Moved code.** `computeMovedLines`. *Acceptance:* every fixture
  matches exactly, moves included.
- **17.6 WebAssembly and differential parity.** Build the `wasm` feature and
  extend the Vitest suite to five implementations. Add
  `pnpm run diff:parity`, and run it on this repository, git.git and
  gitoxide with the results recorded here. *Acceptance:* zero mismatches
  apart from documented moves, with timings against both package backends.
- **17.7 Engine exports.**
  - `diff_texts` and `diff_file_at_revisions`; remove `load_commit_file_diff`.
  - A TypeScript seam with strict payload parsing.
  - A parity test of the seam against `@vscode/diff`'s TypeScript backend.
- **17.8 The surface chosen in D4,** with its tests, localization and
  telemetry (one view-feature flag, at the documented chokepoint).

Each slice runs the full gate, and the Rust arm too.

## Legal plan

**What comes in, under what terms.**
- **The algorithm:** VS Code's source files, MIT, "Copyright (c) 2015 -
  present Microsoft Corporation". Each file carries "Copyright (c) Microsoft
  Corporation. All rights reserved. Licensed under the MIT License."
- **The fixtures:** VS Code's diffing fixtures, MIT, same repository.
- **The devDependency:** `@vscode/diff`, MIT, "Copyright (c) Microsoft
  Corporation." Used only as a test tool, never redistributed.

MIT into this AGPL project is the allowed direction (Mission). This is not a
clean-room case: the clean-room rule exists for non-MIT material, and this
is MIT, taken directly with its notice, like the engine import.

**What we distribute, and what each requires.**
- **The source repository:** the Rust port, a translation and so a
  derivative work, plus the vendored fixtures. Both need the copyright and
  permission notice.
- **The VSIX:** the engine binary contains the compiled port, so the notice
  must ship inside the VSIX. `.vscodeignore` already whitelists
  `LICENSE.mit` and `NOTICE.md`, and `engine/NOTICE.md` is *not* shipped, so
  the required text goes in the first two.
- **A crates.io release (only if D1 allows one):** the crate directory gets
  its own `LICENSE` copy and `NOTICE`, because `cargo package` ships only
  the crate's own files.

**Concrete changes, all in 17.0:**
1. **`LICENSE.mit`:** add a section for Microsoft Corporation, with both
   copyright lines and the full MIT permission text verbatim. It ships in
   the VSIX.
2. **`NOTICE.md`:** a new subsection under "Incorporated MIT-licensed
   material", "VS Code's diff algorithm (`engine/native/diff/`)", stating:
   - the source repository, path and commit;
   - the files ported and that the port is a translation into Rust;
   - the vendored fixtures;
   - the license boundary from D1;
   - that `@vscode/diff` is only a development dependency and is not
     redistributed.
3. **`engine/NOTICE.md`:** the same provenance in detail, and the verbatim
   notice.
4. **A header in every ported Rust file** naming its source file and commit,
   with the Microsoft copyright, "Licensed under the MIT License (see
   LICENSE.mit)", and the license of our changes.
5. **The vendored fixtures directory** gets a README naming the source path
   and commit, and the MIT license.
6. **The crate's `Cargo.toml` `license` field** states D1's outcome in SPDX
   form (`MIT`, or `AGPL-3.0-or-later AND MIT`). It also surfaces an existing
   inconsistency the maintainer should settle in the same change: the engine
   workspace declares `license = "MIT"` while `NOTICE.md` says changes made
   here are AGPL-3.0-or-later.
7. **A dated licensing verdict** under Licensing, *always read*, recording
   D1 and these placements.
8. **Verification:** `vsce ls` on a packaged build lists `LICENSE.mit` and
   `NOTICE.md` and no `node_modules/@vscode/diff`.

**The devDependency itself.**
- Not redistributed: devDependencies stay out of the VSIX, through the
  `.vscodeignore` whitelist and `vsce package --no-dependencies`. So it adds
  no notice obligation of its own; `NOTICE.md` names it anyway, for
  transparency.
- Pin the exact version, because `latest` points at a stale prerelease.
- Edit `package.json` by hand, then run `pnpm install` (the
  `2026-09-17` toolchain record explains why not `pnpm add`).
- It has no install scripts, so pnpm's `allowBuilds` needs no entry.

**Not to do.**
- Don't decompile the `.wasm` to recover the unpublished Rust.
- Don't copy anything from Microsoft's product build, which ships under a
  different license than the source.
- Take algorithm text only from `microsoft/vscode`, or from the package's
  embedded TypeScript (also MIT), and always record the commit or version.

## Decisions for the maintainer

- **D1, the port's license.** Per the Mission it is AGPL-3.0-or-later, with
  Microsoft's MIT notice kept for the original. The alternative is MIT for
  this crate alone, which makes it reusable and upstreamable (gix, other
  editors) and keeps the legal story to one license, at the cost of the
  copyleft. If chosen, record it as an exception.
- **D2, the crate name** and whether to publish it on crates.io.
- **D3, the version of `@vscode/diff` to pin**
  (`0.0.2-87` today, or `0.0.2-7` to match what VS Code ships).
- **D4, the surface:** G1, G2 or G3.
- **D5, how continuous integration gets the WebAssembly build:** built in
  CI with a pinned `wasm-bindgen-cli`, or checked in as a test artifact.

## Risks

- **Upstream moves on.** VS Code changes these files a few times a year. The
  re-sync procedure below keeps the port tracking a recorded commit.
- **The package is an experimental prerelease** whose API may change. It
  touches only the tests, behind the pinned version.
- **Exactness traps:** UTF-16 columns, `Math.log` ties, sort stability, `\r`
  handling. The five-way differential suite is designed to surface each one
  rather than trust the port.
- **Its cost on large files.** The dynamic-programming pass is quadratic up
  to 1,700 lines, and so is the character pass up to 500 characters. That's
  VS Code's behavior and the port keeps it; the time limit bounds it.

**Re-sync procedure.**
1. Diff `src/vs/editor/common/diff/` between the recorded commit and the new
   one.
2. Apply the changes to the matching Rust modules.
3. Refresh the vendored fixtures from the new commit and rerun the suites.
   Never edit an expected JSON file by hand.
4. Record the new commit in `NOTICE.md`, `engine/NOTICE.md` and the file
   headers.
5. For a new `@vscode/diff` release, repeat the comment-stripped comparison
   used on `2026-10-18` before trusting its "identical results".
