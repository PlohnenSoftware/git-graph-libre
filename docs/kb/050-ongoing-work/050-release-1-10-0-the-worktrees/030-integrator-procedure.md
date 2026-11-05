---
summary: >-
  How the integrator turns finished 1.10.0 slices into the release branch:
  the integrator procedure of Multi-agent releases (Rules) applies, with the
  1.10.0 branch names and waves; the agent and model choice is Y16's
  (the integrator picks per slice, cheapest first); and W01's dependency refresh
  needs every platform binary rebuilt and the packaged-VSIX check on all
  legs before W90; and which slice's integration commit carries each
  issue's `Closes` line.
---

# Integrator procedure for release 1.10.0

**Follow the integrator procedure of [Multi-agent releases](../../020-rules/040-multi-agent-releases.md)
(Rules)**, with the substitutions of the Agent protocol for release 1.10.0: the
integration branch from decision Y1, slice branches `wt-1.10.0/<id>`, and slice
worktrees `../ggl-<id>`, recycled as that section describes.

Changes for this release:

- **Agent and model: answered by Y16 (`2026-11-05`).** The 1.9.0 choice
  covered that release only, so it was asked again. The maintainer's answer
  is the recorded choice that Multi-agent releases accepts in place of
  asking before each dispatch: the integrator picks per slice, cheapest
  first, and logs each pick in the Integration log.
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
- **Closing issues** (Closing issues from commits, `2026-11-05`). When the
  slice that completes an issue is integrated and the gate passes on the
  result, write `Closes PlohnenSoftware/git-graph-libre#<n>` into the commit
  that records that integration. Each issue closes when that commit reaches
  `main`. Slice commits carry only `Refs`. The completing slices are:
  - #36: W25.
  - #41: W06.
  - #45: W24. W05 only references it.
  - #38: W21. W20 only references it.
  - #37: whichever of W02–W04, W10–W12 and W30–W33 is integrated last.
  - #46: none here. PR #47's own commit, `a109e9a`, carries the line and
    closes #46 when it merges (W26, Y24). If Y24 brings it in through the
    integration branch, keep that line intact.

  A slice deferred by its decision leaves its issue open. Write no closing
  line for it, and record the gap in W90.
