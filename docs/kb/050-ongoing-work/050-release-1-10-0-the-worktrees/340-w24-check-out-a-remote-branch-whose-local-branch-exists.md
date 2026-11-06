---
summary: >-
  W24 · wave D · needs W05, W10, Y14 · webview + TypeScript · ~220 lines:
  issue #45's feature (and #39). Before running `git checkout -b`, detect that
  the local branch exists, by name or because it already tracks the clicked
  remote branch, and offer, in our own words: switch to it; switch and
  fast-forward it (`--ff-only`, never a merge); or create a branch with
  another name. If it is checked out in another worktree, offer that
  worktree.
---

# W24 — Check out a remote branch whose local branch exists

Status: integrated `65725f7` (`2026-11-06`)
Needs: W05, W10 (worktrees and upstreams)
Decisions: Y14 (fast-forward source and detection rules)
Kind: webview and TypeScript, l10n · Size budget: ~220 changed lines outside
tests
Source: issues #45 and #39; Issue #45: checking out a remote branch whose
local branch exists, under Open GitHub issues

## Facts (checked `2026-11-04`, `c47207e`)

- For a remote ref, `checkoutBranchAction()` (`src/webview/main.ts:5326`)
  asks for a name and sends `checkoutBranch` with `remoteBranch`, which runs
  `git checkout -b <name> <remote>/<branch>` (`src/backend/actions/branch.ts:72`–`:95`).
  That fails when `<name>` exists. `hasLocalBranch()` (`main.ts:4714`) can
  tell first.
- After W10, `gitUpstreams` gives each local branch's upstream, so a local
  branch tracking the clicked remote branch under another name can be found.
  That is the reporter's likely state: `admin-gui`, created through W05's
  bug.
- Clean-room: the "expected" dialog in the issue is mhutchie's post-MIT Git
  Graph. Use it as a behavioral target only, and word ours from Git's
  documentation (Open GitHub issues, Clean-room note).

## Steps (as recommended; Y14 may change them)

1. When the proposed name exists, or a local branch tracks the clicked remote
   branch, show a choice dialog before anything runs:
   - **Switch to <name>:** `git checkout <name>`;
   - **Switch to <name> and fast-forward it to <remote>/<branch>:** `git
     checkout <name>`, then `git merge --ff-only <remote>/<branch>`. This
     uses the remote-tracking ref the user clicked and needs no network.
     Git refuses cleanly when the branches have diverged, leaving the user on
     the branch, and says so;
   - **Create a branch with another name:** today's input, with inline
     validation that the name is free.
2. If <name> is checked out in another worktree (W10), replace both switch
   choices with Open Worktree (W31).
3. Backend: a `checkoutAndFastForward { branch, target }` action, two
   `runGitRaw` steps, reporting which step failed.
4. Tests:
   - name collision;
   - tracking under another name;
   - fast-forward success;
   - diverged refusal;
   - a branch in another worktree;
   - no collision, with today's flow unchanged.

   Then l10n. `CHANGELOG.md` credits `@rbalet`, and `@cktgh`'s analysis
   from #39.

## Touch

`src/webview/main.ts` (`checkoutBranchAction`, the new dialog),
`src/backend/actions/branch.ts`, `src/backend/types/actions.types.ts`,
`src/extension/messageHandler.ts`, l10n files, `tests/**`, `CHANGELOG.md`

## Acceptance

No remote checkout ends in "a branch named … already exists". Every
integration is fast-forward only, and only when chosen.

## Report

- **Agent / date:** Muse Code (`muse-wonder-full-1.0`), `2026-11-05`
  21:20–21:31. The agent stopped after its changelog commit, before
  writing this report. The integrator, Claude Opus 5.5, verified the work
  and wrote this report on `2026-11-06`.
- **Branch and commits:** `wt-1.10.0/W24`, on `ddbe602`. Seven commits,
  all `G`: `78d1f8d` (the claim), `97ae5ba` (strings), `8049798` and
  `694bb8e` (`checkoutAndFastForward` and its tests), `d79cf91` and
  `ec19c04` (the choice dialog and its tests), `c1e9ecb` (the changelog).
- **Files changed:** 15 files, +807/−11.
  - Source: `src/backend/actions/branch.ts` (+46),
    `src/backend/types/actions.types.ts`, `src/extension/messageHandler.ts`,
    `src/extension/webviewL10n.ts` and `src/webview/main.ts` (+187).
  - The five l10n bundles and `CHANGELOG.md`.
  - Tests: `tests/backend/actions/branch/checkoutAndFastForward.test.ts`
    (new), `tests/webview/checkoutRemoteExistingBranch.test.ts` (new, 9
    cases) and `tests/webview/checkoutRemoteBranchName.test.ts`.
- **What it does:**
  - **The choice.** Before checking out a remote branch, it detects a
    local branch with the proposed name, or one that already tracks the
    clicked remote branch. It then offers:
    - switch, which is a plain checkout;
    - switch and fast-forward;
    - create a branch under another name, with inline validation that
      the name is free.
  - **The fast-forward** is the `checkoutAndFastForward` action:
    `git checkout <name>`, then `git merge --ff-only <remote>/<branch>`.
    Each step is a recorded `runGitRaw`, and an error names the step
    that failed. A diverged branch is refused by Git and left checked
    out.
  - **Another worktree.** When another worktree holds the branch, it
    offers that worktree (W31) instead of the switch choices.
  - **No collision.** Without one, today's flow is unchanged.
- **Gates (integrator, in this worktree, with engine `1.0.30`):**
  - strict Biome is clean on every touched TypeScript file, and
    typecheck passes;
  - test: backend 1341 of 1341, webview 891 of 891, with no unhandled
    errors;
  - `l10n:check` is complete, and `kb:check` passes;
  - Sonar: integrator.
- **Acceptance:**
  - No remote checkout ends in "a branch named … already exists": met.
    The collision and tracking cases offer the choice first, and a taken
    name is blocked inline.
  - Integration is fast-forward only, and only when chosen: met. That is
    `--ff-only`, sent only from the explicit choice.
  - Every test case in step 4 is present.
- **Deviations from the slice:** `src/extension/webviewL10n.ts` is outside
  the Touch list, but the l10n pattern requires it. W05's
  `checkoutRemoteBranchName.test.ts` was adjusted for the new dialog.
- **Open questions / follow-ups:** the nl, pl, zh-cn and zh-tw strings
  were not reviewed by native speakers.
