---
summary: >-
  W20 · wave D · needs W10, Y6 · webview + TypeScript · ~220 lines: for a
  branch checked out in another worktree, stop offering what Git refuses
  (checkout, Fetch into Local Branch, Pull/Update from upstream), and say why
  instead of showing Git's translated error. Offer the right alternative,
  "Open Worktree" (W31). Rename stays: Git moves the other worktree's HEAD.
  Phase 18's slice 18.4, and the explanation half of #38.
---

# W20 — Branch actions that know about worktrees

Status: ready once W10 is integrated
Needs: W10
Decisions: Y6 (hide, lock with a reason, or replace with an alternative)
Kind: webview and TypeScript, l10n · Size budget: ~220 changed lines outside
tests
Source: Phase 18's slice 18.4; issue #38; Git worktree behavior, verified
(Refusals)

## Facts (checked `2026-11-04`, `c47207e`)

- Git refuses, for a branch checked out elsewhere:
  - `switch` and `checkout`;
  - `branch -d` and `-D`. The local delete throws first, so the remote
    deletes in `deleteBranch` (`src/backend/actions/branch.ts:31`–`:56`)
    never run;
  - `branch -f`;
  - `rebase <upstream> <branch>`;
  - `fetch <r> <rb>:<lb>`.
- Allowed: `branch -m`, which moves the other worktree's HEAD along, and
  every read: merge, compare, cherry-pick.
- Menu gates today look only at `gitBranchHead`: checkout
  (`src/webview/main.ts:4013`–`:4025`), the mutation items
  (`:4049`–`:4070`), Fetch into Local Branch (`:4117`–`:4126`) and Pull
  (`:4035`–`:4047`).
- `fetchIntoLocalBranch` decides "checked out" with `branch --show-current`,
  so it only sees this worktree (`src/backend/actions/branchRemote.ts:90`–`:99`,
  `:159`). A branch checked out elsewhere is sent to `git fetch <r>
  <rb>:<lb>`, which Git refuses.
- Errors reach the user as Git's text through `handleActionResponse` and
  `showErrorDialog` (`main.ts:6739`–`:6772`, `:7465`). There is no structured
  error code.

## Steps (as recommended; Y6 may change them)

1. **Checkout**, on a local branch or on a remote branch whose local
   counterpart is checked out elsewhere: replace the item with "Open
   Worktree…", which calls W31. Never offer `--ignore-other-worktrees`.
2. **Delete Branch:** the dialog states "Checked out in worktree <path>".
   W21 adds the removal option. Without W21, the dialog explains and
   submits nothing.
3. **Fetch into Local Branch** and **Pull…** (Update from upstream): lock
   them with a reason, or hide them, per Y6. A locked item needs the context
   menu to support it; if it can't, hide the item and add a header line.
4. **Rename:** allowed. The dialog notes that the other worktree follows the
   new name.
5. Backend guard: `fetchIntoLocalBranch` and `updateBranchFromUpstream`
   check the worktree list and fail early with a localized message naming
   the worktree, never by matching Git's text.
6. l10n in all five bundles. Tests for every menu and dialog case, and for
   the backend guard on a fixture.

## Touch

`src/webview/main.ts` (the branch and remote-branch menus, the delete,
rename, fetch and pull dialogs), `src/backend/actions/branchRemote.ts` (the
guard), `src/backend/queries/worktrees.ts` (read only), l10n files,
`tests/**`

## Acceptance

None of the refused operations can be started from the UI for a branch
checked out elsewhere. Each says why, and offers the alternative where one
exists.

## Report

Not started.
