---
summary: >-
  Implemented in 1.9.0 (`2026-10-19`, on `the-diff`, unpublished): port VS Code's MIT `advanced`
  diff algorithm (line diff, character refinement, heuristics, moved code)
  into a Rust crate in the engine, prove it against VS Code's 58 fixtures and
  against `@vscode/diff`'s TypeScript and WebAssembly backends (a pinned
  devDependency), then use it for diffs shown inside Git Graph Libre. Holds
  the research, architecture, slices 17.0–17.8, the legal plan, and the five
  decisions; D4 is answered (`2026-10-19`): a light "GGL Diff" tab of our
  own, release 1.9.0's wave D.
---

# Phase 17: VS Code's diff algorithm in the engine

**Status: implemented in release 1.9.0 (`2026-10-19`, D20–D22 and D40–D48 on `the-diff`, unpublished); this section stands as the design and results record. Decisions D1–D3 and D5
below come first; D4 is answered (G4 (c), `2026-10-19`). Release 1.9.0 schedules 17.0 and 17.1 as D20 and D21, and the
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
  - **Floating point matches V8's.** The alignment score uses `Math.log`.
    The port carries its own `math_log` (`src/v8_math.rs`), a transcription
    of fdlibm's `e_log.c` as V8's `ieee754::log` has it: it matches V8 on all
    1,000,001 inputs `1 + n` (n ≤ 1,000,000), where the platform's `ln`
    differs on 9,276 and the `libm` crate (musl's rewrite) on 727 (22f, X18,
    `2026-10-19`).
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
- **G4, a "GGL Diff" tab** that looks like the diff editor, opened from
  commit details and from Source Control. It is built on Monaco's diff
  editor or on a renderer of our own; the measurements and trade-offs are in
  "No way to route a computed diff into the editor" below.

**Chosen (`2026-10-19`): G4, option (c).** A renderer of our own, with VS
Code's diff editor stylesheet and its unchanged-region rule copied in (MIT),
fed by this port through the engine. Release 1.9.0 plans it as wave D,
slices D40–D48. `vscode.diff` stays the default click; the tab is an extra
action.

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

  **Results (`2026-10-19`, 22h and 22i).** The Vitest suite is five-way
  (`tests/backend/vscodeDiffDifferential.test.ts`: the expected JSON,
  both package backends, our WebAssembly, our native through 22j's
  seam), 61/61 with no skips when both of our builds exist; its
  per-pair verdicts are in the 22h and 22i reports in D22.
  `pnpm run diff:parity` (`scripts/diff-parity.mjs` over
  `tests/backend/engine/diffParity.bench.ts`) diffs every changed file
  of the newest `GGL_PARITY_COMMITS` non-merge commits of
  `GGL_PARITY_REPO`, each against its first parent, on the four
  computing arms, with `ignoreTrimWhitespace` and `extendToSubwords`
  off and `maxComputationTimeMs` 5000 — VS Code's
  `diffEditor.maxComputationTime` default, the setting D45 feeds the
  tab from — on every arm; `hitTimeout` is counted per arm. Binary,
  non-UTF-8 and over-50,000-line pairs are skipped and counted. Swept
  repositories are read only (`git log`/`diff`/`show`). Runs below:
  Node v26.11.1, engine 1.0.26, `@vscode/diff` 0.0.2-87; our native
  arm is the debug addon `pnpm run engine:build` makes and our
  WebAssembly arm the release `pnpm run diff:wasm` build, so native
  timings (and which side of the cap it lands on) are debug-build
  numbers, never a performance claim.

  | Sweep | TS vs pkg Wasm | TS vs our Wasm | TS vs our native | pkg Wasm vs ours (each) | our Wasm vs native | moves (ours) |
  | --- | --- | --- | --- | --- | --- | --- |
  | git.git, newest 100 (`6de20f6092`) | 13/220 | 0/220 | 0/220 | 13/220 | 0/220 | 0/220 |
  | this repository, newest 250 (`bb9501d`) | 12/754 | 1/754 | 0/754 | 12/754 | 1/754 | 1/754 |
  | gitoxide (`../gix`), newest 100 (`abdfc45db`) | 9/1580 | 0/1580 | 0/1580 | 9/1580 | 0/1580 | 0/1580 |

  git.git listed 222 files, compared 220 pairs (10 with a move) and
  skipped 2 non-UTF-8 (`t/t4201-shortlog.sh` twice), in 28.1 s wall;
  no arm errored and none hit the cap. Changes-pass timings in
  ms/pair: TypeScript 12.68, package WebAssembly 3.21, ours 11.61
  (WebAssembly) and 38.36 (native, debug). This bounded rerun
  reproduces the first agent's completed unbounded git.git sweep
  exactly — every count and every printed example identical (`diff`
  clean apart from the options, timing and verdict lines) — because
  the cap never engaged there. All 13 package-WebAssembly mismatches
  in its examples are character-refinement differences on `po/*.po`
  files (for example `0a961ebf` `po/fr.po`, one inner column ending
  at 13 where the other three arms end at 14): on real history, as on
  D21's two fixtures, the package's WebAssembly backend is the
  outlier, and our two builds side with its TypeScript backend
  everywhere.

  This repository listed 757 files, compared 754 pairs (9 with a
  move) and skipped 3 over the line bound (all
  `graphify-out/graph.json`, 181,605–208,192 lines), in 202.9 s wall;
  no arm errored. Changes-pass `hitTimeout` counts: TypeScript 4,
  package WebAssembly 0, our WebAssembly 3, our native 4 (moves pass:
  3 and 4). Changes-pass timings in ms/pair: TypeScript 39.06,
  package WebAssembly 2.08, ours 35.30 and 66.28 (debug); the capped
  pairs each contribute their full 5 s to the slower arms' totals.
  The package WebAssembly backend's 12 mismatches again mix genuine
  refinement differences (for example `8ab419fb` on the D22 file,
  column 1 where the other arms start at column 9) with
  `hitTimeout`-flag-only differences (`a484db78` on both graphify
  HTML files: changes agree, only the flag differs — the fast arm
  finished what the others capped). The one mismatch touching our
  builds is a cap-edge artifact, verified pair by pair: on
  `7cf2d831` `graphify-out/GRAPH_TREE.html` (364 lines, line 88 is
  260,258 characters) an isolated bounded probe finished the
  TypeScript arm in 2.7 s and our WebAssembly in 4.4–4.6 s with
  identical changes (94 inner changes, canonical forms equal, no
  timeout), while our debug native arm hit the cap at 5.0 s and
  returned the unrefined whole-line change; in the sweep the
  TypeScript arm landed on the timed-out side with the native arm
  (hence TypeScript vs native 0/754) and only the WebAssembly arm
  finished refined (hence 1/754 on each pair involving it, changes
  and moves alike). Which side of 5 s an arm lands on for such a pair
  depends on build speed and load, so this count can move between
  runs without any algorithm change.

  The gitoxide sweep named in this slice was run the same day as a
  22i follow-up, against the maintainer's fork at `../gix`
  (read-only; HEAD `abdfc45db13606f552ab49bec57764a1b2fc8c2a` on
  `fix/imara-myers-whole-file-occurrences`, 17,011 commits, status
  verified unchanged before and after). Correction: the reason first
  recorded here — no local gitoxide checkout — was wrong; the
  checkout existed at `../gix` all along. Its newest 100 non-merge
  commits listed 1,596 files, compared 1,580 pairs (10 with a move)
  and skipped 16 binary (for example `b9093f8c`
  `gix-discover/tests/fixtures/generated-archives/make_basic_repo_sha256.tar`),
  with no non-UTF-8 and no over-bound skips, in 114.5 s wall; no arm
  errored. Changes-pass `hitTimeout` counts: TypeScript 1, package
  WebAssembly 0, our WebAssembly 1, our native 1 (moves pass: 1 and
  1). Changes-pass timings in ms/pair: TypeScript 10.04, package
  WebAssembly 1.53, ours 9.29 and 18.02 (debug); moves pass: 9.33
  and 17.70. Every mismatch is again the package WebAssembly backend
  against each of the other three arms (9/1580 on each such pair;
  the examples show character-refinement differences — one
  whole-range inner change where the other arms refine, for example
  `87227527` on `gix-commitgraph/src/init.rs` and `cf55f83f` on a
  `gix-ref` test file; `0115e902` on `gix/Cargo.toml` also merges
  changes, 8 against 10; `794eeef8` on `gix-imara-diff/CHANGELOG.md`
  starts an inner change a line earlier). Our two builds match the
  TypeScript backend on all 1,580 pairs, changes and moves alike,
  and each other. Cap edge: one pair hit the 5 s cap on the
  TypeScript arm and both of ours but not on the fast package
  WebAssembly arm; the three capped arms agree on it (their pairs
  are 0/1580 and the canonical form carries `hitTimeout`), so the
  cap creates no difference among them here. Full output:
  `/tmp/ggl22i-gitoxide/parity-gitoxide-100.txt`. Only D5's CI wiring
  remains open from that sentence.

  The first sweep of this repository ran with no computation limit
  (`maxComputationTimeMs` 0). The integrator killed it at about
  83 minutes of single-core CPU, spent on generated-file pairs whose
  few lines run to megabytes each (`graphify-out/graph.html`: ~320
  lines, the longest 3.3 MB), which the 50,000-line skip by
  construction cannot catch; the script prints results only at the
  end, so nothing had flushed and no results were lost — there were
  none yet to lose, only the header survives. The bounded rerun
  above supersedes it. Read against this slice's acceptance: our
  builds have zero mismatches against the TypeScript backend apart
  from that one cap-edge pair, moves included; every other mismatch
  in the table is the package WebAssembly backend differing from all
  three other arms, now quantified on real history (13/220, 12/754
  and 9/1580) rather than only on D21's fixtures.
- **17.7 Engine exports.**
  - `diff_texts` and `diff_file_at_revisions`; remove `load_commit_file_diff`.
  - A TypeScript seam with strict payload parsing.
  - A parity test of the seam against `@vscode/diff`'s TypeScript backend.
- **17.8 The surface chosen in D4:** the GGL Diff tab, cut into release
  1.9.0's slices D40–D48 (stylesheet, row model, view, staged-file export,
  tab, engine source, Source Control button, commit-details action,
  measurement). Its commands and actions report through the existing
  telemetry chokepoints, so it needs no new feature flag.

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
- **D4, the surface:** G1, G2, G3 or G4 (and for G4, Monaco or our own
  renderer). **Answered `2026-10-19`: G4, option (c).**
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
