---
summary: >-
  W23 · wave E · needs W21, W30 · TypeScript + webview · ~150 lines: Lock
  Worktree… (with a reason), Unlock, and Move Worktree… (a new path), from the
  worktree list and a branch's worktree marker. A locked worktree is never
  moved by force: unlock it first. After a move, the repository list follows
  the new path and the old engine handle is closed.
---

# W23 — Lock, unlock and move a worktree

Status: ready once W21 and W30 are integrated
Needs: W21 (shared action file), W30 (entry points)
Decisions: —
Kind: TypeScript and webview, l10n · Size budget: ~150 changed lines outside
tests
Source: full worktree support; Git worktree behavior, verified (locked
worktrees refuse `move` and `remove` without `-f -f`)

## Steps

1. Actions in `src/backend/actions/worktree.ts`:
   - `lockWorktree { path, reason }` runs `git worktree lock [--reason]`;
   - `unlockWorktree { path }`;
   - `moveWorktree { path, newPath }`.
2. Move refuses a locked worktree in the UI: say why and offer Unlock. A
   move into a path that exists is refused before Git runs.
3. After a move: `removeRepo(old)`, which closes its handle; then add the new
   path if the old one was known; then refresh. Moving the worktree this
   window has open is offered only with a warning that the window's folder
   moves, or is not offered at all. That choice is noted in the report.
4. Tests (temporary fixtures):
   - lock with and without a reason, and its display through W10;
   - unlock;
   - a clean move;
   - a move of a locked worktree refused;
   - the repository list following the moved path.

   Then l10n.

## Touch

`src/backend/actions/worktree.ts`, `src/backend/types/actions.types.ts`,
`src/extension/messageHandler.ts`, `src/extension/repoManager.ts` (only the
path follow-up, if needed), `src/webview/main.ts`, l10n files, `tests/**`

## Acceptance

A lock shows up with its reason. A move updates everything that knows the
path, and leaves no handle open on the old one.

## Report

Not started.
