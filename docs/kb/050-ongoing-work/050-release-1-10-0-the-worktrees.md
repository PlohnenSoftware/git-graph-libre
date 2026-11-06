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
| W04F | [Git dirs Sonar follow-up, and one worktree check](050-release-1-10-0-the-worktrees/145-w04f-git-dirs-sonar-follow-up-and-one-worktree-check.md) | TS | W04, W08 | A | integrated `7db994b` |
| W05 | [Suggest the full branch name for a remote checkout](050-release-1-10-0-the-worktrees/150-w05-suggest-the-full-branch-name-for-a-remote-checkout.md) | webview | — | A | integrated `659d095` |
| W06 | [Whole-row checkboxes in dialogs](050-release-1-10-0-the-worktrees/160-w06-whole-row-checkboxes-in-dialogs.md) | CSS | Y13 (ready under (a)) | A | integrated `af7ff04` |
| W06F | [Whole-row checkboxes in every popup](050-release-1-10-0-the-worktrees/165-w06f-whole-row-checkboxes-in-every-popup.md) | CSS + webview | W06, Y13 | A | integrated `0c1437e` |
| W07 | [Read a linked worktree's local config](050-release-1-10-0-the-worktrees/170-w07-read-a-linked-worktree-s-local-config.md) | Rust + TS | W01 | A | integrated `c9ce36c` |
| W08 | [A nested worktree is not a submodule in telemetry](050-release-1-10-0-the-worktrees/180-w08-a-nested-worktree-is-not-a-submodule-in-telemetry.md) | TS | — | A | integrated `6b0e232` |
| W25 | [Push dialog defaults that follow Git](050-release-1-10-0-the-worktrees/350-w25-push-dialog-defaults-that-follow-git.md) | TS + webview | Y11 | A | integrated `decdf71` |
| W26 | [Tags show the remotes that hold them (PR #47)](050-release-1-10-0-the-worktrees/360-w26-tags-show-the-remotes-that-hold-them.md) | review + land an outside PR | Y23, Y24 | A | integrated `a93ddc7` (merge of `a109e9a`), PR update `dc1886c` merged at `d1bc642` |
| W26F | [A setting for the tag remote check](050-release-1-10-0-the-worktrees/365-w26f-a-setting-for-the-tag-remote-check.md) | TS + webview + manifest | W26 | A | integrated `43ac7e9` |
| W26G | [Off, origin or all remotes for tag badges](050-release-1-10-0-the-worktrees/366-w26g-off-origin-or-all-remotes-for-tag-badges.md) | TS + webview + manifest + l10n | W26F, W26H, W26HF | A | dispatched `2026-11-06` (Sonnet) |
| W26H | [Harden the remote tag read](050-release-1-10-0-the-worktrees/368-w26h-harden-the-remote-tag-read.md) | TS | W26F | A | integrated `d607144` |
| W26HF | [Remote tag read Sonar follow-up](050-release-1-10-0-the-worktrees/369-w26hf-remote-tag-read-sonar-follow-up.md) | TS | W26H | A | integrated `8ff94dd` |
| W03 | [List worktrees in the engine](050-release-1-10-0-the-worktrees/130-w03-list-worktrees-in-the-engine.md) | Rust + TS | W01, W02 | B | integrated `f9e54a4` |
| W40 | [Engine reads on linked worktrees, proven](050-release-1-10-0-the-worktrees/500-w40-engine-reads-on-linked-worktrees-proven.md) | Rust + TS | W01, W07 | B | integrated `f1dcbb6` |
| W41 | [Engine opens refuse untrusted repositories](050-release-1-10-0-the-worktrees/510-w41-engine-opens-refuse-untrusted-repositories.md) | Rust + TS | W01, Y12 | B | integrated `a81b51a` |
| W10 | [Carry worktrees to the webview](050-release-1-10-0-the-worktrees/200-w10-carry-worktrees-to-the-webview.md) | TS | W02 | C | integrated `2a619c4` |
| W10F | [Read worktrees through the engine reader](050-release-1-10-0-the-worktrees/205-w10f-read-worktrees-through-the-engine-reader.md) | TS | W03, W10 | C | integrated `436e0b0` |
| W11 | [Show where each branch is checked out](050-release-1-10-0-the-worktrees/210-w11-show-where-each-branch-is-checked-out.md) | webview | W10, Y4 | C | integrated `54065b5` |
| W12 | [Other worktrees' detached HEADs in the graph](050-release-1-10-0-the-worktrees/220-w12-other-worktrees-detached-heads-in-the-graph.md) | TS + Rust | W10, W03, Y22 | C | integrated `fbc0c22` |
| W20 | [Branch actions that know about worktrees](050-release-1-10-0-the-worktrees/300-w20-branch-actions-that-know-about-worktrees.md) | webview + TS | W10, Y6 | D | integrated `83f5821` |
| W21 | [Remove, prune and repair worktrees](050-release-1-10-0-the-worktrees/310-w21-remove-prune-and-repair-worktrees.md) | TS + webview | W10, W20, Y5 | D | integrated `88ed629` |
| W22 | [Create a worktree](050-release-1-10-0-the-worktrees/320-w22-create-a-worktree.md) | TS + webview | W10, Y7, Y8 | D | integrated `63cdd97` |
| W22F | [Worktree path setting, browse, and persisted finish choice](050-release-1-10-0-the-worktrees/325-w22f-worktree-path-setting-browse-and-persisted-finish.md) | TS + webview + manifest | W22, Y7, Y8 | D | ready |
| W24 | [Check out a remote branch whose local branch exists](050-release-1-10-0-the-worktrees/340-w24-check-out-a-remote-branch-whose-local-branch-exists.md) | webview + TS | W05, W10, Y14 | D | integrated `65725f7` |
| W31 | [Open a worktree or switch the graph to it](050-release-1-10-0-the-worktrees/410-w31-open-a-worktree-or-switch-the-graph-to-it.md) | TS + manifest | W10 | E | integrated `fcc76c4` |
| W30 | [A worktree list](050-release-1-10-0-the-worktrees/400-w30-a-worktree-list.md) | webview | W10, W21, W31, Y3 | E | integrated `5cdfa9e` |
| W23 | [Lock, unlock and move a worktree](050-release-1-10-0-the-worktrees/330-w23-lock-unlock-and-move-a-worktree.md) | TS + webview | W21, W30 | E | ready (queued: one manifest or l10n slice at a time) |
| W32 | [Worktrees in the repository dropdown](050-release-1-10-0-the-worktrees/420-w32-worktrees-in-the-repository-dropdown.md) | TS + webview | W02, W04, W10, Y9, Y10 | E | integrated `426b789` |
| W32F | [Worktree discovery Sonar follow-up](050-release-1-10-0-the-worktrees/425-w32f-worktree-discovery-sonar-follow-up.md) | TS | W32 | E | dispatched `2026-11-06` (Haiku) |
| W33 | [Bare repositories with worktrees](050-release-1-10-0-the-worktrees/430-w33-bare-repositories-with-worktrees.md) | TS + webview | W32, Y17 | E | ready (queued: one manifest or l10n slice at a time) |
| W34 | [Share repository settings across worktrees](050-release-1-10-0-the-worktrees/440-w34-share-repository-settings-across-worktrees.md) | TS | W32, Y18 | E | ready (queued: one manifest or l10n slice at a time) |
| W50 | [Worktree telemetry](050-release-1-10-0-the-worktrees/600-w50-worktree-telemetry.md) | TS + docs | W11, W32, Y19 | F | ready (queued: one manifest or l10n slice at a time) |
| W51 | [Local changes in other worktrees](050-release-1-10-0-the-worktrees/610-w51-local-changes-in-other-worktrees.md) | TS | W30, Y20 | F | ready (queued: one manifest or l10n slice at a time) |
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
- `2026-11-05`: W26.
  - The PR #47 review (Sonnet, read-only) says merge as is, then follow
    up, with no blocker. The PR's claimed baseline failures do not
    reproduce on Linux.
  - PR #47 was merged at `a93ddc7`, a plain merge commit (Y24) with
    `a109e9a` unchanged. The `CHANGELOG.md` and index conflicts are
    resolved, and the record moved to prefix `180`.
  - On the merged tree, `package` passes, `test` passes (backend 1241 of
    1241, webview 804 of 804), and `l10n:check` and `kb:check` pass.
  - Follow-ups: W26F (Y23's setting plus the webview findings F4, F5 and
    F10), dispatched to Sonnet; W26H (the process findings), which needs
    W26F.
  - W04F (the Sonar fixes) was dispatched to Haiku.
- `2026-11-05`: W04F integrated at `7db994b` and W03 at `f9e54a4`. Gate on
  `f9e54a4`, which holds wave A so far, W00b, W04F, W03 and the PR #47
  merge:
  - Rust arm: `engine:fmt`, `engine:lint`, `engine:check` and
    `engine:test` pass. The engine was rebuilt (`engine:smoke`: `1.0.26`,
    with `listWorktrees`).
  - Strict Biome is clean on the 19 TypeScript files touched since
    `6b0e232`.
  - `package`, `l10n:check` and `kb:check` pass.
  - Fresh `test:coverage`: 162 files, 2,071 of 2,071 tests passed.
  - Sonar task `f413d65b-fbe1-4682-b36f-e0b2ade4fe82`: quality gate
    **`OK`**. New coverage is 93.7%, with 0 new violations, 0 security
    issues and 0 reliability issues. W04F cleared all four wave A findings.
  - Issue #41 (W06) is complete and gated, so this record closes it.
  - A note for the integrator: a slice worktree keeps the engine binary it
    started with. After W03, copy the main checkout's rebuilt
    `engine/native/linux-x64/git-graph.node` into a worktree before running
    its tests, or W03's parity tests fail there for lack of `listWorktrees`.
- `2026-11-05`: W25 integrated at `decdf71` and W10 at `2a619c4`.
  - W25's rebase had two conflicts, resolved by keeping both sides: the
    `remoteTags` and `branchPushDefaults` payload types, and their
    webview response handlers.
  - W10's rebase had one: the `GitWorktree` import beside `QueryResult`.
  - The combined tree then had a semantic conflict. W25's
    `openPushBranchMenu()` test fixture sends `loadBranches` without W10's
    new `worktrees` and `upstreams` fields (cast through `unknown`), which
    made 8 unhandled "worktrees is not iterable" errors. The integrator's
    fixup `2a619c4` adds the fields.
  - On W10's rebased tree: typecheck passes, the backend passes (60
    environment skips in the slice worktree), and the webview passes 816
    of 816 with no unhandled errors.
  - Issue #36 is complete with W25, so its `Closes` line goes on the next
    gated record.
  - Next:
    - W10F, routing W10's worktree read through W03's engine reader, is
      dispatched to Haiku.
    - The manifest and l10n slices (W11, W20, W22, W24, W31, W32) queue
      behind W26F, one at a time.
    - The engine slices W12, W40 and W41 wait for W07.
- `2026-11-05`: W26F integrated at `43ac7e9`. It adds the
  `repository.showTagRemotes` setting (on by default, gated at both ends)
  and the review's fixes F4, F5 and F10.
  - It touched `src/webview/utils/dom.ts` outside its Touch list: an
    optional `root` argument for `addListenerToClass`, backward
    compatible. Accepted.
  - The rebase was clean, but W10's new `branchWorktrees.test.ts` fixture
    lacked the new required `showTagRemotes` field (TS2741). The
    integrator's fixup `43ac7e9` adds it.
  - On the rebased tree: typecheck passes, the backend passes 1228 (60
    environment skips), the webview passes 822 of 822 with no unhandled
    errors, and l10n is complete.
  - The nl, pl, zh-cn and zh-tw strings are the agent's own translations,
    not yet reviewed by native speakers.
  - Next: W26H dispatched to Sonnet, and W20 dispatched to Sonnet, taking
    the manifest and l10n slot.
- `2026-11-05`: W10F integrated at `436e0b0`. `loadBranches` now reads the
  worktree list through W03's engine reader, with the setting read live,
  verified repositories only, and the CLI as the fallback.
  - The rebase onto `33a0870` was clean.
  - Typecheck passes. The backend passes 1230 (60 environment skips) and
    the webview 824 of 824.
  - The engine-served trust-gate case needs the built engine, as W03's
    parity tests do.
- `2026-11-05`: W26H integrated at `d607144`. The remote tag read now:
  - spawns with stdin ignored, `SSH_ASKPASS_REQUIRE=never` and
    `windowsHide`;
  - runs in its own process group off Windows (no controlling terminal),
    killed as a group on timeout, overflow or abort;
  - uses `taskkill /T /F` on Windows, unit-tested by injection only;
  - reads at most 4 remotes at a time, and is abortable;
  - has its handler trace the real read, catch a rejected post, and abort
    the previous read.

  Notes:
  - Workspace trust: `capabilities.untrustedWorkspaces.supported` is
    `false`, so no `isTrusted` check is needed.
  - Accepted outside the Touch list: 2 lines in `src/extension.ts` make
    the panel's `onDispose` abort the read.
  - Risk noted: a detached group outlives an extension host that dies
    mid-read, until its own Git or SSH ends.
  - The rebase onto `4625eca` was clean. Typecheck and strict Biome pass.
    The backend passes 1238 (60 environment skips) and the webview 827 of
    827.
- `2026-11-05`, gate on `3ba7cc3`: W25, W10, W10F, W26F and W26H since
  the last gate.
  - The Rust arm was skipped, with no engine change since `f9e54a4`.
  - Strict Biome is clean on 50 files touched since `f9e54a4`.
  - `package`, `l10n:check` and `kb:check` pass.
  - Fresh `test:coverage`: 165 files, 2,125 of 2,125 tests passed.
  - Sonar task `a37bf460-39d5-4444-9269-67e25073a00f`: quality gate
    **`OK`**. New coverage is 94.8%, with 0 security and 0 reliability
    issues, and 3 new violations against 5 allowed. All three are in
    W26H's `src/backend/queries/remoteTags.ts`: S7780 at `:80`
    (`String.raw`), S1528 at `:163` (the `Array` constructor) and S9382 at
    `:168` (`await` in a loop). They are W26HF's.
  - Issue #36 is complete with W25 and gated, so this record closes it.
- `2026-11-05`: W20 integrated at `83f5821`. A branch checked out in another
  worktree now behaves differently in its menus:
  - Checkout becomes "Open Worktree…". For now that opens a dialog with
    Copy Path; W31 replaces `openWorktreeAction()`.
  - Pull and Fetch into Local Branch are hidden, and the menu header
    names the worktree.
  - Delete only explains, until W21. Rename notes that the other worktree
    follows the new name.
  - `fetchIntoLocalBranch` refuses before fetching.

  The context menu can't show a locked item with a reason, so Y6's
  fallback applies: hide the item, with a header line. The rebase was
  clean. Typecheck passes, the backend passes 1243 (60 environment skips),
  the webview 836 of 836, and l10n is complete. Accepted outside the Touch
  list: the matching `webviewL10n.ts` entries. The nl, pl, zh-cn and zh-tw
  strings are the agent's own.

  Dispatched next:
  - W21 to Sonnet, taking the manifest and l10n slot, completing #38;
  - W26HF to Haiku.
- `2026-11-05`: the maintainer re-answered Y13. Whole-row checkboxes are
  to be built once, at the shared popup level, for every popup, not only
  the modal dialogs.
  - W06F was added and dispatched to Haiku. It doesn't touch the manifest
    or l10n, so it runs beside W21.
  - #41's `Closes` line is already in the local record `31417ec`. It takes
    effect only when `main` is fast-forwarded at W90, by which time W06F
    is in, so the widened scope is closed together.
  - W07 reported done.
- `2026-11-05`: W07 integrated at `c9ce36c`. The engine's `config_list`
  and `resolveLocalGitConfigPath()` now read a linked worktree's local
  config from the common dir. The engine is `1.0.27`. The rebase was
  clean.
- `2026-11-05`, gate on `c9ce36c`: W20, W06F's record and W07 since the
  last gate.
  - Rust arm: `engine:fmt`, `engine:lint`, `engine:check` and
    `engine:test` pass. The engine was rebuilt, and `engine:smoke`
    reports `1.0.27`.
  - Strict Biome is clean on 15 files. `package`, `l10n:check` and
    `kb:check` pass.
  - Fresh `test:coverage`: 167 files, 2,142 of 2,142 tests passed.
  - Sonar task `07cb1af8-927b-4288-8a6a-f895f6c00259`: quality gate
    **`OK`**. New coverage is 94.9%, with 0 security issues and 4 new
    violations against 5 allowed:
    - W26H's three, cleared by W26HF, integrated right after at
      `8ff94dd`;
    - S5906 in W20's `branchWorktreeActions.test.ts:271`, fixed by the
      integrator at `9c547da`.
  - Dispatched: W40 to Sonnet, in the recycled W07 worktree with its
    engine build.
  - Held: W41 behind W40 (both change `repository.rs` and the engine
    version), and W12 behind W21 (both touch the l10n bundles).
- `2026-11-05`: W21 integrated at `88ed629`. From the Delete Branch dialog and
  the branch menu, a worktree can now be removed, its stale entry
  removed, repaired after a move, or pruned with a preview.
  - Safeguards read in review:
    - `--force` only after a second confirmation that lists up to 20
      changed paths;
    - a locked worktree is unlocked explicitly, never with `-f -f`;
    - `--` before every path;
    - the main and current worktrees are refused;
    - engine handles are closed and known repositories dropped.
  - Accepted outside the Touch list: `queries.types.ts` (the
    `worktreeChanges` query) and `webviewL10n.ts`.
  - The rebase was clean. Typecheck passes, the backend passes 1257 (60
    environment skips), the webview 851 of 851, and l10n is complete.
  - Issue #38 is complete with W21. Its `Closes` line goes on the next
    gated record.
  - Next in the manifest and l10n slot: W31 (Haiku), with W21's Command
    Palette prune folded in, as recorded in W31's slice.
- `2026-11-05`: W40 integrated at `f1dcbb6`. Every wired engine read is
  proven on linked worktrees, against Git.
  - Fixed: authors and stats now count other worktrees' HEADs, as
    `--all` does.
  - Fixed: a removed or moved linked worktree's handle is evicted and
    declined, instead of being served or resolving to the enclosing
    repository.
  - The engine is `1.0.28`. The rebase was clean.
- `2026-11-05`, gate on `f1dcbb6`: W21, W31's slice note and W40 since
  `c9ce36c`.
  - Rust arm: `engine:fmt`, `engine:lint`, `engine:check` and
    `engine:test` pass. The engine was rebuilt, and `engine:smoke`
    reports `1.0.28`.
  - Strict Biome is clean on 17 files. `package`, `l10n:check` and
    `kb:check` pass.
  - Fresh `test:coverage`: 170 files, 2,173 of 2,173 tests passed.
  - Sonar task `bf1c37b1-f4c1-42e8-9c61-2b7625d11d86`: quality gate
    **`OK`**. New coverage is 94.8%, with 0 security issues. New
    violations are 5, exactly the threshold, all W21's: S3801, S6557
    twice, S4624 and S5906. The integrator cleared all five at `741462d`.
  - Issue #38 is complete with W21 and gated, so this record closes it.
  - W41 was dispatched to Sonnet, on W40's tip, bumping the engine to
    `1.0.29`.
- `2026-11-05`: the integrator session hit its usage limit right after
  fast-forwarding W06F to `0c1437e`; the W31 and W41 agents died with it,
  their work saved uncommitted in their worktrees. The maintainer resumed
  the session in Muse, which took over as integrator. The main
  checkout had been switched to a Dependabot branch meanwhile and was
  left untouched; this integration ran from the `ggl-W06F` worktree on
  `the-worktrees`. W31 and W41 were re-dispatched to fresh agents in
  their existing worktrees, continuing the saved work.
- `2026-11-05`, gate on `0c1437e`: W06F since `f983598`.
  - Strict Biome is clean on the 5 touched TypeScript files. `package`,
    `typecheck` and `kb:check` pass. Tests: backend 1,322, webview 852,
    all passing.
  - Fresh `test:coverage`: 170 files, 2,174 of 2,174 tests passed.
  - Sonar task `630edd5c-4118-4c3a-bdfc-37aebd6ad1cf`: quality gate
    **`OK`**. New coverage is 94.7%, with 0 new violations.
  - The integrator added the `.checkRow` rule to the Webview UI Styling
    Guide and the Y13 outcome to issue #41's subsection, both outside
    W06F's Touch list. Issue #41 already closes through `31417ec`.
- `2026-11-05`: W31 integrated at `fcc76c4`. A worktree can be opened in
  a new or the current window, added to the workspace, revealed in the
  OS, or switched to in the graph, and the Command Palette gained W21's
  prune preview. The re-dispatched agent finished the previous agent's
  saved work in the same worktree; the rebase onto the tip was clean.
  Accepted outside the Touch list, as flagged in the slice commits: the
  message-type files (`actions.types.ts`, `src/types.ts`,
  `webviewPanel.ts`, `webviewL10n.ts`) and the five l10n bundles.
- `2026-11-05`, gate on `fcc76c4`: W31 since `0c1437e`.
  - Strict Biome is clean on the touched files. `package`, `typecheck`,
    `l10n:check` (complete) and `kb:check` pass. Tests: backend 1,262
    passed and 60 skipped, webview 862, all passing. (The first gate run
    failed 5 engine parity tests on the worktree's stale binary; with
    the current `1.0.28` binary they pass 24 of 24.)
  - Fresh `test:coverage`: 170 files, 2,184 of 2,184 tests passed.
  - Sonar task `d22c0414-6692-4e44-ba85-696eb5206573`: quality gate
    **`OK`**. New coverage is 94.1%, with 0 new violations. The one
    finding the first scan raised (S7786) is cleared at `1ca6c9d`.
  - W30 is ready now that W31 is in. Also dispatched, outside the
    release slices and on its own branch: the switch of
    `publish.yml` to OIDC trusted publishing on both registries
    (maintainer, `2026-11-05`).
- `2026-11-05`: W41 integrated at `a81b51a`. Both engine opens bail on a
  repository Git's ownership rules reject, with their own `Untrusted`
  kind, and every reader read reroutes such a refusal to the CLI
  (`cause=untrusted`); `isVerified` is unchanged and still first. The
  engine is `1.0.29`. The re-dispatched agent finished the previous
  agent's saved Rust core in the same worktree, narrowing its test seam
  to reduced trust only. The rebase onto the tip was clean.
- `2026-11-05`, gate on `a81b51a`: W41 since `fcc76c4`.
  - Rust arm: `engine:fmt`, `engine:lint`, `engine:check` and
    `engine:test` pass (228 tests). The engine was rebuilt, and
    `engine:smoke` reports `1.0.29`.
  - Strict Biome is clean on the 5 touched TypeScript files. `package`,
    `typecheck` and `kb:check` pass. Tests: backend 1,330, webview 862,
    all passing.
  - Fresh `test:coverage`: 170 files, 2,192 of 2,192 tests passed.
  - Sonar task `9133f2c4-08d9-4f40-96e2-4b3202778fdd`: quality gate
    **`OK`**. New coverage is 94.1%, with 0 new violations.
  - Open, recorded in W41's report: a pure ownership change is not
    rechecked on a warm handle, and a theoretical mid-compose
    `config_list` refusal would be labelled `configFill:engineFailed`.
- `2026-11-05`: W12 integrated at `fbc0c22`. A linked worktree's detached
  HEAD is drawn and marked "HEAD of worktree \<folder\>", the path in the
  title. Each backend discovers the extra tips itself (no option carries
  them, following W40's precedent); the parity test pins identical rows,
  and the engine is `1.0.30` because the TypeScript relies on the new
  tips. The rebase onto the tip (over the trusted-publishing commits)
  was clean.
- `2026-11-05`, gate on `fbc0c22`: W12 since `a81b51a`.
  - Rust arm passes (228 tests); the engine was rebuilt and
    `engine:smoke` reports `1.0.30`. Strict Biome is clean; `package`,
    `typecheck`, `l10n:check` (complete) and `kb:check` pass. Tests:
    backend 1,331, webview 865, all passing.
  - Fresh `test:coverage`: 170 files, 2,196 of 2,196 tests passed.
  - The first scan (`53ccbd22`) read `ERROR`: W12's trailing-separator
    regex (S8786) counts as a reliability issue, and the gate allows
    none. The integrator replaced it with a scan and cleared S5906 in
    the new test (`4419734`). Sonar task
    `3a7997f3-5858-43ac-b36b-41c2932ef196`: quality gate **`OK`**, new
    coverage 94.2%, 0 new violations.
- `2026-11-05`: W11 integrated at `54065b5`. A branch checked out in
  another worktree carries the Y4 `file-directory` segment on its badge;
  its tooltip and context-menu header name every holding worktree's
  folder, path and locked or missing state. No rebase was needed (the
  slice started on the tip). Open, from W11's report: W12's dashed
  detached-HEAD badge and W11's segment are one family but not the same
  glyph style (filled folder on the commit color against outline folder
  on badge tokens); matching them exactly is a maintainer taste call,
  left as a possible small follow-up.
- `2026-11-05`, gate on `54065b5`: W11 since `fbc0c22`.
  - Strict Biome is clean; `package`, `typecheck`, `l10n:check`
    (complete) and `kb:check` pass. Tests: backend 1,331, webview 872,
    all passing. The agent's headless renders (both themes) are in
    `/tmp/w11-shot/`.
  - Fresh `test:coverage`: 170 files, 2,203 of 2,203 tests passed.
  - Sonar task `b4019517-4a1c-44a6-a2df-9a0ae47d4265`: quality gate
    **`OK`**. New coverage is 94.3%, with 0 new violations.
- `2026-11-05`: W22 integrated at `63cdd97`. Create Worktree… from a
  branch, a remote branch, a commit or a tag, with the Y7 (a) default
  folder, refusals decided from the worktree list before Git runs, and
  the Y8 finish over W31's messages. Accepted outside the Touch list,
  in its own flagged commit: the context-menu visibility registration
  (`src/types.ts`, `src/contextMenuVisibility.ts`), without which the
  new menu item could never be hidden and five existing tests fail.
  The Y7 (d) template setting, the browse button and a persisted Y8
  memory needed files this slice did not have; they are W22F, ready.
- `2026-11-05`, gate on `63cdd97`: W22 since `54065b5`.
  - Strict Biome is clean; `package`, `typecheck`, `l10n:check`
    (complete) and `kb:check` pass. Tests: backend 1,337, webview 882,
    all passing. The agent's headless renders (both themes, create and
    finish dialogs) are in `/tmp/w22-render/`.
  - Fresh `test:coverage`: 170 files, 2,219 of 2,219 tests passed.
  - Sonar task `0e516fc0-8d11-40ed-ad5f-598f07170c2f`: quality gate
    **`OK`**. New coverage is 94.1%, with 0 new violations; the one
    finding the first scan raised (S9382) is cleared at `4aa010e`.
- `2026-11-05`: trusted publishing integrated at `f9aad9c` (not a
  release slice; maintainer instruction of the same day). `publish.yml`
  now publishes to both registries by OIDC (`vsce publish --oidc`,
  `ovsx publish --trusted-publishing`, `id-token: write` on the release
  job only) and the two PAT secrets are no longer read. The record is
  Trusted publishing for releases (History). Before the first publish
  run on this workflow — for 1.10.0, that is W90's tag — the maintainer
  registers this repository and `publish.yml` on both registries; the
  secrets are deleted only after a proven publish to both. Gate for
  this docs-and-workflow change: YAML parse, `kb:check` and the full
  test suite (1,330 + 862) pass; no source file changed, so no new
  coverage or Sonar run.
- `2026-11-06`: integration resumed by Claude Opus 5.5 after both agents
  were cut off by the usage limit on `2026-11-05` (W41 and W31 had been
  finished and integrated meanwhile by the other integrator session).
  - Found an extra local branch `the_worktrees`, identical to
    `the-worktrees` at `ddbe602` and checked out in the main checkout,
    while `the-worktrees` was checked out in `../ggl-W06F`. It is left in
    place: it is not the integration branch, and nothing was lost. The
    main checkout is back on `the-worktrees`, and `ggl-W06F` is detached.
  - The main checkout's engine binary was still `1.0.28`, so the `1.0.30`
    build was copied in from W24's worktree.
- `2026-11-06`: W24 integrated at `65725f7`. Muse Code wrote it on
  `2026-11-05` and stopped after its changelog commit, before the report.
  - The integrator verified the slice and wrote its report: seven `G`
    commits, typecheck and strict Biome clean, backend 1341 of 1341,
    webview 891 of 891, and l10n and kb complete.
  - Acceptance is met. A remote checkout never ends in "already exists",
    and integration is `--ff-only`, only when chosen.
- `2026-11-06`, gate on `65725f7`: W24 since `63cdd97`.
  - The Rust arm was skipped, with no engine change.
  - Strict Biome is clean on 14 files. `package`, `l10n:check` and
    `kb:check` pass.
  - Fresh `test:coverage`: 175 files, 2,232 of 2,232 tests passed.
  - Sonar task `173dcf6b-6fb9-4e49-a601-6f6fbf6b3446`: quality gate
    **`OK`**. New coverage is 93.7%, with 0 security and 0 reliability
    issues. Its one new violation, S3358 (a nested ternary in W24's
    dialog), was fixed at `a6634f5`.
  - Issue #45 is complete with W24 and gated, so this record closes it.
  - W30, the worktree list, was dispatched to Sonnet, taking the
    manifest and l10n slot.
- `2026-11-06`: W30 integrated at `5cdfa9e`. It adds a Worktrees toolbar
  button (Y3 (a), always shown) opening a popup with every worktree:
  - each row shows its folder, path, branch or detached hash, and its
    main, current, bare, locked or prunable state;
  - row actions reuse W31's open and switch, and W21's remove, stale
    remove and repair;
  - the footer has W22's Create and W21's Prune.

  More:
  - W23's lock, unlock and move go in at `worktreeRowActions()`.
  - The rebase was clean. Typecheck passes, the backend passes 1341 of
    1341, the webview 913 of 913, and l10n is complete.
  - No `CHANGELOG.md` line, since it was outside the Touch list. W90's
    `[1.10.0]` covers it.
  - W23 and W51 are now ready, queued behind W32, which was dispatched to
    Sonnet into the manifest and l10n slot.
- `2026-11-06`, gate on `4d03668`: W30 since `65725f7`.
  - The Rust arm was skipped, with no engine change.
  - Strict Biome is clean on 12 files. `package`, `l10n:check` and
    `kb:check` pass.
  - Fresh `test:coverage`: 177 files, 2,254 of 2,254 tests passed.
  - The first scan (`f3ec1b4f`) read **`ERROR`**, on one reliability
    issue. W30's `folderName()` trimmed trailing separators with
    `/[/\\]+$/` (S8786), the regex W12 had already replaced with a scan
    in `main.ts`'s `worktreeFolderName()`. W30 could not import that,
    since `main.ts` imports `worktreeList.ts`. The integrator moved
    `worktreeFolderName()` to `src/webview/utils/git.ts`, used it from
    both, and deleted the copy (`eeaa424`).
  - Coverage rerun: 2,254 of 2,254. Rescan `1bd296d1-2954-431a-aaee-7b6bcef05780`:
    quality gate **`OK`**, with new coverage 93.7% and 0 new violations.
- `2026-11-06`: PR #47's update merged at `d1bc642`, a plain merge commit
  with `dc1886c` unchanged (maintainer: "please merge dc1886c… so PR
  updated by raphael balet is merged in full"). The PR is no longer a
  draft. Its head adds `0ded155` (a simplified screenshot, taken) and
  `dc1886c` (origin-only badges).
  - `dc1886c`'s code conflicted with W26F, W26H and W26HF, and was
    resolved to the integrated code, so no source differs from the gated
    `afdbe4c`. The History record took the contributor's text, with an
    integration note appended.
  - The maintainer asked for a three-way setting: off, only origin, all.
    The contributor's narrowing becomes the default `"origin"` mode in
    W26G, added and queued next in the manifest and l10n slot after W32.
- `2026-11-06`: W32 integrated at `426b789`. The dropdown now groups a
  repository's worktrees by common dir: the main worktree first, its
  linked worktrees beneath, labelled with their branch.
  - Discovery: nested worktrees (such as `.worktrees/x`) are found by
    listing each common dir after a scan.
  - Outside the workspace: a new host-only setting,
    `repository.worktreesOutsideWorkspace` (default `true`, Y9 (c)), lists
    them as "outside workspace", added on selection through W31.
  - Trust (Y10 (b)): one confirmation lists every untrusted worktree of a
    repository. A sibling counts only if its `.git` file names the same
    common dir back and Git itself reports it untrusted, and each entry is
    spelled by Git. The integrator reviewed this in
    `repositoryRecovery.ts` and `untrustedSiblingEntries()`.
  - Size: ~720 source lines against a ~250 guide, 480 of them in three
    new modules. Several files outside the Touch list were accepted, each
    in flagged commits: the setting's wiring, `repositoryRecovery.ts`,
    `repoLayout.ts`, `worktreeDiscovery.ts` and `repoOptions.ts`.
  - The rebase was clean. Typecheck passes, the backend passes 1370 of
    1370, the webview 932 of 932, and l10n and kb are complete.
  - W33, W34 and W50 are now ready, queued. W26G, the maintainer's
    three-mode tag setting, was dispatched to Sonnet into the slot.
- `2026-11-06`, gate on `e023aeb`: W32, the PR #47 merge and W26G's
  record since `eeaa424`.
  - The Rust arm was skipped, with no engine change.
  - Strict Biome is clean on 40 files. `package`, `l10n:check` and
    `kb:check` pass.
  - Fresh `test:coverage`: 181 files, 2,302 of 2,302 tests passed.
  - Sonar task `8e5b06cb-73c9-418c-9733-c5a2f8494685`: quality gate
    **`ERROR`**, with 13 new violations against 5 allowed. New coverage
    is 93.9%, with 0 security and 0 reliability issues.
  - All 13 are in W32's code: ten S9382 (`await` in a loop) and three
    S7721 (a nested function). W32F was added and dispatched to Haiku. It
    touches no manifest or l10n file, so it runs beside W26G.
