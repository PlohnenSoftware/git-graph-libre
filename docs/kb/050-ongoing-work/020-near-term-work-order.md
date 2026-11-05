---
summary: >-
  Next (`2026-11-04`): release 1.10.0 "The Worktrees" under Ongoing work.
  It brings full Git worktree support, the to-tackle issues (#36, #37, #38,
  #41, #45) and the gix and Cargo refresh, in 27 slices. Their decisions
  Y1, Y3–Y22 are open; W00, W01, W02, W04, W05, W06 and W08 are ready. #40
  and #42 are on hold in the backlog. Then the remaining Phase 2/6/9/10/16/17
  items.
always_read: true
---

# Near-Term Work Order

**Next (`2026-11-04`): release 1.10.0 "The Worktrees".** The maintainer made
worktrees the next release: "full worktree support", not only what the
issues ask. It is to analyze the engine's part, include the to-tackle
issues, and refresh the Cargo dependencies, including gix from GitHub. The
plan is the section Release 1.10.0 — "The Worktrees" under Ongoing work:
- 27 slices in six waves, each with its facts, steps, files and acceptance,
  plus the release slice W90;
- its agent protocol and integrator procedure;
- decisions Y1–Y22, of which only Y2 (gix from GitHub) is answered;
- the Git worktree facts verified on `2026-11-04`, and the engine analysis.

Ready without a decision: W00, W01, W02, W04, W05, W06 and W08. Answering
the decisions releases the rest.

**Issues to tackle (`2026-11-04`), all planned in that release.** The
maintainer's decision of `2026-11-04` on the seven open GitHub issues:

- **To tackle:**
  - #36: push dialog default remote and Set upstream;
  - #37: show Git worktrees;
  - #38: remove a leftover worktree that blocks a branch;
  - #41: whole-row checkbox hit area in dialogs;
  - #45: checking out a remote branch whose local branch exists, including
    `cktgh`'s confirmed bug in the suggested local name.

  All five are planned in release 1.10.0:
  - #36 as W25;
  - #37 as W02–W04, W10–W12 and W30–W33;
  - #38 as W20 and W21;
  - #41 as W06;
  - #45 as W05 and W24.
- **On hold, in the backlog**, as matters of taste: #40 (fetch that also
  updates the current branch) and #42 (lighter ref badge icons).

#38, #40, #41, #42 and #45 were opened by `rbalet` after the `2026-10-27`
audit below, together with #39 (auto pull on checkout), closed on
`2026-11-02` as a duplicate of #45. **How** each is implemented is settled
through the release's decisions (Y-series). Every issue's thread, the facts
checked and the assessment of each option are in Open GitHub issues under
Future work. Small, clearly correct starting points: #45's name bug (W05,
one line with tests) and #41 (W06, one CSS rule).

**Earlier next (`2026-10-27`, post-`1.9.0`):** `v1.9.0` ("The Diff") shipped on
`2026-10-20` (`31e0169`), closing issues `#26`, `#30`, `#31`, and `#32`. Two
new GitHub enhancement issues are open and were acknowledged by the maintainer
on `2026-10-27` for the upcoming release (`1.10.0`, targeted for the first
half of November):

1. **[Issue #36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36)
   (Phase 9) — Push dialog defaults:** pre-select the branch's configured
   upstream remote instead of hardcoded `origin` (with a fallback / default
   remote setting when no upstream is configured), and uncheck **Set upstream**
   (`--set-upstream`) by default.
2. **[Issue #37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37)
   (Phase 18) — Git worktree support:** show which branches and detached
   commits are checked out in which worktrees in the graph, with CLI and
   Rust-engine parity, sibling worktree discovery/switching, and branch-action
   awareness.
3. **Remaining roadmap & post-`1.9.0` items to weigh for `1.10.0`:** D90 step 7
   housekeeping (move the `1.9.0` section to History), Phase 9's repository
   dropdown ordering preference, Phase 6's initial branches on load, Phase 2's
   docked-bottom commit details mode, Phase 10's text/mailmap/encoding items,
   and Phase 16's remaining upstream engine candidates (topo seeding, encoding,
   remote-ref special cases).

**Earlier (`2026-10-18`, shipped `2026-10-20`):** release 1.9.0 "The Diff", under Ongoing work, with
its slices, agent protocol and decisions. It supersedes the diff-related
items below.

**Earlier next (`2026-10-16`), awaiting the maintainer:** what remains of the
upstream engine review's ranked candidates. Landed the same day, each in
its own signed commit on `feat/engine-author-date-status`: config
staleness (`a17048e`, correcting the 16.8 record), tags of trees and blobs
(`7982c4a`), the shallow-clone boundary (`358f8eb`), status counts
(`bcde994`) and the replace-ref decline (`00ce508`) — candidates 1–4 and 8.
Signatures then left the graph load, with the Hidden menu's one-off CLI
reload and engine-failure telemetry, gated the same day (see that record
under Phase 16). Still open, in ranked order: topo seeding (#5, could lift
the `topoOrdering` decline), numstat completeness (#6), encoding handling
(#7) and the remote-ref special cases (#9). Numstat (#6) is now measured
against real history, and its fixes are ranked in "Diff parity against real
history, and a gix Myers fix" (`2026-10-18`) under Phase 16, along with
two CLI stash bugs and the merge question. Each fix needs a parity case,
and taking upstream code also needs the `LICENSE.mit` and
`engine/NOTICE.md` updates. `1.8.1` (Author Date through the engine, the
status indicator) is done and gated; see its record under Phase 16.

**Current priority (`2026-09-22`): Phase 16, the Rust engine backend**, on the
`rusty` branch, which is where `1.7.0` is being assembled. The engine's source
and history are merged under `engine/`, and since 16.3 the extension reads
through it wherever it is available and allowed to; the phase
plan cuts the wiring into slices 16.1–16.9, and **16.1 (a gate for the Rust
side) came first** — nothing else can be verified until `cargo check`,
`cargo test`, `cargo clippy` and `cargo fmt` are part of the documented gate,
because `sonar.sources` and Biome's allowlist both miss `engine/` entirely.
Slice 16.1 is done (`2026-09-22`: `engine:*` scripts, `engine.yml` CI,
`sonar.exclusions`, gate-order docs) and so is 16.2 (local addon build plus
smoke test, debug binary loading with `engineVersion()` `1.0.24`); 16.3 is
done too (the seam, the `backend` setting, `remoteUrl` on the reader with a
parity table, and `view.engineBackend` telemetry); 16.4 is done as well
(`loadRepoInfo` through the reader: engine head/tags/stashes with CLI
fills, parity byte-for-byte, `loadBranches` untouched).
**16.5 (`loadCommits`) is done** (`2026-09-22`: pre-call declines plus
post-call HEAD/unborn reroutes, seam mapping with two gated CLI fills,
`topo` declined over a measured tie-break difference, byte-for-byte parity
with the served flag; the two fills were deleted on `2026-09-23` once the
engine carried tag signatures and symbolic remote HEADs itself, taking
`loadCommits` from `0.8x` to `1.5x`). **16.6 (commit details, comparison, line counts) is
done** (`2026-09-23`: eager whole-list counts fill, merges/`*`/blank/stash
reroutes, file content through the provider with binary CLI fallback,
parity over renames/copies/binary/root/unborn/dirty plus file bytes).
**16.7 (the remaining reads) is done** (`2026-09-23`: the user-config
fill from `config_list` with whole-read rollback, parity over plain,
include-carrying and missing-global cases, every other candidate
declined with its reason recorded). **16.8 (handle lifetime and post-write freshness) is done**
(`2026-09-23`: warm handles proven fresh against external writes by
probe, so no write-time bust — only leak prevention via removal and
deactivation closes, with a no-accumulation test). **16.9
(per-platform packaging) is done** (`2026-09-23`: native-build matrix
for six triples, seven VSIXs — six platform plus the universal
CLI-only fallback — release shape preserved, universal `272.52 KB`
and linux-x64 `37.63 MB` measured, remaining platform sizes pending
the first tag push, which also proves the remote CI matrix).

Maintainer-set priority (`2026-08-25`): **the Immediate TODOs bug backlog below
comes before every phase item.** BUG-1 through BUG-6 were reported against
`v1.3.0` and root-caused the same day; work them in the slice order recorded at
the end of that section. Nothing in the phase list starts until that backlog is
closed or the maintainer explicitly redirects.

**Current priority (`2026-09-09`): the graph/stash UI slices** in the section
below — checkboxes, remote sub-label restyle, stash-list move, graph stash
rows, then the stash-display choice and the create-branch checkout default —
before any other remaining phase item. All six are implemented and committed
on `AIdev`, unpushed, awaiting the release gate.

**Backlog closed `2026-08-25`** — all six entries fixed and gated; per-entry
implementation records with Sonar task ids are in the backlog section below.
Deferred to the maintainer: the BUG-4 tag-graying re-check (path 3, the
signed-vs-unsigned pill tint, is a design question if it still reads as gray),
and the untrusted-workspace observation recorded under BUG-5.

Earlier priorities (`2026-07-03`): Phases 12, 13, and 14 are complete.
Phase 15 (tag surfaces) completed `2026-07-29` and shipped as `v1.1.1`.

1. Run baseline checks on `AI-dev` at the start of the session.
2. Work the Immediate TODOs backlog: BUG-3, then BUG-1 + BUG-6, then BUG-5,
   then BUG-4, then BUG-2. All maintainer decisions are recorded in the entries
   (`2026-08-25`); nothing in the backlog is blocked on an answer.
3. Phases 12, 13, and 14 are complete; see their implementation records.
4. Then continue the remaining partial phases:
   docked-bottom commit details (Phase 2), graph stash rows (Phase 7),
   arbitrary two-commit/ref comparison and external directory diff
   (Phase 8), repository dropdown ordering (Phase 9), text
   rendering/tag signatures/mailmap/encoding (Phase 10).
