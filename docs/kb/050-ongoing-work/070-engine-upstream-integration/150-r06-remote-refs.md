---
summary: >-
  R06: Remote-ref classification. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R06 — Remote-ref classification

Status: blocked — the brief's `/tags/` removal conflicts with the CLI path and the W26J decision; see Report

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

- **Agent / date:** Claude Haiku 5.5, 2026-11-08 23:18
- **Branch and commits:** `engine-review/R06` — `6d5e080 G docs(engine): claim R06 remote-ref classification (R06)`
- **Files changed:** `docs/kb/050-ongoing-work/070-engine-upstream-integration/150-r06-remote-refs.md` (this Status and Report only). No code, test or other file changed.
- **Tests added or changed:** none. Count unchanged.
- **Gates:** none run. The slice was stopped before any code change, so no cargo, engine, vitest, typecheck or Biome command was run. Sonar: integrator.
- **Acceptance:** not met (no implementation). Evidence gathered for the stop:
  - `engine/native/core/src/refs.rs` lines 178–183 skip `/changes/` refs. `src/backend/queries/loadCommits.ts` (`parseRefLines`, `toGitRef`, `remoteTagNames`, lines 111–200) and `src/backend/utils/remoteRefs.ts` do not filter `/changes/`. The CLI path therefore already shows those refs as remote branches, which matches the brief.
  - `refs.rs` lines 196–209 and `remote_tag_name` (lines 248–253) reclassify `refs/remotes/<remote>/…/tags/<t>` as tags named `<remote>/<t>`. The CLI path does the same in `loadCommits.ts` (`remoteTagNames`, `toGitRef`, `parseRefLines`), including the mirror-dedupe rule. The CLI does not show these as remote branches.
  - The CLI behavior is deliberate. KB `050-ongoing-work/050-release-1-10-0-the-worktrees/360-w26-tags-show-the-remotes-that-hold-them.md` (issue #46) and `…/367-w26j-no-duplicate-remote-tracking-tag-badges.md` (`2026-11-06`) record that a `refs/remotes/<remote>/tags/<tag>` ref shows as a `<remote>/<tag>` tag badge, and that both backends must agree. Phase 15 (`070-history/020-roadmap-completed-phases/110-phase-15-…`) also covers the remote tag surface. `tests/backend/engine/remoteTagParity.test.ts` asserts that parity.
  - The candidate-9 text in `230-upstream-engine-review-first-pass.md` ("the CLI shows both as remote branches") is wrong for `/tags/`. It is older (`2026-10-16`) than W26J (`2026-11-06`).
- **Deviations from the slice:** stopped before implementing. The brief says to remove both special cases so every `refs/remotes/*` entry is a remote branch "exactly as on the CLI". That contradicts the CLI code and the W26J decision for `/tags/`. The brief's own rule says the KB wins and conflicts are raised, not guessed. Per protocol section 8, the slice is blocked.
- **Open questions / follow-ups:**
  1. Maintainer decision needed on `/tags/`. Option A: keep the tag reclassification in the engine, since it matches the CLI and W26J. Then R06 narrows to the `/changes/` removal, the allocation cleanups and the new tests, and the candidate-9 text is corrected. Option B: remove it from both backends. That reverses W26J and issue #46, and touches `loadCommits.ts`, `remoteRefs.ts`, `remoteTagParity.test.ts` and the tag UI, all outside this slice's Touch list. A decision is needed before any code change.
  2. `/changes/` removal appears to match the CLI (the CLI never filters it). The maintainer should confirm this part is still wanted. Note that `engine/native/core/tests/log_and_refs.rs` (`never_shows_code_review_change_refs`, lines ~488–515) asserts the current `/changes/` filter. It is outside the Touch list, so it would need its own decision to update.
  3. Candidate 9 in `230-upstream-engine-review-first-pass.md` and the 2026-11-08 follow-up bullet are wrong about the CLI for `/tags/`. The integrator should correct them. This slice did not edit the roadmap file.
  4. Upstream code: nothing was read from upstream for this slice. The allocation idea was not adapted, so no provenance is due.
