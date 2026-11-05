---
summary: >-
  How the integrator turns finished 1.10.0 slices into the release branch:
  the Integrator procedure for release 1.9.0 applies, with the 1.10.0
  branch names and waves; the agent and model choice is asked again (the
  1.9.0 choice covered that release only); and W01's dependency refresh
  needs every platform binary rebuilt and the packaged-VSIX check on all
  legs before W90.
---

# Integrator procedure for release 1.10.0

**Follow the Integrator procedure for release 1.9.0**, with the substitutions
of the Agent protocol for release 1.10.0: the integration branch from
decision Y1, slice branches `wt-1.10.0/<id>`, and slice worktrees
`../ggl-<id>`, recycled as that procedure describes.

Changes for this release:

- **Ask which agent and model to use before the first dispatch.** The
  maintainer's `2026-10-19` choice (`general-purpose`; Haiku, then Sonnet,
  then Opus by difficulty, cheapest first) covered "the rest of release
  1.9.0". Ask again, and record the answer in decision Y16 and the
  integration log.
- **Wave gates** (fresh coverage, SonarQube polled to `OK`, `kb:graph`)
  after waves A, B, C, D and E, and once more before W90.
- **After W01 (gix 0.90 and the Cargo refresh):** every platform binary
  changes. Before W90, rebuild all of them with `pnpm run engine:build:all`
  and run `verify-vsix.yml` as a manual dry run on every leg
  (Verifying the packaged VSIX on every platform under Phase 16). Raising
  the pinned toolchain in `rust-toolchain.toml` is not part of W01. Its own
  comment says to do that on its own.
- **Worktrees of this repository.** The orchestrator's own slice worktrees
  are linked worktrees of this repository, so a hand test of the feature on
  this repository shows them, and an accidental Remove or Prune here would
  destroy a slice's work. Hand-test on a scratch repository.
- Slices that touch `package.json`, `package.nls*.json` or the five `l10n`
  bundles run one after another, never in parallel, since they conflict
  textually: W11, W20, W21, W22, W23, W24, W30 and W31.
