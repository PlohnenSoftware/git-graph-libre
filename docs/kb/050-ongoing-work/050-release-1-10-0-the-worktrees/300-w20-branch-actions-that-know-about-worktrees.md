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

Status: done — awaiting integration
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

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05. Branch `wt-1.10.0/W20`.
- **Commits:** claim `6d30bda`; `0d87b7a` backend guard, tests and l10n bundles; `b7508f2` menus, dialogs, `webviewL10n.ts` mapping, webview tests; this report commit.
- **What changed:**
  - Local branch menu, branch checked out in another worktree (from W10's `worktreePathsFor`): Checkout becomes "Open Worktree…", Pull (update from upstream) is left out, Delete opens an explanation with no submit button, Rename keeps working and its dialog notes that the other worktree follows.
  - Remote branch menu, local counterpart held elsewhere: Checkout becomes "Open Worktree…", Fetch into Local Branch is left out. Pull of a remote branch (merges into the current branch) stays: Git allows it.
  - **Y6 menu decision:** the context menu has no locked items (`ContextMenuItem` is `title/checked/onClick`), so I took the fallback: the refused items are hidden, and the existing `ContextMenuHeader` shows "Checked out in another worktree" with the path(s) and why. `--ignore-other-worktrees` is never offered.
  - Dialog entry points (`showUpdateBranchFromUpstreamDialog`, `showFetchIntoLocalBranchDialog`) also redirect to the Open Worktree flow, in case a menu state is stale.
  - Backend guard in `fetchIntoLocalBranch` (which `updateBranchFromUpstream` calls): after the existing `branch --show-current` check rules this worktree out, it reads `worktree list --porcelain -z`, parses it with `parseWorktreeList`, and throws a localized `error.branchCheckedOutElsewhere` naming branch and path before any fetch. An unreadable list lets Git decide. It loads `@/l10n` with a dynamic import on the failure path only, because `branch.ts` re-exports this module and the backend test project cannot resolve `vscode`.
- **"Open Worktree…" until W31:** one seam, `openWorktreeAction(branch)` in `main.ts`. It opens a dialog saying the branch is checked out in the worktree at that path, with a "Copy Path" button that sends the existing `copyToClipboard` message (type `File Path`). No new message, command or `package.json` entry; W31 replaces the body of that one method.
- **Files:** `src/webview/main.ts`, `src/backend/actions/branchRemote.ts`, `src/extension/webviewL10n.ts` (mapping the pattern requires), five `l10n/bundle.l10n*.json` (8 keys each), tests: `tests/webview/branchWorktreeActions.test.ts` (9), `tests/backend/actions/branchRemoteWorktrees.test.ts` (5, real fixture with linked worktree at a path with a space and an accent), `tests/backend/actions/branchRemote.test.ts` (two call-order expectations gained the worktree read, nothing loosened).
- **Gates:** strict Biome on the 6 touched files: clean (only the schema-version notice). `pnpm run typecheck`: clean. `pnpm run test`: backend 1233 passed, 60 skipped, of 1293 (100 files); webview 831 of 831 (67 files); no "Unhandled Errors". `pnpm run l10n:check`: 100% in all four locales. No visual render: the header and menu items reuse existing styles. Sonar: integrator.
- **l10n:** real translations for nl, pl, zh-cn and zh-tw (machine-written by the agent, worth a native glance), "worktree" kept as a loanword in nl and pl, 工作樹/工作树 in zh.
- **Deviations:**
  - No locked menu items (see Y6 decision above); a header instead.
  - `webviewL10n.ts` touched, outside the Touch list but required by the l10n pattern.
  - Delete is still offered but only explains; the slice left removal to W21.
  - Rename dialog now goes through `showFormDialog` (was `showRefInputDialog`) to carry the note.
- **Open questions:** a branch checked out in several other worktrees: the dialog and copy use the first path, the header lists all. W21 may want to replace the Delete explanation with its removal option. README and changelog not updated (outside Touch).
