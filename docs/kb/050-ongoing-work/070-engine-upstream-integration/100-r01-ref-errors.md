---
summary: >-
  R01: Ref failures. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R01 — Ref failures

Status: integrated `7ee2542`

Needs: none

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/graph.rs; engine/native/core/tests/ref_errors.rs

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Replace swallowed read_refs errors at both graph entry points; retain benign unborn/no-stash behavior. Add temporary corrupt-ref regression tests comparing failure with Git. Do not promise CLI fallback for genuine engine errors. Source: f007528 native graph hunks.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-08 23:13
- **Branch and commits:** `engine-review/R01`
  - `7ad9fc5 G docs(engine): re-claim ref-error slice (R01)`
  - `181ae04 G test(engine): pin ref-read failures against git and the benign loads (R01)` (red before the fix: both corrupt-ref tests failed)
  - `59d1210 G style(engine): rustfmt the ref-error tests (R01)`
  - `df22797 G fix(engine): propagate ref-read failures in repo_info and load_commits (R01)` (adapts upstream f007528, see Provenance)
  - `f596d4c G test(engine): satisfy clippy in the ref-error tests (R01)`
  - this report commit, `G`, `docs(engine): report R01 ref-error slice (R01)`
- **Files changed (3681c5e..f596d4c):** `engine/native/core/src/graph.rs` 7 (+4/−3); `engine/native/core/tests/ref_errors.rs` 125 (+125, new); this slice file (+1/−1 claim, plus this report).
- **Tests added or changed:** `tests/ref_errors.rs`, 0 → 4 tests:
  `corrupt_packed_refs_fail_repo_info_as_git_does`, `corrupt_packed_refs_fail_load_commits_as_git_does`, `an_unborn_head_still_loads_as_an_empty_graph`, `an_ordinary_repository_without_stashes_loads`. The corrupt-ref tests first assert that `git for-each-ref` / `git log --all` exit non-zero on the same repository, using a local `Command` because the shared helper returns stdout only; they then assert `ErrorKind::Git`. Before the fix, the two corrupt-ref tests failed and the two benign tests passed.
- **Gates:**
  - `CARGO_BUILD_JOBS=8 cargo test --manifest-path engine/Cargo.toml -p git-graph-core --test ref_errors`: 4 passed, exit 0.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:fmt`: exit 0.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:lint`: exit 0 (first run exit 101 on two `.err().expect()` clippy errors, fixed in `f596d4c`).
  - `CARGO_BUILD_JOBS=8 pnpm run engine:test`: exit 0, every suite `ok`.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:build`: exit 0 (debug addon, `native/linux-x64/git-graph.node`).
  - `npx vitest run --project backend tests/backend/engine/repoInfo.test.ts tests/backend/engine/commits.test.ts tests/backend/engine/parity.test.ts`: 3 files, 89 tests passed, exit 0.
  - `rustfmt --check --edition 2021` on both Rust files: pass.
  - `node docs/kb/housekeeping.mjs --check`: exit 0. `pnpm run kb:check` was not run.
  - Biome and typecheck: not run. No TypeScript file changed.
  - Sonar: integrator.
- **Acceptance:**
  1. Both entry points propagate read_refs failures: met. `repo_info` and `load_commits` use `read_refs(...)?`. Evidence: the two corrupt-ref tests return `ErrorKind::Git`.
  2. Corrupt `packed-refs` fixture, with Git failing on the same repository: met. Evidence: `git for-each-ref` and `git log --all` assertions inside those tests.
  3. Benign cases still `Ok` with expected content: met. An unborn HEAD gives `head == Some("main")`, branches `["main"]`, an empty graph. An ordinary repository with no stash gives its branch, tag, one commit, and empty stashes.
  4. No change to per-entry error handling in `refs.rs`, no CLI-fallback promise: met. `refs.rs` is untouched. `read_stashes(...).unwrap_or_default()` is kept as it was.
  5. Temporary directories only: met. Every fixture is a `TestRepo`.
- **Provenance (upstream adaptation):** `df22797` adapts the two `read_refs(...)?` hunks of upstream commit `f007528` (`native/core/src/graph.rs`, `git -C .../vscode-git-graph-rs show f007528 -- native/core/src/graph.rs`), with comments rewritten. Not adopted from that diff: the Gerrit `show_change_refs` option and the upstream comment about CLI fallback. No other upstream file was read.
- **Deviations from the slice:**
  - The worktree's copy of the overview still says "Start R01 on GPT-6 Luna". I followed the integrator's record on `main` (`e6633b0`), which assigns R01 to Claude Haiku. The overview in the integration branch needs that corrected.
  - The `181ae04` test commit is intentionally red before the fix, to show the regression.
  - A `--amend` was blocked by a destructive-command gate, so the rustfmt fix is a separate signed commit (`59d1210`), not an amendment.
  - The `Status:` line was set by a `sed` on the claim line, then by an Edit.
  - Probe scratch left in place: `/tmp/ggl-r01-probe.kk4L` (a throwaway repository with a garbage `packed-refs`, from a Git-behavior probe). Two `rm -rf` attempts were blocked by a hook, so I left it. Logs are in `/tmp/ggl-r01-*.log`. Both can be deleted.
- **Open questions / follow-ups:**
  - Design invariant 4 ("no slice changes user-visible behavior") and this slice's acceptance conflict for corrupt-ref repositories. Those repositories previously rendered empty with no error and now show a Git error through the TypeScript layer. The slice explicitly asks for this, so I implemented it, but the integrator should confirm it is the intended user-visible change. `src/backend/engine/index.ts` routes `Git` errors to the user and falls back only for "not a repository" and "unsupported".
  - `read_stashes(...).unwrap_or_default()` still swallows stash-read failures in both entry points. Outside this slice; a candidate follow-up.
  - Upstream's `show_change_refs` Gerrit option is not part of this change.
  - Sonar: integrator.
