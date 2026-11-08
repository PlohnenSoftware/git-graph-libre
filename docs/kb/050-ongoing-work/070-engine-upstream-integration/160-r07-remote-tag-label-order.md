---
summary: >-
  R07: Remote-tag label order. A follow-up R06 found: when a mirrored remote
  tag and a remote branch share a commit, the engine path orders their labels
  differently from the CLI path. Waits on R03, which also edits `commits.ts`.
---

# R07 — Remote-tag label order

Status: ready

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

Not started.
