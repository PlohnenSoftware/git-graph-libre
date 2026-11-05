---
summary: >-
  W51 · wave F · needs W30, Y20 · TypeScript · ~120 lines: show whether
  another worktree has uncommitted changes. It is computed on demand when the
  worktree list opens, never on every refresh: one bounded `git -C <path>
  status` per worktree, with a timeout. It warns before removal (W21) and
  marks rows (W30). Deferring it is a valid answer to Y20.
---

# W51 — Local changes in other worktrees

Status: ready once W30 is integrated
Needs: W30
Decisions: Y20 ((a) on demand in the list; (b) defer)
Kind: TypeScript · Size budget: ~120 changed lines outside tests
Source: full worktree support; Engine changes for worktrees (each worktree's
status needs its own index and work tree, so its own handle on the engine)

## Facts

- The uncommitted row and staging run in the selected repository only
  (`src/backend/gitClient.ts`; `src/backend/queries/uncommittedDetails.ts:79`–`:94`).
  Another worktree's state needs `git -C <path>`, or an engine handle per
  worktree, which costs memory (Engine changes for worktrees, Handles).
- `git worktree remove` already refuses a worktree with local changes, so W21
  is safe without W51. W51 only warns earlier.

## Steps for (a)

1. A read-only `worktreeStatus { paths }` runs `git -C <path> status
   --porcelain=v2 --untracked-files=normal`, a few at a time with a
   per-worktree timeout, and returns `dirty`, `clean` or `unknown` for each.
   It is CLI only: no engine handles are opened for siblings.
2. The worktree list (W30) requests it when it opens, and marks dirty rows.
   W21's confirmation names the state when it is known.
3. Tests: dirty, clean and timed-out fixtures, and the concurrency bound.

## Touch

`src/backend/queries/worktreeStatus.ts` (new), `src/backend/types/queries.types.ts`,
`src/extension/messageHandler.ts`, `src/webview/worktreeList.ts`, `tests/**`

## Acceptance

The list shows each worktree's state within the timeout. Nothing runs on an
ordinary refresh.

## Report

Not started.
