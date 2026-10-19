---
summary: >-
  Experiment (`2026-10-19`): why the Phase 17 port is slower than
  `@vscode/diff`'s WebAssembly backend. On D48's large case almost all of the
  time (8.7 of 8.8 s) is the line-level Myers search, about 520 million
  diagonal steps at ~14 ns each, because the port transcribes JavaScript's
  number semantics. `opt-level` and memory are not the cause. An integer
  rewrite with a NaN sentinel and compact storage, all in a scratch copy,
  gave identical output and was 25% faster (5.63 s against 7.5 s, against the
  package WebAssembly's 4.2 s).
---

# Why the port is slower than `@vscode/diff`'s WebAssembly (`2026-10-19`)

**Status: experiment only, nothing committed to the crate.** It was done at
the maintainer's question after D48 measured the port timing out on the
large case where the package's WebAssembly backend completes. It is the
basis for a future performance slice.

## Setup

- **Input:** D48's large case, `a484db7`'s `graphify-out/graph.json`
  (181,605 → 208,192 lines), with `ignoreTrimWhitespace` true,
  `computeMoves` false and no time limit.
- **Machine:** AMD Ryzen 9 5900X, Node v26.11.1.
- **Harness:** a throwaway bench crate depending on a copy of
  `engine/native/diff` at `7aebdfe`, outside the repository. Results are
  compared by a fingerprint of the `changes` list (`777d547472ab8e44`, 1,879
  changes), which every variant below matched.
- **Profiler:** none was installed, and `gdb` cannot attach to a running
  process here because ptrace is restricted. Sampling instead ran the binary
  under a `gdb` Python script that stopped it every 100 ms with
  `handle SIGINT stop print nopass`, about 60 stacks per run.

## Findings

| Variant | Diff time |
| --- | ---: |
| `@vscode/diff` TypeScript backend | 7.0 s |
| `@vscode/diff` WebAssembly backend | 4.2 s |
| The port, `opt-level = 3` | 7.65 s |
| The port, `opt-level = "s"` (the engine's release profile) | 7.92 s |
| + integer math with a NaN sentinel, sequences read once into `Vec<u32>` | 6.05 s |
| + paths as `u32` with a sentinel, `V` as one buffer with logical side lengths | **5.63 s** |

- **Not the cause:** `opt-level` (about 3%), memory (peak RSS 219 MB), the
  extension boundary, or the other phases. Line hashing, the heuristics,
  character refinement and the line mapping together take about 70 ms.
- **The cause:** line-level Myers (`align_lines`) takes 8.7 of 8.8 s.
  This pair needs `d = 32,219` rounds, about 520 million
  `extend_diagonal` steps, so the work grows with the square of the number
  of edits. The port spends about 14 ns per step. That is because it
  transcribes the JavaScript literally: `f64` values with NaN-aware
  `js_max`/`js_min`, float-to-integer casts, two `&dyn ISequence` calls per
  comparison, and 16-byte `Option<usize>` slots for paths. V8 compiles the
  original equally well, which is why the TypeScript backend runs at the
  same speed.
- **Before the rewrite:** about 47% of samples sat in the snake check
  (`x_after_snake` plus `LineSequence::get_element`), which runs once per
  step even when nothing matches. The rest was spread over the step's
  arithmetic and the `FastInt32Array` and path reads and writes.
- **After the rewrite:** no single hot spot was left. The remaining samples
  sit on `V` loads and the step's branches.

## The quirk any rewrite must keep

VS Code's `FastInt32Array` grows only on writes. So at every doubling point
(rounds 10, 20, 40, …) the search reads `V` one past its end and gets
`undefined`, which makes `x` NaN, stores 0 for that diagonal, and pushes a
path with NaN coordinates. The port reproduces this, and the integer
experiment kept it with an `i64::MIN` sentinel. Dropping it would change
results on larger diffs. One possible but **unverified** explanation of the
package WebAssembly backend's divergences (2 of 58 fixtures, about 1% of
real pairs) is that its Rust implementation does not reproduce quirks like
this one.

## About the package

`@vscode/diff`'s WebAssembly backend is also Rust: `crates/diff_wasm`, built
with `wasm-pack` and `serde-wasm-bindgen`. Its README says the native Rust
build is about 2.9× faster than the TypeScript one. Its source repository,
`microsoft/vscode-packages`, is not public: an authenticated GitHub API call
returns 404 (`2026-10-19`).

## Next

A performance slice for `myers_diff_algorithm.rs` only (about 150 lines),
along the lines of the last two variants, with the Myers oracle (437
cases), the 58 fixtures and the 648-case whole-flow corpus as acceptance.
The realistic first gain is 25%. The ceiling is the step count: even
3 ns per step would leave about 1.6 s on this case, and going below that
needs a different algorithm, which X7 rules out.
