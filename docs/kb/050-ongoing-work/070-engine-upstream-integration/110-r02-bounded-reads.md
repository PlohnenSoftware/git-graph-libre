---
summary: >-
  R02: Bounded reads. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R02 — Bounded reads

Status: done — awaiting integration

Needs: none

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/blob.rs; engine/native/core/src/api.rs; engine/native/core/src/lib.rs; new engine/native/core/src/file_read.rs; engine/native/core/tests/bounded_reads.rs; src/extension/diffTab/engineSource.ts; tests/webview/diffTab/engineSource.test.ts; src/backend/engine/stagedFile.ts; tests/backend/engine/stagedFile.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Enforce 64 MiB maximum before blob allocation and during working-file reads, including growing files; shared cohesive helpers. Align error/tooLarge handling rather than falling back into unbounded allocation or silently treating oversized files as missing. Fix library facade path and strict UTF-8 behavior while touching it. Do not claim lexical checks prevent symlink escapes. Source: 634ca6c native blob/api; do not modify gitlink behavior yet.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-08
- **Branch and commits:** `engine-review/R02` — see `git log 2a5af5b..HEAD` (claim `abfd53b`; TooLarge kind `283e288`; Rust fix `7da6b38`; Rust tests `18b7e91`; TypeScript fix and tests; this report)
- **Files changed:** engine core `api.rs`, `blob.rs`, `error.rs`, `lib.rs`, new `file_read.rs`, new `tests/bounded_reads.rs`; napi `node/src/lib.rs`; `src/backend/engine/stagedFile.ts`, `src/extension/diffTab/engineSource.ts`; two TS test files (450 insertions, 63 deletions before this report)
- **Tests added or changed:** `bounded_reads.rs` (0 to 7); `engineSource.test.ts` 19 to 21 (21 pass); `stagedFile.test.ts` +2
- **Gates:** `cargo test -p git-graph-core --test bounded_reads` 7 passed; `engine:fmt` clean; `engine:lint` (clippy -D warnings) clean; `engine:test` all suites ok; `engine:build` ok; vitest webview engineSource 21 passed; vitest backend stagedFile + diffTexts 93 passed (diffTexts logs a pre-existing, expected Rust panic message from a negative test); `pnpm run typecheck` clean; strict Biome on the four touched .ts files clean (prints a schema-version info note, 2.5.13 vs CLI 2.6.5, not an error). Sonar: integrator
- **Acceptance:** engine header check before allocation for revision and index reads (met, `check_blob_size`, boundary tests at limit and limit+1); distinct outcome `ErrorKind::TooLarge` (met); working-file read bounded by `take(limit+1)` in `file_read.rs` (met; growth tested with an endless reader); limit is a parameter of `*_limited` functions, public paths use 64 MiB (met); `Engine::file` path and strict UTF-8 fixed (met; lexical check only, documented as not preventing symlink escapes); diff tab disk read bounded and too-large mapped to `{ kind: "tooLarge" }`, `maxFileSizeMb` unchanged (met); same handling in `stagedFile.ts` (met, new `{ tooLarge: true }` variant, CLI `maxBuffer` overrun also maps to it); gitlink unchanged (met)
- **Deviations from the slice:** authorized extra files `error.rs` and napi `node/src/lib.rs` (new `TooLarge` kind and mapping). `Engine::file` rejects bad paths with `InvalidArgument`, working-tree I/O failures are `Io` (upstream used `Git` for both). A genuinely 64 MiB real-blob test was not added (tiny-limit tests instead). Upstream provenance: adapted ideas from upstream `634ca6c` hunks in `native/core/src/blob.rs` (`check_blob_size`, `text_or_binary`, `working_tree_path` guard, header checks in `index_file`, `blob_at`) and `native/core/src/api.rs` (`Engine::file` delegation); its `config_and_blob.rs` tests were read but not copied (mine use tiny limits). The fix commit `7da6b38` carries the `neophack` co-author trailer. Upstream's `commit_file_bytes`, `index_file_bytes`, `entry_data` and gitlink hunks do not exist here and were not taken. No NOTICE or LICENSE edits.
- **Open questions / follow-ups:** the engine version is not bumped, but TS now relies on the `TooLarge:` prefix, which an older binary lacks (it would throw a Git error and fall back to the CLI, whose `maxBuffer` also maps to tooLarge, so behavior stays correct); integrator may still bump per the engine-version rule. `pnpm run` printed a harmless postinstall note through the symlinked `node_modules`. R05 can build on `blob_at`'s `limit` parameter.
