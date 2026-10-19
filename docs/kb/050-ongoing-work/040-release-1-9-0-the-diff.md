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

**Status: in progress `2026-10-19` on local `the-diff`; no pushing.
Integrated and Sonar-clean (`OK`, wave gate 3): waves A–D except D44, the
whole comparison wave D10–D15 with its follow-ups, D20/D21, and D30's
preparation. Held for maintainer decisions: D44 (308 changed lines against
its ≤300 budget after an honest simplification pass) and 22a (499 production
lines against ≤300), which pauses the 22b–22j port chain and D45–D48 behind
it. D07 still waits on a gix release. D90, D30's posting and D48's display
half are the maintainer's.**

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
| Compare a commit with the working tree | Phase 10 "uncommitted-changes details and compare-to-commit" | D13F | [Comparison Sonar follow-up](040-release-1-9-0-the-diff/235-d13f-comparison-sonar-follow-up.md) | TS | D13 | E | integrated 8ab0c15 |
| D14 |
| Open a comparison in the user's external diff tool | Phase 8 and Phase 10 "external directory diff" | D15 (decision X4) |
| Say which backend served each diff read, and why the CLI did | [issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31), the diff-read part of its "result/decline-cause log entries" | D01 |
| Correct stash details without the engine | diff audit: the CLI lists stash files 3×, 2× and as deleted | D02, D03 |
| Correct merge-commit details | diff audit: the second parent's files listed as changed, diffs opening identical | D06 (decision X1) |
| Don't hide type changes (file ↔ symlink) | diff audit: dropped by both backends | D04 (decision X2) |
| `+N/−M` counts that match Git | Phase 16 candidate 6; the diff audit's root causes 1, 5 and 6 | D05 |
| Take the upstream gix diff fixes | diff audit: rename limit, replacement refs, the Myers fix | D07 (blocked on a gix release) |
| Hand Git-compatibility fixes to gitoxide | diff audit; the maintainer's "gix first" request | D30 |
| Start VS Code's diff algorithm in the engine | Phase 17, slices 17.0 and 17.1; the full port is committed scope under X5 | D20, D21, D22 (decision X5) |
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
| D04 | [Show type changes in file lists](040-release-1-9-0-the-diff/130-d04-show-type-changes-in-file-lists.md) | TS + Rust | D04a, D04b | C | integrated (D04a a986823, D04b 4fb1eca) |
| D04a | [Type-change transport and counts](040-release-1-9-0-the-diff/132-d04a-type-change-transport-and-counts.md) | TS + Rust | X2 (b) | C | integrated a986823 |
| D04AF | [Engine complexity follow-up](040-release-1-9-0-the-diff/133-d04af-engine-complexity-follow-up.md) | Rust | D04a | C | integrated 8777bc7 |
| D04b | [Type-change presentation and actions](040-release-1-9-0-the-diff/134-d04b-type-change-presentation-and-actions.md) | webview | D04a | C | integrated 4fb1eca |
| D05 | [Engine line counts that match Git](040-release-1-9-0-the-diff/140-d05-engine-line-counts-that-match-git.md) | Rust | — | D | integrated 79c5fb4 |
| D06 | [Merge commits against their first parent](040-release-1-9-0-the-diff/150-d06-merge-commits-against-their-first-parent.md) | TS | X1 | C | integrated f70d006 |
| D07 | [Upgrade gix for the upstream diff fixes](040-release-1-9-0-the-diff/160-d07-upgrade-gix-for-the-upstream-diff-fixes.md) | Rust | a gix release | D | blocked (external) |
| D10 | [Compare two selected commits](040-release-1-9-0-the-diff/200-d10-compare-two-selected-commits.md) | webview | X3 | E | integrated 7dc038b |
| D11 | [Resolve a ref for comparison](040-release-1-9-0-the-diff/210-d11-resolve-a-ref-for-comparison.md) | TS | — | F | integrated 70db6f9 |
| D12 | ["Compare with…" dialog](040-release-1-9-0-the-diff/220-d12-compare-with-dialog.md) | webview | D10, D11 | E | integrated de81fc8 |
| D13 | [Comparison header and swap](040-release-1-9-0-the-diff/230-d13-comparison-header-and-swap.md) | webview | D10 | E | integrated 3df8541 |
| D14 | [Compare with the working tree](040-release-1-9-0-the-diff/240-d14-compare-with-the-working-tree.md) | TS + webview | D13 | E | integrated db87dd6 |
| D14F | [Working-tree comparison Sonar follow-up](040-release-1-9-0-the-diff/245-d14f-working-tree-sonar-follow-up.md) | TS | D14, D15 | E | integrated f5e6e79 |
| D15 | [Open a comparison in the external diff tool](040-release-1-9-0-the-diff/250-d15-open-a-comparison-in-the-external-diff-tool.md) | TS + webview | X4, D13 | G | integrated fa957d6 |
| D20 | [Phase 17 legal groundwork](040-release-1-9-0-the-diff/300-d20-phase-17-legal-groundwork.md) | docs | X5, P17-D1, P17-D3 | H | integrated 55eb184 |
| D21 | [Phase 17 oracle suite](040-release-1-9-0-the-diff/310-d21-phase-17-oracle-suite.md) | TS tests | D20 | H | integrated f0a5458 |
| D22 | [Phase 17 port sub-slices](040-release-1-9-0-the-diff/320-d22-phase-17-port-sub-slices.md) | Rust | D21, X5 | H | 22a done, held on budget (maintainer decision) |
| D30 | [Upstream gix contributions for Git compatibility](040-release-1-9-0-the-diff/400-d30-upstream-gix-git-compatibility.md) | gix fork | — | U | preparation integrated cb5fe70 (posting: maintainer) |
| D40 | [Vendor the diff editor's stylesheet](040-release-1-9-0-the-diff/500-d40-vendor-the-diff-editor-stylesheet.md) | CSS, notices | — | I | integrated bfa769e |
| D41 | [The diff row model](040-release-1-9-0-the-diff/510-d41-the-diff-row-model.md) | TS | — | I | integrated 01deb86 |
| D41F | [Row-model Sonar follow-up](040-release-1-9-0-the-diff/515-d41f-row-model-sonar-follow-up.md) | TS | D41 | I | integrated 8407eb5 |
| D42F | [View Sonar follow-up](040-release-1-9-0-the-diff/525-d42f-view-sonar-follow-up.md) | TS | D42 | I | integrated 6d72d31 |
| D42 | [The diff view](040-release-1-9-0-the-diff/520-d42-the-diff-view.md) | webview | D40, D41 | J | integrated 1593f4e |
| D43 | [Engine export for the staged copy of a file](040-release-1-9-0-the-diff/530-d43-engine-export-for-the-staged-copy-of-a-file.md) | Rust + TS | — | I | integrated 14ac021 |
| D43F | [Staged-file Error follow-up](040-release-1-9-0-the-diff/535-d43f-staged-file-error-follow-up.md) | TS | D43 | I | integrated 7d07111 |
| D44 | [The GGL Diff tab](040-release-1-9-0-the-diff/540-d44-the-ggl-diff-tab.md) | TS + webview | D42 | J | done 940d88b, held on budget (308/300, maintainer decision) |
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
no entry point, so they can be integrated before the port exists. The maintainer committed the full port to 1.9.0 under X5 on `2026-10-19`;
22j and its dependent tab slices remain required unless the maintainer
explicitly changes that scope.

## Definition of done for 1.9.0

- Every slice in scope is integrated, and each one's report is filled in.
  The full port is required under X5; only the maintainer may defer scope.
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
- `2026-10-19` — D06 integrated (`f70d006`, rebased from `diff-1.9.0/d06`, then fast-forward; commits `aea4ce9`, `ef5479e`, `f70d006`, all `G`). Gates on the result: strict Biome clean, typecheck green, tests backend 887/887 and webview 623/623, `l10n:check` 100%, `kb:check` green. Follow-ups from its report, not folded in: a muted CSS rule for `.commitDetailsFirstParentNote` (no stylesheet was in *Touch*), and the note also shows for stashes and merge-commit comparisons until a marker is threaded through (D13 touches that surface). SonarQube: wave gate.

- `2026-10-19` — Resumed audit on `d759ff4`: all 38 local release commits verify `G`; remote refs fetched, no remote main commits missing. Pending-wave gates: strict Biome 20 touched files, package (296 linted files), backend 887/887, webview 623/623, l10n 100% (615 bundle / 114 package keys), Rust arm 122 tests plus 1 doc test, fresh coverage 1510/1510 at 93.02% lines (7717/8296). Sonar task `3937ac5c-5eb7-4a9a-919c-189ef84c57a2`, analysis `df0e804e-9460-418b-9d3c-47996db0a289`: **ERROR** (new coverage 93.6%, duplication 0.0%, 4 findings: D41 complexity 18 and 20 versus 16 plus last-element access; D43 S6671 on typed child-process rejection). Maintainer explicitly approved separate D41F/D43F repairs, D04's two-part T scope, reassignment of unfinished D10/D20 worktrees, and release source/coverage uploads to the configured Sonar server. No slice commit precedes its integrator-run coverage/Sonar OK.

- `2026-10-19` — Maintainer clarified gate timing: delegated slices and sub-slices may make frequent signed commits after focused checks; the full gate belongs to integration or work without multi-agent delegation. Updated standing rules and agent protocol; all other safety, signing, scope and quality requirements remain. This supersedes the earlier pre-commit slice hold recorded above. D04a Touch also corrects the omitted engine/package.json version-only update required by the already-approved synchronized engine version bump.
- `2026-10-19` — **Integrator handover.** Codex, the previous integrator, stopped on its usage quota at `24582b8`, leaving four finished slices uncommitted in their worktrees (D10, D20 and D42, plus D43F's report) under the hold its last audit line describes, which the maintainer's gate-timing rule had just superseded. Claude Code took over as integrator at the maintainer's request: it backed the changes up, reran focused checks in each worktree, committed each slice's work and report as signed commits on its own branch, and integrated them below. Two departures from this procedure are on record as found: `24582b8` merged `diff-1.9.0/d43f` instead of fast-forwarding, and `efe46ee` carries the one-word subject "fix" (the gate-timing rule change and D04/D41F/D43F slice edits). Both are left as they are; rewriting them would rewrite the integration branch. D04a's worktree holds only Codex's claim from 02:10, with no work; it is released for reassignment.
- `2026-10-19` — D43F integrated (`7d07111`, rebased from `diff-1.9.0/d43f`, then fast-forward; its code commit `8dce59c` was already in through `24582b8`). D20 integrated (`55eb184`; commits `6acde42`, `55eb184`, both `G`). D42 integrated (`1593f4e`; commits `8cfd940`, `1593f4e`, both `G`). D10 integrated (`7dc038b`; commits `a6ec1d7`, `7dc038b`, both `G`). All four rebased without conflicts. Gates on the combined result: strict Biome clean on the 14 touched code, locale and test files, `pnpm run package` OK, tests backend 887/887 and webview 644/644, `l10n:check` 100%, `kb:check` green; the linux-x64 addon was current (built after D43's engine change). D12, D13, D21 and D44 flipped to `ready`. SonarQube: wave gate, after D41F, which the last audit's D41 findings need.
- `2026-10-19` — D41F integrated (`8407eb5`, rebased from `diff-1.9.0/d41f`, then fast-forward; commits `2c012f1`, `8407eb5`, both `G`; dispatched on Opus, before the maintainer's model rule). Its report verifies the new cognitive-complexity scores with the cached SonarJS rule: highest 8 in the touched functions.
- `2026-10-19` — **Wave gate** (D10, D20, D42, D43F, D41F; HEAD `8407eb5`): strict Biome clean, `pnpm run package` OK, `l10n:check` 100%, fresh `pnpm run test:coverage` 1532/1532 tests in 140 files at 93.26% lines (7879/8448). SonarQube task `ec93864e-596f-463e-9bd6-d73f89f38dfc`, analysis `6717d946-4c8f-4566-94a5-adc43fbe66e0`: gate **ERROR** on one condition, 2 new high-severity issues (limit 0); new coverage 94.3%, duplication 0.0%, 4 new issues (limit 5). The D41 and D43 findings from the previous scan are closed. All four new issues are in D42's `src/webview/diffTab/view.ts`, which the previous scan predated: two `S7761` (`.dataset`, high), one `S3358` (nested ternary) and one `S7755` (`.at(-1)`). Opened D42F for them, as with D41F and D43F, dispatched on Haiku as an easy slice under the maintainer's model rule.
- `2026-10-19` — **10:30 recovery audit (Muse integrator).** Integration `the-diff` clean at `671c2c8`; all slice worktrees inventoried. The interrupted 08:03 Muse instance (session `01a152c1…`) made no edits — its log shows only KB reads and inventory before cancellation, so nothing was lost. Claude's committed work was already integrated through `1cc6b67`; its four in-flight worktrees (D04a, D13, D21, D44) hold uncommitted work untouched since ~02:28 with no live owner process, so each was reassigned in place under the maintainer's recovery authorization, plus a fresh D42F worktree. Model-selection constraint, recorded honestly: this runtime's sub-agent dispatch offers `general-purpose` agents on the inherited model only — no Haiku/Sonnet/Opus selector exists here — so the maintainer's cheapest-first tiers could not be applied; every dispatch below is general-purpose on the inherited model, noted again in each slice report. D12 waits for D13 (both touch `src/webview/main.ts` and the l10n bundles).
- `2026-10-19` — D42F integrated (`6d72d31`, fast-forward from `diff-1.9.0/d42f`; commits `a9013cb`, `6d72d31`, both `G`). Gates on the result: strict Biome clean on the touched file, typecheck green, full test suite green (webview 645/645; backend green in the same run), `kb:check` green. SonarQube: next wave gate confirms the four `view.ts` findings are gone.
- `2026-10-19` — D44 finished in its worktree (`9e67ccc`, all `G`) but is **held from integration**: 334 changed lines outside tests against its ≤300 budget (+34; TypeScript + build 289, the five mandated l10n bundles 45). Acceptance checks pass per its report. Per the integrator procedure the overrun needs a maintainer decision (accept, or trim/split); D45 also needs 22j, so nothing downstream is blocked today. Worktree left intact.
- `2026-10-19` — D04a integrated (`a986823`, rebased from `diff-1.9.0/d04a`, then fast-forward; commits `02b1147`, `0316c0e`, `a986823`, all `G`). The previous agent's uncommitted Rust was preserved, verified and committed first by the reassigned agent. Gates on the result: Rust arm pass (123 tests), `engine:build` + `engine:smoke` OK at 1.0.26, strict Biome clean on 11 touched files, typecheck green, tests backend 892/892 and webview 645/645, `kb:check` green. 162 changed lines outside tests against the 250 budget. D04b flipped to `ready`. SonarQube: wave gate.
- `2026-10-19` — D13 integrated (`3df8541`, rebased from `diff-1.9.0/d13`, then fast-forward; commits `59dc0ad`, `3df8541`, both `G`). Gates on the result: strict Biome clean on 12 touched files, typecheck green, tests backend 892/892 (the worktree's 31 missing-addon skips cleared) and webview 655/655, `l10n:check` 100%, `kb:check` green; headless light/dark renders in its report. 190 changed lines outside tests against the 200 budget. Its three in-Touch interpretation choices are recorded in the report for maintainer review (labels travel as refs for file diffs; Swap uses the existing `sync` glyph until D04b generates `arrow-switch`; the stash first-parent note remains open). D14 and D15 flipped to `ready`. SonarQube: wave gate.
- `2026-10-19` — D21 integrated (`f0a5458`, rebased from `diff-1.9.0/d21`, then fast-forward; commits `b82f603`, `ebcd42d`, `f0a5458`, all `G`). Fixtures verified byte-for-byte against `microsoft/vscode` `28a5623`. Gates on the result: strict Biome clean, typecheck green, tests backend 953/953 (61 new oracle tests; no skips with the addon built) and webview 655/655, `kb:check` green. Measured result for Phase 17: TypeScript = expected 58/58, WebAssembly = expected 56/58 (`noisy-move1`, `ts-example1` pinned in the allowlist) — the package's two backends do not always agree at `0.0.2-87`. D22 flipped to `ready`. SonarQube: wave gate.
- `2026-10-19` — **Wave gate** (D42F, D04a, D13, D21; HEAD `723e030`): strict Biome clean per slice, `pnpm run package` OK, `l10n:check` 100%, fresh `pnpm run test:coverage` 1608/1608 tests in 142 files at 93.30% lines (7905/8473). SonarQube task `58119b7f-49e5-4817-a694-3900d912ec22`, analysis `a86769fe-5852-4332-8281-a9aff7766380`: gate **ERROR** on one condition (1 new high issue, limit 0); new coverage 94.3%, duplication 0.0%, 3 new issues (limit 5), 0 new hotspots. D42F's four `view.ts` findings are closed. The three new issues: `rust:S3776` in D04a's `diff.rs` (complexity 17 vs 16 — the high one), `typescript:S2234` and `S6582` in D13's `main.ts` swap code. Opened D04AF and D13F for them, as with the earlier follow-ups; D13F dispatches after D12 integrates (shared `main.ts`).
- `2026-10-19` — D04b integrated (`4fb1eca`, rebased from `diff-1.9.0/d04b`, then fast-forward; commits `dd65541`, `c8e66d0`, `4fb1eca`, all `G`), completing D04 beside D04a. Gates on the result: strict Biome clean, typecheck green, tests backend 953/953 and webview 661/661, `l10n:check` 100%, `kb:check` green; 54 changed lines outside tests against the 180 budget; light/dark renders in its report. Follow-up noted there: D13's Swap still uses the `sync` glyph now that `arrow-switch` exists (one line, outside D04b's scope). SonarQube: next wave gate.
- `2026-10-19` — 22a finished in its worktree (`42c13da`, all `G`; Rust arm green, 11/11 new unit tests) but is **held from integration**: 499 production lines against the sub-slice's ≤300 budget (827 file lines with the mandatory legal headers and unit tests). Its report argues the named scope cannot fit 300 and offers a split (move `fixture.rs` to 22f), which alone still leaves ~368 production lines. Maintainer decision needed: accept the overrun, re-cut 22a, or adjust the D22 budgets. The 22b+ chain waits on that call; the workspace `license = "MIT"` question its report raises is also the maintainer's (the new crate locally declares `AGPL-3.0-or-later AND MIT`). Worktree left intact.
- `2026-10-19` — D04AF integrated (`8777bc7`, rebased, then fast-forward; commits `b9801c8`, `8777bc7`, both `G`). Gates on the result: Rust arm pass (123 tests), build + smoke OK at 1.0.26 (no bump; behavior verbatim), backend parity/details 44/44 against the rebuilt addon, `kb:check` green. Sonar confirmation at the next wave gate.
- `2026-10-19` — D12 integrated (`de81fc8`, rebased clean over D21/D04b, then fast-forward; commits `b46387e`, `de81fc8`, both `G`), completing issue #26's second proposal. Gates on the result: strict Biome clean on 12 files, typecheck green, tests backend 953/953 and webview 673/673, `l10n:check` 100%, `kb:check` green; 157 changed lines outside tests against the 220 budget; renders in its report. Recorded deviations for maintainer review: a native `<datalist>` instead of a typed suggestion input (needs `global.d.ts`, outside *Touch*), D13 labels on the comparison call, and one +1-line test file outside *Touch* (the exact remote-branch menu list; no assertion weakened — accepted under the protocol's test-file allowance). D13F now dispatchable. SonarQube: next wave gate.
- `2026-10-19` — D13F integrated (`8ab0c15`, fast-forward; commits `557234e`, `4271aff`, `8ab0c15`, all `G`). Gates on the result: strict Biome clean, typecheck green, `commitDetailsView` webview suite 22/22, `kb:check` green. The swap exchange is now named (`swappedBaseRef`/`swappedCompareRef`), behavior unchanged. Sonar confirmation at the next wave gate.
- `2026-10-19` — D14 integrated (`db87dd6`, rebased clean over D13F, then fast-forward; commits `82c298c`, `db87dd6`, both `G`). Gates on the result: strict Biome clean on 12 files, typecheck green, tests backend 957/957 and webview 678/678, `l10n:check` 100%, `kb:check` green; 105 changed lines outside tests against the 220 budget. Its three in-*Touch* choices (post-D04 `AMDRT` filter kept, the swapped `*` side via `git diff -R`, `*` pinned instead of its display label) are recorded in its report; per-file revision actions inside a working-tree comparison remain a noted follow-up. SonarQube: next wave gate.
- `2026-10-19` — **Wave gate 2** (D04b, D04AF, D12, D13F, D14; HEAD `4347f05`): `pnpm run package` OK, fresh `pnpm run test:coverage` 1635/1635 tests in 143 files at 93.38% lines (7987/8553). SonarQube task `508c4210-3224-4127-8b75-d44da9883d4d`, analysis `2671be4c-0a5c-4621-bfdf-18f32f392fff`: gate **ERROR** on two conditions (1 new high issue; 6 new violations, limit 5); new coverage 94.3%, duplication 0.0%, 0 hotspots. D04AF's `diff.rs` S3776 and D13F's two findings are closed. The six new issues are all in D12/D14 comparison code: `S3776` complexity 32 in `messageHandler.ts`, nested ternaries there and in `commitComparison.ts`, two nested template literals, one `S6582` in `main.ts`. Opened D14F for them; it dispatches after D15 (shared files).
- `2026-10-19` — D15 integrated (`fa957d6`, rebased, then fast-forward; commits `7186335`, `8764d97`, `fa957d6`, all `G`). Gates on the result: strict Biome clean on 9 files, typecheck green, tests backend 965/965 and webview 682/682, `l10n:check` 100%, `kb:check` green; 196 changed lines outside tests against the 200 budget; an end-to-end detached `git difftool --dir-diff` against a fake tool and light/dark renders are recorded in its report. Its four in-*Touch* choices (launch-time configured check, full-hash resolution before spawn, `*`-base rejected because Git's `-R` dir-diff fails, shared Swap styling with a split click class) are recorded for maintainer review. Wave E–G is complete: D10–D15 all integrated. SonarQube: D14F, then the confirming wave gate.
- `2026-10-19` — D14F integrated (`f5e6e79`, fast-forward; commits `ac21845`, `5dec1aa`, `f5e6e79`, all `G`; 135 changed lines outside tests against the 150 budget, no test changed).
- `2026-10-19` — **Wave gate 3** (D15, D14F; HEAD `f5e6e79`): strict Biome clean, `pnpm run package` OK, `l10n:check` 100%, fresh `pnpm run test:coverage` 1647/1647 tests in 144 files at 93.29% lines (8028/8605), `kb:check` green. SonarQube task `f4808462-1988-4a35-8371-29ab238a4d85`, analysis `557944f9-74c4-4a9b-8003-c980923e7897`: gate **OK** on all seven reported conditions — new coverage 93.9%, duplication 0.0%, 0 new violations, 0 high issues, 0 new hotspots. Wave gate 2's six findings are closed; the integration branch is Sonar-clean again.
- `2026-10-19` — D30 preparation integrated (`cb5fe70`, rebased, then fast-forward; the agent's idle session was cancelled by the integrator only after its deliverable was fully committed and all three worktrees stood clean for ~50 minutes — nothing was lost). In the `../gix` fork, all `G`, nothing pushed: 30b on `feat/gix-diff-numstat-line-counts` (`07abe3f43`, `0fa7e82df`; +159/−1) and 30c's doc fix on `fix/gix-diff-rewrites-track-empty-default` (`b75d6f419`); 30d is a discussion draft only. The integrator independently reran `cargo test -p gix-diff` (102 passed) and the two `line_counts` tests against the recorded `git diff --numstat` values (passed); `just`/`cargo-nextest` are absent on this machine, so gitoxide's full `just test` was not run — recorded in the report. Posting 30a–30d stays the maintainer's.
- `2026-10-19` — D44 budget follow-up: a genuine simplification pass (`7643558`, `940d88b`, both `G`) took the slice from 334 to **308 changed lines outside tests** (same numstat method, verified by the integrator), tests and bundle sizes identical. Its addendum prices every remaining lever and shows 300 is reachable only by two deliberate typing regressions, so the slice stays `blocked` for the maintainer: accept 308, split it, or direct one of the priced options. Worktree intact at `940d88b`.
- `2026-10-19` — **10:30-run handoff (Muse integrator).** `the-diff` ends this run Sonar-`OK` with every dispatchable slice integrated (see the status note above and the table). Decisions only the maintainer can make, in the order they unblock work: (1) D44 at 308/300; (2) 22a at 499/300 — accept, re-cut, or adjust the D22 budgets — plus the engine workspace `license = "MIT"` field its report raises (the new crate declares `AGPL-3.0-or-later AND MIT` locally); (3) the recorded interpretation choices in D13's, D12's, D14's and D15's reports (labels-as-refs, datalist, swapped-`*` handling, launch-time configured check, `diff.guitool` precedence) and D04b's open one-line `sync`→`arrow-switch` glyph swap for D13's Swap button; (4) post D30a–d from the prepared branches/drafts. Claude-session recovery note: Claude's work was recovered from Git and the worktrees (complete); its session transcript (`5f80f5de-…`, last written 03:38) was identified but not read — this runtime requires the maintainer to select the exact session before any transcript is opened, and nothing in the recovery depended on it. The Codex processes from 01:51 in the main checkout were left untouched (idle; the checkout stayed clean). All worktrees are intact; nothing was pushed.
