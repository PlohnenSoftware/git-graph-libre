---
summary: >-
  Next release, planned `2026-11-04`: 1.10.0 "The Worktrees", mainly full Git
  worktree support. It shows where each branch is checked out (issue #37)
  and other worktrees' detached HEADs. It lists, creates, opens, switches,
  locks, moves, removes, prunes and repairs worktrees (#38), with
  worktree-aware branch actions, the dropdown and discovery, and refresh and
  config fixes. Engine work: gix 0.90 from GitHub plus the Cargo refresh, a
  worktree listing with parity, every read proven on linked worktrees, and
  the trust gate. It also includes #36, #41 and #45, and #46 by landing
  `rbalet`'s PR #47 (W26, added `2026-11-05`). It holds the goals, the 28
  slices in six waves, plus the release slice W90, the order and the
  definition of done.
---

# Release 1.10.0 — "The Worktrees"

**Status: planned `2026-11-04`; in progress since `2026-11-05`** (wave A dispatched, see the Integration log). The maintainer asked for full
worktree support, with the engine's part analyzed and the open issues to
tackle included. #40 and #42 are on hold in the backlog. Name and version are
decision Y21. Only decision Y2 is answered. The slices that need no decision
are ready: W00, W01, W02, W04, W05, W06 and W08.

**Added `2026-11-05`: issue #46 and PR #47.** The maintainer added
`rbalet`'s issue #46 (show which remotes hold a tag) to this release, with
the draft PR #47 that implements it (one commit, `a109e9a`). It is W26, a
review-and-land slice: the integrator merges the PR unchanged with a merge
commit (Y24), and W26F adds the setting that Y23 asks for. `a109e9a` is also the model for
the standing rule Closing issues from commits, which this release follows.

Everything about worktrees, in one release: what users asked for (#37, #38),
what the code turned out to get wrong today (W04, W07, W08), what "full
support" means beyond the issues, and the engine's share. The work is cut
into slices small enough for one agent session each, with their facts,
steps, files and acceptance spelled out. Any agent taking a slice follows
the Agent protocol for release 1.10.0, which applies 1.9.0's with
worktree-specific rules. The facts every slice relies on are in two records
beneath this section: Git worktree behavior, verified (`2026-11-04`), and
Engine changes for worktrees (`2026-11-04`).

**One rule across all slices.** Git is the authority on worktrees:
- the list comes from `git worktree list`, or from the engine's twin, which
  is proven equal to it;
- every worktree write runs on the CLI;
- no decision parses Git's translated messages;
- nothing deletes local work, or overrides a lock, without a confirmation
  that names what is lost;
- a removed or moved worktree's engine handle is closed.

## Goals and where they come from

| Goal | Source | Slices |
| --- | --- | --- |
| Current dependencies: gix 0.90 from gitoxide `main` on GitHub, every registry crate refreshed | the maintainer's request, `2026-11-04` (Y2) | W01 |
| See which branch is checked out in which worktree | [issue #37](https://github.com/PlohnenSoftware/git-graph-libre/issues/37); Phase 18's slices 18.1–18.2 | W02, W03, W10, W11 |
| See other worktrees' detached HEADs, which the graph never draws today | the TypeScript worktree map (the log starts from `HEAD --branches`) | W12 |
| A graph on a linked worktree refreshes, and every graph notices other worktrees change | a bug found `2026-11-04`: the watcher only knows `<repo>/.git/…` | W04 |
| A linked worktree's local config is read from the right file | a parity bug found `2026-11-04`, on both backends | W07 |
| Branch actions Git refuses are explained before they run, with the right alternative | Phase 18's slice 18.4; issue #38 | W20 |
| Free a branch blocked by a leftover worktree, without forcing silently: remove, remove stale, repair moved, prune | [issue #38](https://github.com/PlohnenSoftware/git-graph-libre/issues/38) | W21 |
| Create, lock, unlock and move worktrees | full worktree support | W22, W23 |
| One place to see and manage worktrees; open one, or switch the graph to it | full worktree support; Phase 18's slice 18.3 | W30, W31 |
| A repository's worktrees appear together in the dropdown, including nested, outside-workspace and bare-clone layouts | full worktree support; the TypeScript worktree map | W32, W33 |
| A new linked worktree starts with the repository's settings | full worktree support | W34 |
| Every engine read is correct on a linked worktree, and the engine never serves a repository Git refuses | Engine changes for worktrees; the deferred trust slice | W40, W41 |
| A remote checkout never ends in "a branch named … already exists" | [issue #45](https://github.com/PlohnenSoftware/git-graph-libre/issues/45) and its duplicate #39 | W05, W24 |
| The Push dialog starts from what plain `git push` would do | [issue #36](https://github.com/PlohnenSoftware/git-graph-libre/issues/36) | W25 |
| A dialog checkbox toggles from anywhere on its row | [issue #41](https://github.com/PlohnenSoftware/git-graph-libre/issues/41) | W06 |
| A tag badge says which remotes hold the tag | [issue #46](https://github.com/PlohnenSoftware/git-graph-libre/issues/46), implemented by `rbalet`'s [PR #47](https://github.com/PlohnenSoftware/git-graph-libre/pull/47) (`a109e9a`); Y23, Y24 | W26 |
| Telemetry counts nested worktrees correctly, and learns whether worktree features are used | the `view.submoduleRepo*` heuristic; Y19 | W08, W50 |
| Know whether another worktree has local changes | full worktree support; Y20 | W51 |
| Ongoing work holds only what is in progress | D90 — Release 1.9.0, step 7 | W00 |

**Out of scope:**
- #40 (fetch also pulls) and #42 (lighter icons): on hold in the backlog,
  `2026-11-04`.
- `git worktree add --orphan`, per-worktree sparse checkout, and a
  read-only graph of a bare repository unless Y17 (b) asks for it.
- Phase 2's docked details, Phase 6's initial branches on load, Phase 9's
  dropdown ordering preference, Phase 10's text items, and Phase 16's topo,
  encoding and remote-ref candidates.

## Slices

Each is one file under this section. `Status` here is the integrator's view;
the slice file's own `Status:` line is authoritative while it's in progress.
Slices in the same wave run in parallel when their files don't overlap.
Slices touching `package.json`, the `package.nls*` files or the l10n bundles
run one after another, as the integrator procedure says.

| ID | Slice | Kind | Needs | Wave | Status |
| --- | --- | --- | --- | --- | --- |
| W00 | [Finish release 1.9.0's housekeeping](050-release-1-10-0-the-worktrees/100-w00-finish-release-1-9-0-housekeeping.md) | docs | — (Y15 for step 3) | A | integrated `79e2ecc` |
| W01 | [Refresh the engine's dependencies and gix](050-release-1-10-0-the-worktrees/110-w01-refresh-the-engine-dependencies-and-gix.md) | Rust | — (Y2 answered) | A | integrated `be1d870` |
| W02 | [List worktrees on the CLI](050-release-1-10-0-the-worktrees/120-w02-list-worktrees-on-the-cli.md) | TS | — | A | integrated `ad43c13` |
| W04 | [Refresh a graph when a worktree changes](050-release-1-10-0-the-worktrees/140-w04-refresh-a-graph-when-a-worktree-changes.md) | TS | — | A | integrated `62a171e` |
| W04F | [Git dirs Sonar follow-up, and one worktree check](050-release-1-10-0-the-worktrees/145-w04f-git-dirs-sonar-follow-up-and-one-worktree-check.md) | TS | W04, W08 | A | dispatched `2026-11-05` (Haiku) |
| W05 | [Suggest the full branch name for a remote checkout](050-release-1-10-0-the-worktrees/150-w05-suggest-the-full-branch-name-for-a-remote-checkout.md) | webview | — | A | integrated `659d095` |
| W06 | [Whole-row checkboxes in dialogs](050-release-1-10-0-the-worktrees/160-w06-whole-row-checkboxes-in-dialogs.md) | CSS | Y13 (ready under (a)) | A | integrated `af7ff04` |
| W07 | [Read a linked worktree's local config](050-release-1-10-0-the-worktrees/170-w07-read-a-linked-worktree-s-local-config.md) | Rust + TS | W01 | A | dispatched `2026-11-05` (Sonnet) |
| W08 | [A nested worktree is not a submodule in telemetry](050-release-1-10-0-the-worktrees/180-w08-a-nested-worktree-is-not-a-submodule-in-telemetry.md) | TS | — | A | integrated `6b0e232` |
| W25 | [Push dialog defaults that follow Git](050-release-1-10-0-the-worktrees/350-w25-push-dialog-defaults-that-follow-git.md) | TS + webview | Y11 | A | dispatched `2026-11-05` (Haiku) |
| W26 | [Tags show the remotes that hold them (PR #47)](050-release-1-10-0-the-worktrees/360-w26-tags-show-the-remotes-that-hold-them.md) | review + land an outside PR | Y23, Y24 | A | review dispatched `2026-11-05` (Sonnet) |
| W26F | [A setting for the tag remote check](050-release-1-10-0-the-worktrees/365-w26f-a-setting-for-the-tag-remote-check.md) | TS + webview + manifest | W26 | A | needs W26 |
| W03 | [List worktrees in the engine](050-release-1-10-0-the-worktrees/130-w03-list-worktrees-in-the-engine.md) | Rust + TS | W01, W02 | B | dispatched `2026-11-05` (Sonnet) |
| W40 | [Engine reads on linked worktrees, proven](050-release-1-10-0-the-worktrees/500-w40-engine-reads-on-linked-worktrees-proven.md) | Rust + TS | W01, W07 | B | needs W07 |
| W41 | [Engine opens refuse untrusted repositories](050-release-1-10-0-the-worktrees/510-w41-engine-opens-refuse-untrusted-repositories.md) | Rust + TS | W01, Y12 | B | ready; held until W07 is integrated (both bump the engine version) |
| W10 | [Carry worktrees to the webview](050-release-1-10-0-the-worktrees/200-w10-carry-worktrees-to-the-webview.md) | TS | W02 | C | dispatched `2026-11-05` (Haiku) |
| W11 | [Show where each branch is checked out](050-release-1-10-0-the-worktrees/210-w11-show-where-each-branch-is-checked-out.md) | webview | W10, Y4 | C | needs W10 |
| W12 | [Other worktrees' detached HEADs in the graph](050-release-1-10-0-the-worktrees/220-w12-other-worktrees-detached-heads-in-the-graph.md) | TS + Rust | W10, W03, Y22 | C | needs W10, W03 |
| W20 | [Branch actions that know about worktrees](050-release-1-10-0-the-worktrees/300-w20-branch-actions-that-know-about-worktrees.md) | webview + TS | W10, Y6 | D | needs W10 |
| W21 | [Remove, prune and repair worktrees](050-release-1-10-0-the-worktrees/310-w21-remove-prune-and-repair-worktrees.md) | TS + webview | W10, W20, Y5 | D | needs W10, W20 |
| W22 | [Create a worktree](050-release-1-10-0-the-worktrees/320-w22-create-a-worktree.md) | TS + webview | W10, Y7, Y8 | D | needs W10 |
| W24 | [Check out a remote branch whose local branch exists](050-release-1-10-0-the-worktrees/340-w24-check-out-a-remote-branch-whose-local-branch-exists.md) | webview + TS | W05, W10, Y14 | D | needs W10 |
| W31 | [Open a worktree or switch the graph to it](050-release-1-10-0-the-worktrees/410-w31-open-a-worktree-or-switch-the-graph-to-it.md) | TS + manifest | W10 | E | needs W10 |
| W30 | [A worktree list](050-release-1-10-0-the-worktrees/400-w30-a-worktree-list.md) | webview | W10, W21, W31, Y3 | E | needs W10, W21, W31 |
| W23 | [Lock, unlock and move a worktree](050-release-1-10-0-the-worktrees/330-w23-lock-unlock-and-move-a-worktree.md) | TS + webview | W21, W30 | E | needs W21, W30 |
| W32 | [Worktrees in the repository dropdown](050-release-1-10-0-the-worktrees/420-w32-worktrees-in-the-repository-dropdown.md) | TS + webview | W02, W04, W10, Y9, Y10 | E | needs W10 |
| W33 | [Bare repositories with worktrees](050-release-1-10-0-the-worktrees/430-w33-bare-repositories-with-worktrees.md) | TS + webview | W32, Y17 | E | needs W32 |
| W34 | [Share repository settings across worktrees](050-release-1-10-0-the-worktrees/440-w34-share-repository-settings-across-worktrees.md) | TS | W32, Y18 | E | needs W32 |
| W50 | [Worktree telemetry](050-release-1-10-0-the-worktrees/600-w50-worktree-telemetry.md) | TS + docs | W11, W32, Y19 | F | needs W11, W32 |
| W51 | [Local changes in other worktrees](050-release-1-10-0-the-worktrees/610-w51-local-changes-in-other-worktrees.md) | TS | W30, Y20 | F | needs W30 |
| W90 | [Release 1.10.0](050-release-1-10-0-the-worktrees/900-w90-release-1-10-0.md) | release | every slice in scope | — | maintainer |

**Order, if one agent does everything:**

1. The slices that need no decision: W00, W01, W02, W04, W05, W06 and W08.
2. Then W07, then W03 and W40, then W10 and W31.
3. Then, as their decisions are answered, W11, W12, W20, W21, W22, W24,
   W25 and W26; then W30, then W23 and W32; then W33, W34, W41, W50 and W51.
   W26 can be reviewed as soon as Y23 is answered, since its code is
   already written; it lands on `main` per Y24.
4. Then W90.

**Waves:**
- **A:** foundations, today's bugs, and the issues that stand alone.
- **B:** the engine.
- **C:** data and display.
- **D:** actions.
- **E:** navigation and discovery.
- **F:** extras.

The engine's critical path is W01, then W07 and W03, then W40 and W12.
W41 needs only W01. The UI's critical path is W02, then W10, then W20 and
W21, then W30.

## Definition of done for 1.10.0

- Every slice in scope is integrated, and each report is filled in. A gated
  slice leaves scope only by the maintainer answering its decision with
  "defer".
- On the integration branch: the full gate in order (strict Biome,
  `pnpm run package`, `pnpm run test`, `pnpm run l10n:check` at 100%, fresh
  `pnpm run test:coverage`, `pnpm run sonar:scan` polled to `OK`), the Rust
  arm, and `pnpm run kb:check`. Every platform binary is rebuilt, and
  `verify-vsix.yml` passes as a manual dry run on every leg.
- Issue #37: a repository with linked worktrees shows which branch is checked
  out where, with paths, and other worktrees' detached HEADs per Y22.
- Issue #38: a branch blocked by a leftover worktree can be freed from the
  UI, without anything forced silently.
- Issues #36, #41 and #45 behave as their decisions say.
- Issue #46: PR #47 is reviewed, adjusted per Y23, and merged per Y24, and
  its `Closes` line closed #46.
- Each issue in scope is closed by the commit that completes it, per
  Closing issues from commits.
- A graph on a linked worktree refreshes like one on a main worktree, and
  shows the same local identity on both backends.
- Every engine read wired for worktrees has a parity test, and no engine
  write was added.
- `CHANGELOG.md` has `[1.10.0]`, and the README lists worktrees and the new
  settings.

## Integration log

The integrator appends one dated line per integrated slice or wave: the
commit, the gate results with numbers, and the Sonar task id.

- `2026-11-05`: Y1 and Y16 answered. The integration branch `the-worktrees`
  was created locally from `main` at `f11b5d6`, and nothing of 1.10.0 is
  pushed. Claude Opus 5.5 is the team lead and integrator. Wave A was
  dispatched to `general-purpose` agents, each slice on
  `wt-1.10.0/<id>` in `../ggl-<id>`:
  - Haiku: W00 (without Y15's step 3), W02, W05, W06 and W08;
  - Sonnet: W01 and W04.
- `2026-11-05`: wave A's first seven slices integrated, in dependency order
  and each rebased onto the branch: W00 `79e2ecc`, W01 `be1d870`, W02
  `ad43c13`, W04 `62a171e`, W05 `659d095`, W06 `af7ff04` and W08 `6b0e232`.
  All 29 commits are signed.
  - W06's `CHANGELOG.md` conflict with W05 was resolved by keeping both
    entries.
  - W08's claim commit wrongly said `Refs …#46`. It was rebuilt without
    that line, its tree unchanged.
  - Every slice stayed inside its Touch list.
  - Follow-up W08F: `isLinkedWorktree()` in `src/telemetry/viewFeatures.ts`
    repeats the `.git`-file and `commondir` check behind W04's
    `resolveGitDirs()`, since the two were built in parallel. Use the one
    helper.
  - Watch at the Sonar gate: W04's `resolveWithGit()` spawns `git` through
    `PATH` with `execFileSync`, the S4036 pattern D65F had to fix.
  - Dispatched on `6b0e232`, each in a recycled worktree:
    - Sonnet: W07 (engine `1.0.27`) and W03 (no version bump);
    - Haiku: W10, W25 and W00b (Y15's step 3);
    - Sonnet: the W26 review of PR #47, detached at `a109e9a`, read-only.

    W41 waits for W07, since both bump the engine version.
- `2026-11-05`, wave A gate on `6b0e232`, in the main checkout:
  - Rust arm: `engine:fmt`, `engine:lint`, `engine:check` and `engine:test`
    pass. The engine was rebuilt on gix 0.90, and `engine:smoke` reports
    `1.0.26`.
  - Strict Biome is clean on the 12 touched TypeScript files.
  - `package`, `test`, `l10n:check` and `kb:check` pass.
  - Fresh `test:coverage`: 160 files, 2,036 of 2,036 tests passed, none
    skipped.
  - Sonar task `01ead3ac-8e5c-4824-9819-cdedc8f13dc9`: quality gate
    **`ERROR`**, with `software_quality_security_issues` 1 against 0
    allowed. New coverage is 92.7%, and there are 4 new violations against
    5 allowed. All four findings are in W04's code: S4036 (the `PATH`
    spawn), S6582, S2933 and S7778. W04F clears them and folds in W08F.
  - Issue #41 is complete with W06. Its `Closes` line goes on W04F's
    integration record, once the gate is `OK`.
- `2026-11-05`: W00b (Y15's step 3) integrated at `cf5fd04`. It adds the
  standing Rules section Multi-agent releases and points 1.10.0's protocol
  and integrator procedure to it. The integrator procedure's "ask which
  agent and model" bullet now records Y16 as the answer.
