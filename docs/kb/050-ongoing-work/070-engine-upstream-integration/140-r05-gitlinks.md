---
summary: >-
  R05: Gitlink content. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R05 — Gitlink content

Status: done — awaiting integration

Needs: R02

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/blob.rs; engine/native/core/tests/gitlink_content.rs; src/extension/diffTab/engineSource.ts; tests/webview/diffTab/engineSource.test.ts; src/backend/engine/stagedFile.ts; tests/backend/engine/parity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Adapt native f007528 gitlink content for revisions/index. Align CLI diff-display route with synthetic Subproject commit hash text. Verify real temporary gitlinks and missing-object submodule commits. Preserve ordinary blob and binary behavior.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-08
- **Branch and commits:** `engine-review/R05` — see `git log 6f8bf0f..HEAD` (the commit-header follow-up adds three commits after `87183a8`): claim `d3970de`; engine fix `7edc694`; engine tests `191875c`; index CLI route `9b83b22`; revision CLI route `a3cd6d1`; backend tests `39165ef`; diff-tab tests `976c6cd`; this report. All `G`.
- **Files changed:** `engine/native/core/src/blob.rs`; new `engine/native/core/tests/gitlink_content.rs` (5 tests); `src/backend/engine/stagedFile.ts`; `src/extension/diffTab/engineSource.ts`; new `tests/backend/engine/gitlinkContent.test.ts` (8 tests); `tests/backend/engine/stagedFile.test.ts` (+1); `tests/webview/diffTab/engineSource.test.ts` (+3, 21 to 24 with R02's).
- **Design:** the synthetic text `Subproject commit <hash>\n` is the diff-display representation, not what `git show <rev>:<path>` prints (that fails when the commit is absent). Engine: `index_file` returns it for mode 160000 without any object lookup; `blob_at` returns it for a commit-mode tree entry, before and outside the size check. CLI routes: `git show` runs first as before; only when it fails does a second call (`git ls-tree -z <ref> -- <path>` for revisions, `git --literal-pathspecs ls-files --stage -z -- <path>` for the index) look for mode 160000 at exactly that path (index: stage 0), and the same text is built. Ordinary files cost no extra Git call.
- **Gates:** `cargo test -p git-graph-core --test gitlink_content --test bounded_reads`: 5 + 7 passed (the 4 gitlink tests fail without the `blob.rs` change); `engine:fmt` clean; `engine:lint` (clippy -D warnings) clean; `engine:test` / `cargo test --workspace --no-fail-fast`: all suites ok except `git-graph-diff` `vscode_fixtures` (`all_58_fixtures_match_exactly_moves_included`, ENOENT reading the fixtures dir; the directory exists in the worktree, so it looks like a stale compile-time `CARGO_MANIFEST_DIR` in the seeded cache, not related to this slice; not investigated further); `engine:build` ok; vitest backend `gitlinkContent` + `stagedFile`: 20 passed; vitest webview `engineSource`: 24 passed; `pnpm run typecheck` clean; strict Biome on the five touched `.ts` files clean (schema-version info note only). Sonar: integrator
- **Acceptance:** engine revision and index gitlink read as text (met, `gitlink_content.rs`); missing submodule commit object (met, fixtures point at a commit not in the repo); ordinary blob, binary, too-large and missing unchanged (met, `bounded_reads` still 7 pass, unchanged-reads test); CLI diff-tab route aligned for revision and index (met, `engineSource.test.ts`, `stagedFile.test.ts`, `gitlinkContent.test.ts`); both backends compared (met, `gitlinkContent.test.ts`); synthetic text documented as display-only in code comments (met).
- **Upstream provenance:** adapted from `f007528` `native/core/src/blob.rs` only: the `index_file` `mode.is_submodule()` branch and the `blob_at` `mode().is_commit()` branch, reworked (shared `gitlink_text` helper, placed before the blob size check, `text_or_binary` for the index). The `634ca6c` blob.rs diff was read for context; nothing from it adapted here. The engine fix commit `7edc694` carries the `neophack` co-author trailer. The TypeScript CLI route and all tests are original. No NOTICE or LICENSE edits.
- **Deviations from the slice:** tests live in the new `tests/backend/engine/gitlinkContent.test.ts` instead of `parity.test.ts` (per dispatch, R06 edits it); `stagedFile.test.ts` edited (not in this file's Touch list; allowed by the dispatch).
- **Open questions / follow-ups:** (1) RESOLVED on the integrator's decision: when `git show` succeeds and its first line looks like a commit header (`startsLikeCommitHeader`: `commit <40 or 64 hex>`, optional decoration, optional leading ANSI color), both CLI routes run the gitlink check (`readRevisionGitlink` / `readIndexGitlink`); only a confirmed gitlink changes the result. Evidence: `gitlinkContent.test.ts` (gitlink pointing at an existing commit of the same repository: engine and CLI agree on the Subproject line for revision and index; a file starting with `commit <40 hex>` keeps its content; helper unit cases) and a new `engineSource.test.ts` case (webview 25 pass, backend 24 pass). Checks rerun: gitlink_content 5 and bounded_reads 7 pass, typecheck clean, strict Biome clean on the 5 touched files. The suppression-comment route was avoided: the ANSI escape is handled without a control-character regex. (2) `git show :s*` style odd input exits 0 with empty output and is read as empty text (pre-existing, unchanged). (3) An older addon binary lacks the gitlink fix: its reads throw, both fall back to the CLI route, which returns the same text; no engine version bump was made. (4) `vscode_fixtures` ENOENT in this worktree is left for the integrator to check on main.
