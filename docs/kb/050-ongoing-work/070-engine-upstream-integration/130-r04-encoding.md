---
summary: >-
  R04: Encoding and subjects. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R04 — Encoding and subjects

Status: done — awaiting integration

Needs: R03

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/text.rs; engine/native/core/src/lib.rs; engine/native/core/src/log.rs; engine/native/core/src/details.rs; engine/native/core/src/search.rs; engine/native/core/src/stash.rs; engine/native/core/src/stats.rs; engine/native/core/src/tag.rs; engine/native/core/Cargo.toml; engine/Cargo.lock; engine/native/core/tests/encoding_parity.rs

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Adapt ff4aafe permitted text logic across wired metadata consumers; audit actual module filenames before dispatch. ISO-8859-1 names/messages, leading blanks and multiline subjects match Git UTF-8 output. Exact encoding_rs 0.8.44 permitted. Unsupported encodings decline safely. No mojibake or partial successful metadata.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-08
- **Branch and commits:** `engine-review/R04`
  - `454b791 G` docs(engine): claim R04 (R04)
  - `bf1de29 G` feat(engine): decode commit text as Git prints it (R04)
  - `44381d0 G` fix(engine): graph rows and author filters read decoded text (R04)
  - `301b6ed G` fix(engine): stash rows read decoded text (R04)
  - `f876001 G` fix(engine): author statistics count decoded names (R04)
  - `ae70bbc G` fix(engine): commit details, bodies and summaries read decoded text (R04)
  - `e6a1421 G` fix(engine): search matches decoded text (R04)
  - `303433d G` test(engine): commit text in other encodings matches Git's UTF-8 output (R04)
  - `adddcf1 G` test(engine): cross-backend parity for commit encodings (R04)
- **Files changed:** new `engine/native/core/src/text.rs` (+255), `lib.rs` (+1), `log.rs` (20), `log/authors.rs` (9), `details.rs` (33), `search.rs` (42), `stash.rs` (12), `stats.rs` (9), `Cargo.toml` (+1, `encoding_rs = "=0.8.44"`), `engine/Cargo.lock` (+1 line, the dependency edge only), new `tests/encoding_parity.rs` (+539), new `tests/backend/engine/encodingParity.test.ts` (+126). The integrator authorized this list because the slice file's `tag.rs` does not exist; `refs.rs` was not touched.
- **Tests added or changed:** 5 unit tests in `text.rs`; 11 in `encoding_parity.rs`; 3 in `encodingParity.test.ts`. Engine suites before and after: all others unchanged and passing. Mutation checks were not run.
- **Gates (all with `CARGO_BUILD_JOBS=10`):** `cargo test -p git-graph-core --test encoding_parity` 11 passed; `--test git_parity` 12, `--test search` 12, `--test traversal_parity` 14, `--test log_and_refs` 22 passed; `pnpm run engine:fmt` clean; `pnpm run engine:lint` (clippy `-D warnings`) clean; `pnpm run engine:test` every suite ok except `git-graph-diff --test vscode_fixtures` (ENOENT at `vscode_fixtures.rs:202`, the same environmental error R05 saw in its worktree; untouched crate); `pnpm run engine:build` ok; `npx vitest run --project backend tests/backend/engine/` 19 files, 405 passed; `pnpm run typecheck` clean; strict Biome on `encodingParity.test.ts` exit 0 (it prints only an info that the installed CLI is 2.6.5 and the config schema 2.5.13); `pnpm run kb:check` clean. Sonar: integrator.
- **Acceptance:**
  - ISO-8859-1 names, subjects and bodies equal Git's UTF-8 output: met (`iso_8859_1_text_is_what_git_prints` compares graph rows, details, bodies, summaries, authors, statistics and `Engine::graph` with `git log --format=%an%x00...%B`; a real `git -c i18n.commitEncoding=ISO-8859-1 commit` test on unix; TypeScript parity case, engine-served).
  - Leading blank lines and multi-line first paragraph: met (`leading_blank_lines_and_a_multi_line_first_paragraph` against `%s`, including CRLF and a blank-only message; search result subjects; TypeScript case).
  - Unsupported label declines: met (`klingon`, `ISO-8859-9`, `UTF-16LE` fail every wired read with `Unsupported`; the TypeScript reader falls back, `served` is false and rows equal the CLI).
  - UTF-8 unchanged: met (no header, `UTF-8`, `utf8`; invalid bytes without a header give U+FFFD as the CLI does).
  - No mojibake or partial metadata: met (a commit whose text cannot be decoded fails the whole read, including below decodable ones; stash and stats loops no longer skip such a commit).
  - Search matches decoded text: met (`--grep`/`--author` found by their UTF-8 spelling, same hash as Git).
  - `i18n.logOutputEncoding`: met. Git's output encoding is `i18n.logOutputEncoding`, else `i18n.commitEncoding`, else UTF-8, and the CLI path reads stdout as UTF-8, so a non-UTF-8 setting yields non-UTF-8 CLI text. `ensure_utf8_output` declines for it on every wired read and is pinned by `a_repository_that_prints_another_encoding_declines` (including the `commitEncoding`-only case and UTF-8 override).
- **Upstream adaptation (for `engine/NOTICE.md`):** `ff4aafe` `native/core/src/text.rs` (the `encoding` header lookup idea, the `subject` fold and its unit test shape) and the decoding call sites in `log.rs`, `details.rs`, `stash.rs`, `stats.rs`. Carried by `Co-authored-by: neophack` on the six source commits. Upstream's `CommitEncoding` treated unknown labels as UTF-8, read the identity through lossy replacement and used `encoding_rs` labels as is. All of the declining rules, the Latin-1 handling, the config check and the tests are our own. Upstream tests (`git_parity.rs`, `log_and_refs.rs`) were not adapted. The upstream mailmap, shallow and replace-ref hunks of the same commit were not taken.
- **Deviations from the slice:** (1) `tag.rs` does not exist; touch list as audited by the integrator. (2) Tag details are unchanged (`details::tag_details`): Git does not re-encode tag objects, and a lightweight tag's `for-each-ref` contents are raw. (3) `author_stats`/`log::authors` decode only identities, so an undecodable message does not decline them. (4) Latin-1 aliases are decoded byte for byte instead of through `encoding_rs`, which would read `0x80..=0x9F` as Windows-1252; labels that `encoding_rs` folds into Windows pages (ISO-8859-9, 11, us-ascii, tis-620) decline unless named `windows-*`/`cp*`.
- **Open questions / follow-ups:** Git's converter is iconv, so for exotic CJK labels (EUC-KR, GBK, Big5 variants) iconv and `encoding_rs` can in principle differ on unusual byte sequences; Shift_JIS, windows-1252 and ISO-8859-1 were checked against Git, the rest were not. A non-UTF-8 repository setting makes every wired read decline, so such repositories always use the CLI. Process note: while working I ran `git stash` and `git stash pop` once in this worktree; the stash list is shared across worktrees and the pop attempted to apply the integrator's existing `stash@{0}` (WIP on main, `3afd840`), conflicting on `docs/AI_DEV_KNOWLEDGE_BASE.md`. The stash entry was kept; I removed the one file the failed pop had placed in this worktree, and the tree matched `HEAD` again. The stash is intact; please check it.
