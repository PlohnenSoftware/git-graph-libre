---
summary: >-
  Next release, planned `2026-10-18`: 1.9.0 "The Diff". Gathers every
  diff-related item into small, self-contained slices for one or many
  agents: issue #26 (compare any two commits), the diff-read part of issue
  #31, Phase 8's and Phase 10's comparison items, the bugs found by the
  diff-parity audit, the engine's numstat fixes, and Phase 17's first
  slices. Holds the goals, the slice table, the dependencies and the
  release's definition of done; the agent protocol, decisions and integrator
  procedure sit beneath it.
---

# Release 1.9.0 — "The Diff"

**Status: planned `2026-10-18`. No slice started. The maintainer must first
create the integration branch and answer the decisions that gate some
slices.**

Everything about diffs that is open, in one release: what users asked for,
what the roadmap left behind, and what the `2026-10-18` diff audit found
broken. The work is cut into slices small enough for one agent session each,
with their files, steps, tests and acceptance spelled out, so several agents
can work in parallel. Any agent taking a slice must follow
[the agent protocol](040-release-1-9-0-the-diff/010-agent-protocol.md).

**One rule across all slices (decision X7, `2026-10-18`):** Git-compatible
results (file lists, renames, `+N/−M`) come from gix or Git and are fixed
upstream in gix where possible. What a diff *looks like* comes from the port
of VS Code's algorithm (Phase 17). The two are never mixed.

## Goals and where they come from

| Goal | Source | Slices |
| --- | --- | --- |
| Compare any two commits, by selection or by SHA, branch or tag | [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26); Phase 8 "arbitrary two-commit and ref-to-ref comparison" | D10–D13 |
| Compare a commit with the working tree | Phase 10 "uncommitted-changes details and compare-to-commit" | D14 |
| Open a comparison in the user's external diff tool | Phase 8 and Phase 10 "external directory diff" | D15 (decision X4) |
| Say which backend served each diff read, and why the CLI did | [issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31), the diff-read part of its "result/decline-cause log entries" | D01 |
| Correct stash details without the engine | diff audit: the CLI lists stash files 3×, 2× and as deleted | D02, D03 |
| Correct merge-commit details | diff audit: the second parent's files listed as changed, diffs opening identical | D06 (decision X1) |
| Don't hide type changes (file ↔ symlink) | diff audit: dropped by both backends | D04 (decision X2) |
| `+N/−M` counts that match Git | Phase 16 candidate 6; the diff audit's root causes 1, 5 and 6 | D05 |
| Take the upstream gix diff fixes | diff audit: rename limit, replacement refs, the Myers fix | D07 (blocked on a gix release) |
| Hand Git-compatibility fixes to gitoxide | diff audit; the maintainer's "gix first" request | D30 |
| Start VS Code's diff algorithm in the engine | Phase 17, slices 17.0 and 17.1; the port itself is a stretch goal | D20, D21, D22 (decision X5) |

**Out of scope:**
- the rest of #31 (the diagnostics report, log-file access, the session
  header), which is not diff work;
- #30 (remotes with no global config);
- Phase 10's code-review state;
- Phase 2's docked-bottom details.

## Slices

Each is one file under this section. `Status` here is the integrator's view,
and the slice file's own `Status:` line is authoritative while it's in
progress. "Parallel group" names slices whose files don't overlap, so they
can run at the same time; slices in the same group with dependencies still
wait for them.

| ID | Slice | Kind | Needs | Parallel group | Status |
| --- | --- | --- | --- | --- | --- |
| D01 | [Log engine hits for diff reads](040-release-1-9-0-the-diff/100-d01-log-engine-hits-for-diff-reads.md) | TS | — | A | integrated 2ddce22 |
| D02 | [Correct stash details on the CLI path](040-release-1-9-0-the-diff/110-d02-correct-stash-details-on-the-cli-path.md) | TS | — | B | integrated c7349b2 |
| D03 | [Diff stashed untracked files from the third parent](040-release-1-9-0-the-diff/120-d03-diff-stashed-untracked-files-from-the-third-parent.md) | TS | D02 | B | ready |
| D04 | [Show type changes in file lists](040-release-1-9-0-the-diff/130-d04-show-type-changes-in-file-lists.md) | TS + Rust | X2 | C | waiting on X2 |
| D05 | [Engine line counts that match Git](040-release-1-9-0-the-diff/140-d05-engine-line-counts-that-match-git.md) | Rust | — | D | integrated 79c5fb4 |
| D06 | [Merge commits against their first parent](040-release-1-9-0-the-diff/150-d06-merge-commits-against-their-first-parent.md) | TS | X1 | C | waiting on X1 |
| D07 | [Upgrade gix for the upstream diff fixes](040-release-1-9-0-the-diff/160-d07-upgrade-gix-for-the-upstream-diff-fixes.md) | Rust | a gix release | D | blocked (external) |
| D10 | [Compare two selected commits](040-release-1-9-0-the-diff/200-d10-compare-two-selected-commits.md) | webview | X3 | E | waiting on X3 |
| D11 | [Resolve a ref for comparison](040-release-1-9-0-the-diff/210-d11-resolve-a-ref-for-comparison.md) | TS | — | F | integrated 70db6f9 |
| D12 | ["Compare with…" dialog](040-release-1-9-0-the-diff/220-d12-compare-with-dialog.md) | webview | D10, D11 | E | waiting on D10, D11 |
| D13 | [Comparison header and swap](040-release-1-9-0-the-diff/230-d13-comparison-header-and-swap.md) | webview | D10 | E | waiting on D10 |
| D14 | [Compare with the working tree](040-release-1-9-0-the-diff/240-d14-compare-with-the-working-tree.md) | TS + webview | D13 | E | waiting on D13 |
| D15 | [Open a comparison in the external diff tool](040-release-1-9-0-the-diff/250-d15-open-a-comparison-in-the-external-diff-tool.md) | TS + webview | X4, D13 | G | waiting on X4 |
| D20 | [Phase 17 legal groundwork](040-release-1-9-0-the-diff/300-d20-phase-17-legal-groundwork.md) | docs | X5, P17-D1, P17-D3 | H | waiting on decisions |
| D21 | [Phase 17 oracle suite](040-release-1-9-0-the-diff/310-d21-phase-17-oracle-suite.md) | TS tests | D20 | H | waiting on D20 |
| D22 | [Phase 17 port sub-slices (stretch)](040-release-1-9-0-the-diff/320-d22-phase-17-port-sub-slices.md) | Rust | D21, X5 | H | stretch |
| D30 | [Upstream gix contributions for Git compatibility](040-release-1-9-0-the-diff/400-d30-upstream-gix-git-compatibility.md) | gix fork | — | U | ready (posting: maintainer) |
| D90 | [Release 1.9.0](040-release-1-9-0-the-diff/900-d90-release-1-9-0.md) | release | every slice in scope | — | maintainer |

**Order, if one agent does everything:** D01, D02, D05 and D11 first (no
decisions needed); then D03; then D10, D13, D12 and D14 once X3 is answered;
then whichever of D04, D06, D15 and D20–D22 the maintainer's decisions
release; then D90.

## Definition of done for 1.9.0

- Every slice in scope is integrated, and each one's report is filled in.
  Stretch slices that aren't done move to the next release with their files.
- On the integration branch: the full gate in order (strict Biome,
  `pnpm run package`, `pnpm run test`, `pnpm run l10n:check` at 100%, fresh
  `pnpm run test:coverage`, `pnpm run sonar:scan` polled to `OK`), the Rust
  arm when `engine/**` changed, and `pnpm run kb:check`.
- Issue #26's two proposals both work: Ctrl/Cmd-select two commits and
  compare them; and "Compare with…" taking a SHA, a tag or a branch.
- No diff read is silent about its backend.
- `CHANGELOG.md` has a `[1.9.0]` section, and the README lists comparison
  among the features.
- The packaged VSIX passes `verify-vsix.yml`.

## Integration log

The integrator appends one dated line per integrated slice or wave: the
commit, the gate results with numbers, and the Sonar task id.

- `2026-10-19` — D11 integrated (`70db6f9`, fast-forward from `diff-1.9.0/d11`; commits `9eebcf3`, `70db6f9`, both `G`). Gates on the result: strict Biome clean on the 5 touched files, typecheck green, tests backend 862/862 and webview 590/590 (the 29 engine-test skips in the slice worktree were the missing built addon there; none skip on the integration branch), `kb:check` green. SonarQube: wave gate, pending.
- `2026-10-19` — D02 integrated (`c7349b2`, rebased from `diff-1.9.0/d02` onto the D11 integration, then fast-forward; commits `1530d0f`, `c7349b2`, both `G`). Gates on the result: strict Biome clean on the 4 touched files, typecheck green, tests backend 866/866 and webview 590/590, `kb:check` green. Noted for D03: through the reader a stash is currently served by the CLI (the multi-parent reroute runs before the engine stash branch). D03 flipped to `ready`. SonarQube: wave gate, pending.
- `2026-10-19` — D05 integrated (`79c5fb4`, rebased from `diff-1.9.0/d05`, then fast-forward; commits `a0917ac`, `79c5fb4`, both `G`). Gates on the result: Rust arm pass (`engine:fmt`, `engine:lint`, `engine:check`, `engine:test` 119 passed), `engine:build` + `engine:smoke` OK (version `1.0.25`, unchanged), typecheck green, tests backend 866/866 (engine halves included, exercising the new counts) and webview 590/590, `kb:check` green. SonarQube: wave gate, pending.
- `2026-10-19` — D01 integrated (`2ddce22`, rebased from `diff-1.9.0/d01`, then fast-forward; commits `88551d0`, `2ddce22`, both `G`). Gates on the result: strict Biome clean on the 4 touched files (including a pre-existing `organizeImports` fix in a touched file, per the KB rule), typecheck green, tests backend 872/872 and webview 590/590, `kb:check` green. SonarQube: wave gate, pending.
