---
summary: >-
  Next release, planned `2026-10-18`: 1.9.0 "The Diff". Gathers every
  diff-related item into small, self-contained slices for one or many
  agents: issue #26 (compare any two commits), the diff-read part of issue
  #31, Phase 8's and Phase 10's comparison items, the bugs found by the
  diff-parity audit, the engine's numstat fixes, Phase 17's first slices,
  and the GGL Diff tab (Phase 17 D4, wave D). Holds the goals, the slice table, the dependencies and the
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
| A light "GGL Diff" tab that looks like the diff editor, opened from Source Control and commit details, fed by the engine | the maintainer's request and Phase 17 D4 = G4 (c), `2026-10-19` | D40–D48; D45 onward need the port's 22j |

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
| D03 | [Diff stashed untracked files from the third parent](040-release-1-9-0-the-diff/120-d03-diff-stashed-untracked-files-from-the-third-parent.md) | TS | D02 | B | integrated 221e98c |
| D04 | [Show type changes in file lists](040-release-1-9-0-the-diff/130-d04-show-type-changes-in-file-lists.md) | TS + Rust | X2 | C | waiting on re-scope for X2 (b) |
| D05 | [Engine line counts that match Git](040-release-1-9-0-the-diff/140-d05-engine-line-counts-that-match-git.md) | Rust | — | D | integrated 79c5fb4 |
| D06 | [Merge commits against their first parent](040-release-1-9-0-the-diff/150-d06-merge-commits-against-their-first-parent.md) | TS | X1 | C | ready |
| D07 | [Upgrade gix for the upstream diff fixes](040-release-1-9-0-the-diff/160-d07-upgrade-gix-for-the-upstream-diff-fixes.md) | Rust | a gix release | D | blocked (external) |
| D10 | [Compare two selected commits](040-release-1-9-0-the-diff/200-d10-compare-two-selected-commits.md) | webview | X3 | E | ready |
| D11 | [Resolve a ref for comparison](040-release-1-9-0-the-diff/210-d11-resolve-a-ref-for-comparison.md) | TS | — | F | integrated 70db6f9 |
| D12 | ["Compare with…" dialog](040-release-1-9-0-the-diff/220-d12-compare-with-dialog.md) | webview | D10, D11 | E | waiting on D10, D11 |
| D13 | [Comparison header and swap](040-release-1-9-0-the-diff/230-d13-comparison-header-and-swap.md) | webview | D10 | E | waiting on D10 |
| D14 | [Compare with the working tree](040-release-1-9-0-the-diff/240-d14-compare-with-the-working-tree.md) | TS + webview | D13 | E | waiting on D13 |
| D15 | [Open a comparison in the external diff tool](040-release-1-9-0-the-diff/250-d15-open-a-comparison-in-the-external-diff-tool.md) | TS + webview | X4, D13 | G | waiting on D13 |
| D20 | [Phase 17 legal groundwork](040-release-1-9-0-the-diff/300-d20-phase-17-legal-groundwork.md) | docs | X5, P17-D1, P17-D3 | H | ready |
| D21 | [Phase 17 oracle suite](040-release-1-9-0-the-diff/310-d21-phase-17-oracle-suite.md) | TS tests | D20 | H | waiting on D20 |
| D22 | [Phase 17 port sub-slices (stretch)](040-release-1-9-0-the-diff/320-d22-phase-17-port-sub-slices.md) | Rust | D21, X5 | H | waiting on D21 |
| D30 | [Upstream gix contributions for Git compatibility](040-release-1-9-0-the-diff/400-d30-upstream-gix-git-compatibility.md) | gix fork | — | U | ready (posting: maintainer) |
| D40 | [Vendor the diff editor's stylesheet](040-release-1-9-0-the-diff/500-d40-vendor-the-diff-editor-stylesheet.md) | CSS, notices | — | I | integrated bfa769e |
| D41 | [The diff row model](040-release-1-9-0-the-diff/510-d41-the-diff-row-model.md) | TS | — | I | integrated 01deb86 |
| D42 | [The diff view](040-release-1-9-0-the-diff/520-d42-the-diff-view.md) | webview | D40, D41 | J | ready |
| D43 | [Engine export for the staged copy of a file](040-release-1-9-0-the-diff/530-d43-engine-export-for-the-staged-copy-of-a-file.md) | Rust + TS | — | I | integrated 14ac021 |
| D44 | [The GGL Diff tab](040-release-1-9-0-the-diff/540-d44-the-ggl-diff-tab.md) | TS + webview | D42 | J | waiting on D42 |
| D45 | [Feed the tab from the engine](040-release-1-9-0-the-diff/550-d45-feed-the-tab-from-the-engine.md) | TS | D43, D44, 22j | J | waiting on D43, D44, 22j |
| D46 | [Open the tab from Source Control](040-release-1-9-0-the-diff/560-d46-open-the-tab-from-source-control.md) | manifest + TS | D45 | K | waiting on D45 |
| D47 | [Open the tab from commit details](040-release-1-9-0-the-diff/570-d47-open-the-tab-from-commit-details.md) | webview + TS | D45 | L | waiting on D45 |
| D48 | [Measure the tab against the diff editor](040-release-1-9-0-the-diff/580-d48-measure-the-tab-against-the-diff-editor.md) | measurement | D46, D47 | — | waiting on D46, D47 (display half: maintainer) |
| D90 | [Release 1.9.0](040-release-1-9-0-the-diff/900-d90-release-1-9-0.md) | release | every slice in scope | — | maintainer |

**Order, if one agent does everything:** D01, D02, D05 and D11 first (no
decisions needed); then D03; then D10, D13, D12 and D14 once X3 is answered;
then whichever of D04, D06, D15 and D20–D22 the maintainer's decisions
release; then D90.

**Wave D, the GGL Diff tab:** D40, D41 and D43 can start now and run in
parallel. Then D42, then D44. D45 waits for the port's 22j as well, and
D46 and D47 wait for D45 (they share `package.json` and the `l10n`
bundles, so run them one after the other). D48 comes last. D40–D44 add
no entry point, so they can be integrated before the port exists. If 22j
misses 1.9.0, D45–D48 move to the next release with it, and the
maintainer decides whether D40–D44 ship unreached or wait too.

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
- `2026-10-19` — **Wave 1 gate** (D01, D02, D05, D11; HEAD `d53ebc1` before this line): `pnpm run package` OK, `pnpm run l10n:check` 100%, `pnpm run test:coverage` 1462/1462 tests with 93.0% line coverage (lcov), Rust arm 119 passed, `kb:index`/`kb:check`/`kb:graph` done. SonarQube scan task `24ff45da-c433-4832-9198-96a209a83ada`, analysis `ab215159-0c8a-4d0a-8ba0-b65becde1713`: gate **ERROR**, but not from this wave — all 5 new-code issues sit in `docs/kb/housekeeping.mjs` and `docs/kb/graphify.mjs` from the integration base (`cba7ca6`, before wave 1; mostly `S7780`/`S7758`, plus one `S3776` complexity 16>15), while every wave-1 file reports 0 open issues and new coverage is 93.9%. Recorded as pre-existing per the protocol; needs a maintainer-approved cleanup outside any slice before D90 can require `OK`.
- `2026-10-19` — D03 integrated (`221e98c`, rebased from `diff-1.9.0/d03` — one test-file conflict where D01 and D03 both appended to `reader.test.ts`, resolved by keeping both tests — then fast-forward; commits `0f92df1`, `221e98c`, both `G`). Gates on the result: strict Biome clean on the 10 touched files, typecheck green, tests backend 873/873 and webview 591/591, `kb:check` green. The slice's one deviation (stash lookup moved above the multi-parent reroute, inside *Touch*) is documented in its report. SonarQube: next wave gate.
- `2026-10-19` — SonarQube rescan after the maintainer's kb-script fixes and gate adjustments (task `d7e1c5c8-48aa-4353-bb2b-5077027d0490`, analysis `1ff085ac-04e1-4af1-8597-538cc2107e12`, HEAD `d094e80`): gate **OK**, 0 new-code issues, fresh coverage 1464/1464 tests at 93.0% lines. The wave-1 ERROR above is closed.
- `2026-10-19` — D43 integrated (`14ac021`, fast-forward from `diff-1.9.0/d43`; commits `2310f3c`, `81a1d11`, `14ac021`, all `G`). Gates on the result: Rust arm pass (122 tests), `engine:build` + `engine:smoke` OK (version `1.0.25`, unchanged by design), strict Biome clean, typecheck green, tests backend 883/883 and webview 591/591, `kb:check` green. SonarQube: wave gate.
- `2026-10-19` — D41 integrated (`01deb86`, rebased from `diff-1.9.0/d41`, then fast-forward; commits `de51c98`, `01deb86`, both `G`). Gates on the result: strict Biome clean, typecheck green, tests backend 883/883 and webview 618/618, `kb:check` green. For D42: `expandCollapsed` works on the row objects `buildRows` returned, not on serialized copies (see D41's report). SonarQube: wave gate.
- `2026-10-19` — D40 integrated (`bfa769e`, rebased from `diff-1.9.0/d40`, then fast-forward; commits `ecf22d2`, `bfa769e`, both `G`). Gates on the result: strict Biome clean, typecheck green, tests backend 883/883 and webview 622/622, `kb:check` green; `vsce ls --no-dependencies` lists the new CSS and notices (in the slice report). The vendored stylesheet records `microsoft/vscode` `1356222` as its MIT source. D42 flipped to `ready`. SonarQube: wave gate.
