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

Status: claimed by Muse Code (muse-wonder-full-1.0) on 2026-11-05 21:20
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

Not started.
