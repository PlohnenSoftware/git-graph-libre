---
summary: >-
  R06: Remote-ref classification. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R06 — Remote-ref classification

Status: integrated `83cdd5d`

Needs: R01

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/refs.rs; engine/native/core/src/graph.rs; engine/native/core/tests/remote_ref_parity.rs; tests/backend/engine/parity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Remove Gerrit-specific /changes/ hiding and /tags/ reclassification so all refs/remotes entries remain remote branches like CLI. Cover literal branch segments changes and tags, real annotated tag targets, symbolic HEAD and hidden remote behavior. Avoid per-ref prefix formatting and double annotation maps where useful. Own implementation against Git; never import Gerrit source.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-08 23:24
- **Branch and commits:** `engine-review/R06`, base `6f8bf0f`:
  - `6d5e080 G docs(engine): claim R06 remote-ref classification (R06)`
  - `85738de G docs(engine): block R06 on the /tags/ remote-ref decision (R06)` (superseded by the narrowing)
  - `a832b4c G docs(engine): reclaim R06 with the narrowed scope (R06)`
  - `b3fcb82 G fix(engine): list /changes/ remote refs as remote branches (R06)`
  - `63ffada G refactor(engine): build the ref-annotation lookup once (R06)`
  - `b9b97eb G test(engine): pin remote-ref classification against git (R06)`
  - `647cb62 G style(engine): rustfmt the remote-ref parity tests (R06)`
  - `5463090 G docs(engine): report R06 as blocked on the TypeScript label-order case (R06)` (superseded)
  - `5ebbc26 G docs(engine): correct the R06 report time and file counts (R06)`
  - `4aab9bd G docs(engine): use exact per-file counts in the R06 report (R06)`
  - `41da147 G test(engine): parity for changes-segment refs and a hidden remote (R06)`
- **Files changed (`git diff --numstat 6f8bf0f..HEAD`):** `engine/native/core/src/refs.rs` (+17 −16), `engine/native/core/src/graph.rs` (+11 −8), `engine/native/core/tests/log_and_refs.rs` (+17 −12), `engine/native/core/tests/remote_ref_parity.rs` (+234, new), `tests/backend/engine/parity.test.ts` (+27), and this slice file. Total: +350 −38 across the six files.
- **Tests added or changed:**
  - `remote_ref_parity.rs`: 0 to 4 (`changes_and_tags_segments_follow_the_cli_classification`, `an_annotated_remote_tag_mirror_peels_to_its_commit`, `a_symbolic_remote_head_resolves_as_git_resolves_it`, `a_hidden_remote_shows_no_branch_or_tag_but_its_name_prefix_does_not_match`).
  - `log_and_refs.rs`: 22 before and 22 after. `never_shows_code_review_change_refs` is replaced by `lists_code_review_change_refs_as_remote_branches_like_git`, a deliberate behavior change ordered by the integrator.
  - `parity.test.ts`: 1 added, `agrees on refs with changes segments, and on a hidden remote`. It compares full equality on both backends, with no remote tags in the fixture.
  - Engine total: 242 before, 246 after, 0 failed.
  - Nothing was deleted. The `/tags/` helper and its classification are kept, as ordered.
- **Gates:**
  - `CARGO_BUILD_JOBS=8 cargo test --manifest-path engine/Cargo.toml -p git-graph-core --test remote_ref_parity --test log_and_refs --test ref_errors`: 4, 22 and 4 passed, 0 failed.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:fmt`: the first run failed on the new test file's formatting. Fixed by `cargo fmt -p git-graph-core` in `647cb62`. Now passes.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:lint` (clippy, `-D warnings`): clean.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:test`: exit 0, 246 passed, 0 failed. An earlier run failed on `vscode_fixtures.rs` (diff crate, untouched) with a NotFound from a stale cached test binary. A touch and rebuild passed, and the full rerun passed.
  - `CARGO_BUILD_JOBS=8 pnpm run engine:build`: exit 0. The addon was rebuilt before the TypeScript parity run.
  - `npx vitest run --project backend tests/backend/engine/parity.test.ts tests/backend/engine/repoInfo.test.ts tests/backend/engine/remoteTagParity.test.ts`: 3 of 3 files, 65 of 65 tests passed, none skipped.
  - `pnpm run typecheck`: exit 0.
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings tests/backend/engine/parity.test.ts`: exit 0, no fixes.
  - Sonar: integrator.
- **Acceptance:**
  - Remove the `/changes/` filter so refs stay remote branches: **met**. Evidence: `lists_code_review_change_refs_as_remote_branches_like_git`, and the `origin/changes/foo` and `origin/feature/changes` cases in `remote_ref_parity`. The listed set equals `git for-each-ref refs/remotes` minus tag-segment refs.
  - Keep `/tags/` classification, its W26J duplicate rule and its helper; remoteTagParity untouched: **met**. `remote_tag_name`, the mirror check and `remoteTagParity.test.ts` are unchanged.
  - Module docs describe the new behavior and keep the `/tags/` part accurate: **met**.
  - Allocation cleanups with no behavior change: **met**. The hidden-remote check and the owner check compare with `strip_prefix`, not `format!`. `annotate_refs` builds one lookup. A test covers `devops` against hidden `dev`.
  - Rust parity tests (changes, tags, annotated mirror, symbolic HEAD, hidden remote, tags guard): **met**. Each case compares against `git for-each-ref` or `rev-parse`.
  - TypeScript parity case for `changes` refs and the hidden remote on both backends after the rebuild: **met**. Evidence: the vitest trio above, 65 of 65, with the case run against the engine (not skipped). Full equality, no assertion relaxed.
- **Deviations from the slice:**
  - The first pass stopped at `85738de` because the brief's `/tags/` removal contradicted the CLI and W26J. The integrator narrowed the scope, and this report completes the narrowed slice.
  - The first TypeScript case included remote tags, which hit a label-order divergence in `src/backend/engine/commits.ts`. The integrator ruled it outside R06. The case was reworked to leave tags out (`41da147`). `remoteTagParity.test.ts` covers the tag mirror.
- **Open questions / follow-ups:**
  1. **Label-order divergence, handed to the integrator as R07.** When a mirrored remote tag and a remote branch share a commit, the engine orders the tag label with the tags (`mapEngineCommitData` / `refSortRank` in `src/backend/engine/commits.ts`). The CLI orders it by its real `refs/remotes/…` name. This predates R06, and R07 waits on R03 because R03 also edits `commits.ts`.
  2. Candidate 9 is already corrected on main (`4a7d346`). It is not re-checked here.
  3. The `/changes/` removal needs the maintainer's confirmation as a behavior change. The old test is replaced, and the comment on the new one says why.
  4. Upstream code: nothing was read from upstream for this slice, and no allocation idea was adapted, so no provenance is due. NOTICE, LICENSE, version and CHANGELOG were not touched.
