---
summary: >-
  R07: Remote-tag label order. A follow-up R06 found: when a mirrored remote
  tag and a remote branch share a commit, the engine path orders their labels
  differently from the CLI path. Waits on R03, which also edits `commits.ts`.
---

# R07 — Remote-tag label order

Status: claimed by Claude Sonnet on 2026-11-08 23:55

Needs: R03

Read first: Engine upstream integration overview, Multi-agent releases,
R06's report (`150-r06-remote-refs.md`), W26J (`367-w26j-no-duplicate-remote-tracking-tag-badges.md`
under Release 1.10.0), Phase 16 invariants/non-goals.

## Facts (found by R06, `2026-11-08`)

- A `refs/remotes/<remote>/…/tags/<tag>` ref, as a
  `+refs/tags/*:refs/remotes/<remote>/tags/*` refspec creates, is shown on
  both backends as a `<remote>/<tag>` tag (W26J).
- When such a ref and a remote branch point at the same commit, the two
  backends order that commit's labels differently. The CLI path keeps the
  order of the real `refs/remotes/…` names, so `dev/t` (from
  `refs/remotes/dev/tags/t`) comes before `origin/changes/foo`. The engine
  path's mapper, `mapEngineCommitData` and `refSortRank` in
  `src/backend/engine/commits.ts`, ranks the label with the tags, after the
  remote branches.
- R06 confirmed it predates its own change: the same case fails with the
  remote branch renamed to `origin/foo`. R06's TypeScript parity case avoids
  the collision; `remoteTagParity.test.ts` does not cover it.

## Touch

src/backend/engine/commits.ts; tests/backend/engine/commits.test.ts;
tests/backend/engine/remoteTagParity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

The CLI path is the reference (Phase 16 invariant 3): make the engine path
produce the same label order as the CLI for a commit carrying both a mirrored
remote tag and remote branches, including remote tags of several remotes and
a local tag of the same name (W26J's duplicate rule). Add the colliding case
to `remoteTagParity.test.ts`, asserting full equality on both backends. If
the engine payload does not carry enough to reproduce the CLI's order (for
example the real `refs/remotes/…` name), stop and report: an engine change
is a separate decision.

Run focused checks: strict Biome on touched files, `pnpm run typecheck`,
and the engine vitest files you touch after `pnpm run engine:build`.
Document exact commands and results. Claim and changes use signed commits;
never push. Report Sonar: integrator.

## Report

- **Agent / date:** Claude Haiku (Haiku 5.5), 2026-11-08 23:36
- **Branch and commits:** `engine-review/R07`, base `51908ec`:
  - `4b11455 G docs(engine): claim R07 remote-tag label order (R07)`
  - `5131007 G test(engine): reproduce the remote-tag label order divergence (R07)`
    (this branch's HEAD fails one test on purpose; see the blocker below)
- **Files changed (`git diff --stat 51908ec..HEAD`):**
  - `docs/kb/050-ongoing-work/070-engine-upstream-integration/160-r07-remote-tag-label-order.md`: +1 −1 (claim, then this report)
  - `tests/backend/engine/remoteTagParity.test.ts`: +80 −8 (88 lines in the diff)
  - `src/backend/engine/commits.ts`: unchanged. `tests/backend/engine/commits.test.ts`: unchanged.
- **Tests added or changed:**
  - `remoteTagParity.test.ts`: 2 before, 3 after. New `describe("remote-tag label order")`
    with one case, `lists a commit's labels in the CLI's refname order on both backends`.
    It has its own fixture repository. The existing two cases and their assertions are
    unchanged; the helpers `args` and `bothBackends` only gained a directory parameter.
  - `commits.test.ts`: none added. See the blocker: a mapper unit case would have to pin an order the
    payload cannot express.
  - Reproduction, per the CLI (`loadCommits.ts`): `for-each-ref` sorts by full refname, so for
    the shared commit the CLI gives `tag:dev/t`, `remote:origin/changes/foo`, `tag:origin/v`,
    `tag:u`. The CLI arm passes that expectation. The engine arm gives
    `remote:origin/changes/foo`, `tag:dev/t`, `tag:origin/v`, `tag:u`, the divergence.
    The fixture also shows that the local `u` drops origin's mirror of `u` (W26J), and that the
    engine and CLI agree on everything else in the repository.
- **Gates (focused, run as listed):**
  - `CARGO_BUILD_JOBS=8 pnpm run engine:build`: exit 0 (addon built, debug).
  - `CARGO_BUILD_JOBS=8 npx vitest run --project backend tests/backend/engine/commits.test.ts tests/backend/engine/remoteTagParity.test.ts tests/backend/engine/parity.test.ts`:
    1 failed, 61 passed (62). The failure is the new R07 case, engine arm only, as above.
    Files: `commits.test.ts` and `parity.test.ts` pass; `remoteTagParity.test.ts` 2 of 3 pass.
  - `pnpm run typecheck`: exit 0 (`tsc` over `src`, `src/webview`, `tests`).
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings src/backend/engine/commits.ts tests/backend/engine/commits.test.ts tests/backend/engine/remoteTagParity.test.ts`:
    exit 0, 3 files clean. Biome printed a config-schema notice (config says 2.5.13, CLI is 2.6.5);
    it is informational and not a finding.
  - Sonar: integrator.
- **Acceptance:**
  - Engine mapper produces the CLI order, including remote tags of two remotes, a local tag of the
    same name, and remote branches next to a remote tag: **not met (blocked)**.
    Evidence: the reproduction above. Cause, verified in source:
    - The CLI orders a commit's labels by the real refname: `refs/remotes/<r>/tags/<t>` ranks with
      the remote branches, `refs/tags/<t>` after them (`loadCommits.ts` `getRefs` and `parseRefLines`).
    - The engine's commit payload (`engine/native/core/src/graph.rs` around line 332, and
      `src/backend/engine/commits.ts` `EngineCommitTag`) carries each tag as `{name, annotated, signed}`
      only. A remote mirror is named `<remote>/<tag>` (`refs/remotes/<r>/tags/<t>` shortened by
      `remote_tag_name` in `engine/native/core/src/refs.rs`).
    - A local tag `dev/t` and a remote mirror `dev/t` therefore produce the same wire entry. The CLI
      orders them differently: the local one comes after `remote:origin/changes/foo`, the mirror
      before it. Two different expected outputs from one input means no mapper can match both.
      The top-level `tags` list is no help either: it is built from `ref_data.tags` too, so it
      also mixes remote mirrors with local tags (`graph.rs` around line 138).
    - Splitting `<r>/<t>` back into the real name is also lossy: a remote name containing `/`, or a
      remote branch whose path contains `/tags/` (both backends treat that as a tag), gives a name
      that cannot be mapped back to its refname.
  - Each commit's labels follow the CLI order, with W26J's duplicate rule still dropping the
    duplicate: **not met on the engine arm** (the CLI arm and the duplicate drop are verified by the
    fixture's expectation; the engine arm fails only on order).
  - Full equality on both backends in `remoteTagParity.test.ts`: **added, failing on the engine arm**.
    No assertion was relaxed.
- **Deviations from the slice:**
  - Step 3 (mapper change) was not done, per step 4: the payload does not carry enough, so I stopped
    before changing `commits.ts`.
  - The reproduction is committed on purpose (`5131007`), so the branch's HEAD fails one test. It must
    not be integrated while blocked. Remove or fix that case only with the engine decision.
  - The brief asked for mapper ordering unit cases in `commits.test.ts`. None were added: they would
    have to pin the wrong order, or an order that depends on a guess.
- **Open questions / follow-ups (decision needed from the maintainer; an engine change is a separate decision):**
  1. Option A (engine, Rust): have the engine label each tag with its real refname or a `remote` owner
     field (the same way `GitCommitRemote` carries `remote`). Then `commits.ts` can sort by the real
     name exactly. This is a change to `graph.rs`, `refs.rs` and the wire types, and needs a decision.
  2. Option B (accept the divergence): record it as a known pre-existing divergence in the overview's
     open questions, with the test marked as a known gap. This needs the maintainer, since it weakens the
     "divergence is a bug" rule.
  3. Not checked here: whether git accepts `/` in remote names. Only matters for the split, not for the
     blocker above.
  4. Upstream: nothing was read from `vscode-git-graph-rs` for this slice. No provenance is due.
