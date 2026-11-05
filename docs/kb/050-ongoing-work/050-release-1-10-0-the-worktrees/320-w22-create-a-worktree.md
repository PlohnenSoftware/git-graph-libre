---
summary: >-
  W22 · wave D · needs W10, Y7, Y8 · TypeScript + webview · ~250 lines:
  "Create Worktree…" from a branch, a remote branch, a commit or a tag. One
  dialog takes the path (default per Y7), an optional new branch, detach for
  commits and tags, and an optional lock with a reason, then runs `git
  worktree add`. It refuses a branch already checked out elsewhere, offering
  that worktree instead, and finishes per Y8 (open it, add it to the
  workspace, or switch the graph).
---

# W22 — Create a worktree

Status: claimed by Muse Code powered by muse-wonder-full-1.0 on 2026-11-05 20:22
Needs: W10
Decisions: Y7 (default location), Y8 (what happens after)
Kind: TypeScript and webview, l10n · Size budget: ~250 changed lines outside
tests
Source: full worktree support (maintainer, `2026-11-04`); Git worktree
behavior, verified

## Steps (as recommended)

1. Backend action `addWorktree { path, branch, newBranch, startPoint, detach,
   lockReason }` builds `git worktree add [--lock [--reason <r>]] [-b <new>]
   [--detach] <path> [<commit-ish>]`, with every value passed as a separate
   argument through `runGitRaw`.
2. Each entry point, in the context menus, pre-fills its own case:
   - **branch:** check out that branch, if it is checked out nowhere;
   - **remote branch:** `-b <local>` from W05's parsed name, tracking the
     remote branch;
   - **commit or tag:** detach, or a new branch name.
3. The dialog:
   - the path, defaulting per Y7, with a browse button using VS Code's
     folder picker;
   - the new branch name;
   - detach;
   - "Lock with reason".

   Validate inline (the dialog's `inputInvalid` state): the path must not
   exist, or be empty; the branch must not be checked out elsewhere (W10
   data). Otherwise say where it is checked out, and offer Open Worktree
   (W31).
4. On success, act per Y8. Recommended: ask with Open in New Window, Add to
   Workspace, Switch Graph and Nothing, remembering the last choice.
5. Tests (temporary fixtures):
   - each entry point's arguments;
   - a path with a space and a non-ASCII character;
   - the refusal for a branch in use;
   - locked creation.

   Then l10n, and the `CHANGELOG.md` line.

## Touch

`src/backend/actions/worktree.ts` (after W21, or created here if W21 is not
in yet), `src/backend/types/actions.types.ts`, `src/extension/messageHandler.ts`,
`src/webview/main.ts` (menus, dialog), l10n files, `tests/**`, `CHANGELOG.md`

## Acceptance

Each entry point creates exactly the worktree Git would create for those
arguments, and refusals are explained before Git is run.

## Report

Not started.
