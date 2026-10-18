---
summary: >-
  Record of release `1.6.0` (`2026-09-10`): `1.5.1` was never tagged and
  folded in; `view.stashRows`/`view.uncommittedTree` telemetry; gate results;
  the tag was created locally, with the push left for later.
---

# Release `1.6.0` (`2026-09-10`)

Sixteen commits since `v1.5.0`. Stash graph rows, the staging folder tree with
folder drag-staging, two new settings, the dialog control system, and the
locked-control pattern — a minor, and it closes Phase 7's remaining item.

**`1.5.1` was prepared but never tagged, so it folded into this release.**
This is the second time (see `1.4.3` above), and the handling is the same: one
honest dated section rather than a `1.5.1` heading whose
`v1.5.0...v1.5.1` compare link would 404. The link-reference block was
updated too — the stale `[1.5.1]` entry pointed at a tag that will never
exist. **Check that block whenever a prepared version is skipped**; the
section heading is the obvious half and the links are the half that gets
missed. Do not look for a `v1.5.1` tag: the sequence is `v1.5.0` → `v1.6.0`.

**Two telemetry signals ship with it**, both through
`createViewFeatureReporter()` and both once per session:
`view.stashRows` (added with the graph rows) and the new
`view.uncommittedTree`. The second fires only when the panel *actually* drew a
folder tree — tree mode selected **and** a change in a subdirectory — because
tree mode over root-level changes renders a flat list either way, and
reporting that would count intent rather than use. `grouped` is computed in
the `uncommittedDetails` route rather than inside the reporter, so no path
crosses into the telemetry module; the payload stays the fixed id.

**A limitation worth knowing before someone reads these numbers:** folder
drag-staging is *not* separately measurable. It sends the same `stageFiles` /
`unstageFiles` commands as a single-file drag, and distinguishing them would
mean either a new command invented for telemetry's sake or a call outside the
three chokepoints. `view.uncommittedTree` says the tree was shown; the drag
itself is inferred from that plus the action counts.

Release gate over the completed tree, all clean: strict Biome (one formatting
fix in `messageHandler.ts`), `pnpm run package`, `pnpm run test` `48` files /
`500` tests, `pnpm run l10n:check` `100%` for all four locales,
`pnpm run test:coverage` `109` files / `979` tests at `92.9%` lines
(`6,040`/`6,502`), and `pnpm run sonar:scan` task
`be1392ab-99e1-466e-823d-24b7183fa873`, analysis
`44a5b83d-2389-4f26-b6d1-7e3d2498e376`: `ZAM` gate **`OK`** on all seven
reported conditions — `new_coverage` `91.1`, `new_violations` `0`,
duplication `0.0`, window `PREVIOUS_VERSION` `1.5.1`.

The remote-grouping change landed *after* the first release gate, so the tag
was moved to the final commit and the gate re-run each time; earlier passes
were tasks `62558a8f-8c00-4d74-85d2-7256c6a7a405` and
`ac35cff7-cee1-41d8-96b0-774ba0e8d26d`. Moving a tag is only safe because
nothing had been pushed — once a tag is published, move it and you have
changed what a released version means.

`sonar.projectVersion` advanced `1.5.1` → `1.6.0` with the package version, so
this analysis measures the whole delta since the last analyzed version and the
next one starts a fresh window.

**The tag was created without pushing, at the maintainer's explicit request.**
`main` has *not* been fast-forwarded and nothing is on the remote, so the
branch-and-release policy's final steps are still outstanding: fast-forward
`main` to this commit, then push the branch and the tag to let the Marketplace
workflow run.
