---
summary: >-
  Status table for every phase (audited `2026-07-03`, kept in sync with each
  phase's `Status:` line), then Phase 16, the active phase; open and completed
  phases have their own sections.
always_read: true
---

# Implementation Roadmap

Phase status overview (audited `2026-07-03` after Phase 14 verification;
per-phase `Status:` lines below carry the same verdicts — update both
together):

| Phase | Status |
| --- | --- |
| 0 Guardrails and baseline | Complete |
| 0.5 Backend robustness | Complete |
| 1 UI/UX foundation refresh | Complete |
| 2 Commit details UX | Partial — docked-bottom details mode remains |
| 3 Commit hash display | Complete |
| 4 Find, search, keyboard navigation | Complete |
| 5 Branch, tag, and author filters | Complete |
| 6 Repo settings and view options | Mostly complete — initial-branches-on-load remains |
| 7 Stash management | Complete — actions, stash list panel, and graph stash rows done |
| 8 Comparison and multi-select | Complete in `1.9.0` (`2026-10-20`) — compare-with-HEAD, multi-select, arbitrary two-commit and ref-to-ref comparison ([issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26), D10–D13), working-tree comparison (D14), and external directory diff (D15) done (D90 step 7 move to History pending) |
| 9 Repository and remote management | Mostly complete — remotes-gated fetch, upstream-aware push/pull, remotes CRUD, add/remove repo, full-path tooltips, no-global-config remotes ([issue #30](https://github.com/PlohnenSoftware/git-graph-libre/issues/30), `1.9.0`), and SCM title-bar repo selection ([issue #32](https://github.com/PlohnenSoftware/git-graph-libre/issues/32), `1.9.0`) done; push dialog upstream/`setUpstream` defaults ([issue #36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36)) and repository dropdown ordering preference remain |
| 10 Advanced history, text, integrations | Partial — issue links, config export, archive, commit and tag signature status (Phase 15), staging panel (`1.5.0`), working-tree comparison and external directory diff (`1.9.0`), and copyable diagnostics/logs ([issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31), `1.9.0`) done; text rendering (markdown/emoji, inline body), `.mailmap`, code review, and encoding remain |
| 12 Toolbar dropdown name truncation and find row | Complete |
| 13 Settings hub: tabbed widget, color editor, settings export | Complete |
| 14 Reveal highlight: persistent blink and configurable color | Complete |
| 15 Tag surfaces: signed-tag distinction and remote tag deletion | Complete |
| 16 Rust engine backend | In progress (`2026-10-20`) — 16.1–16.9 shipped in `v1.8.0`; Author Date and the status indicator in `1.8.1`; type changes, numstat parity, gix `0a49d46` upgrade, staged-file export, and diff-read route logging shipped in `1.9.0`; topo seeding, encoding, remote-ref cases, and upstream gix PR posting (D30) open; release 1.10.0 plans the gix 0.90 and Cargo refresh (W01) and the worktree engine slices (W03, W07, W12, W40, W41) |
| 17 VS Code's diff algorithm in the engine | Shipped in `1.9.0` (`2026-10-20`) — 17.0–17.8 via D20–D22 (22a–22j) and the GGL Diff tab D40–D47; 58/58 fixtures exact incl. moves, five-arm parity recorded at 17.6 (git.git, this repo, gitoxide); open: D5's CI WebAssembly wiring and D48's display half |
| 18 Git worktree support | Planned for release 1.10.0 "The Worktrees" (`2026-11-04`, issues [#37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37) and [#38](https://github.com/PlohnenSoftware/git-graph-libre/issues/38)) — full worktree support in slices W02–W04, W10–W12, W20–W23 and W30–W34; engine W03, W07, W12, W40, W41; the release's slices supersede 18.1–18.4 |
| Immediate TODOs bug backlog (BUG-1 … BUG-6, `2026-08-25`) | Complete (`2026-08-25`; see the per-entry implementation records) |

## GitHub Issues Tracker (`gh issue list`, audited `2026-11-04`)

One row per issue. Each open issue's thread, the facts checked and an agent
assessment of every proposal are in its subsection of Open GitHub issues
(Future work); the closed issues' threads are in Closed GitHub issues and
their threads (History). Numbers not listed are pull requests.

| Issue | State | Title | Roadmap Phase / Record | Target / Release |
| --- | --- | --- | --- | --- |
| [#2](https://github.com/PlohnenSoftware/git-graph-libre/issues/2) | Closed | Feature Request: Allow to merge remote branch | History: Pull request review — #4 and #5 | Shipped in `v1.4.2` |
| [#3](https://github.com/PlohnenSoftware/git-graph-libre/issues/3) | Closed | Feature Request: Option for default value of fast-forward | History: Pull request review — #4 and #5 | Shipped in `v1.4.2` |
| [#7](https://github.com/PlohnenSoftware/git-graph-libre/issues/7) | Closed | Does not detect repositories in subfolders | History: Pull request review — #8 and #9 (PR #9) | Shipped in `v1.6.2` |
| [#26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26) | Closed | Feature: Diff two commits | Phase 8; Release 1.9.0 (D10–D13) | Shipped in `v1.9.0` |
| [#30](https://github.com/PlohnenSoftware/git-graph-libre/issues/30) | Closed | Graph shows no remotes (Fetch/Push hidden) when the user has no global Git config file | Phase 9; Release 1.9.0 (D60) | Shipped in `v1.9.0` |
| [#31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31) | Closed | Add copyable diagnostics report, log-file access, and result/decline-cause log entries | Phase 10; Release 1.9.0 (D01, D61–D63) | Shipped in `v1.9.0` (Flatpak/Snap hand testing still open) |
| [#32](https://github.com/PlohnenSoftware/git-graph-libre/issues/32) | Closed | Source Control title-bar button opens the last active repo instead of the clicked repository | Phase 9; History: Source Control title button repository selection | Shipped in `v1.9.0` |
| [#36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36) | **Open** | Updating push dialog box to better align with default git behavior | Phase 9; Issue #36: push dialog default remote and Set upstream | To tackle; release 1.10.0, W25 (`2026-11-04`) |
| [#37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37) | **Open** | Feature Request: Git worktree support | Phase 18; Issue #37: show Git worktrees | To tackle; release 1.10.0, its core (`2026-11-04`) |
| [#38](https://github.com/PlohnenSoftware/git-graph-libre/issues/38) | **Open** | feata: delete worktree | Phase 18; Issue #38: remove a leftover worktree that blocks a branch | To tackle; release 1.10.0, W20 and W21 (`2026-11-04`) |
| [#39](https://github.com/PlohnenSoftware/git-graph-libre/issues/39) | Closed (duplicate of #45) | feat: auto pull from checkout | Issue #45: checking out a remote branch whose local branch exists | Closed `2026-11-02` |
| [#40](https://github.com/PlohnenSoftware/git-graph-libre/issues/40) | **Open** | feat(fetch): auto pull | Phase 9 (proposed); Issue #40: fetch that also updates the current branch | On hold, backlog (`2026-11-04`, a matter of taste) |
| [#41](https://github.com/PlohnenSoftware/git-graph-libre/issues/41) | **Open** | feat(modal/ux): wide selection | Issue #41: whole-row checkbox hit area in dialogs | To tackle; release 1.10.0, W06 (`2026-11-04`) |
| [#42](https://github.com/PlohnenSoftware/git-graph-libre/issues/42) | **Open** | design(icon): lighter | Issue #42: lighter ref badge icons | On hold, backlog (`2026-11-04`, a matter of taste) |
| [#45](https://github.com/PlohnenSoftware/git-graph-libre/issues/45) | **Open** | fix(checkout remote branch): Allow one click switch and pull when checkout on remote branch with existing local is attempted | Phase 9 (proposed); Issue #45: checking out a remote branch whose local branch exists | To tackle; release 1.10.0, W05 (the name bug) and W24 (the feature) (`2026-11-04`) |
