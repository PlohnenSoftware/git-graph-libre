---
summary: >-
  W10 · wave C · needs W02 · TypeScript · ~150 lines: put the worktree list,
  and each local branch's upstream, on the `loadBranches` response. That read
  is CLI-only already, so it needs no engine parity; it uses W03's reader
  once integrated. The webview keeps both in its state for markers, actions
  and #45. No visible change.
---

# W10 — Carry worktrees to the webview

Status: claimed by Claude Haiku 5.5 on 2026-11-05 18:10
Needs: W02 (W03 optional: the reader uses it when present)
Decisions: —
Kind: TypeScript · Size budget: ~150 changed lines outside tests
Source: the TypeScript worktree map (`2026-11-04`), "Data flow to the
webview"

## Goal

Every graph refresh brings "which branch is checked out in which worktree"
and "which local branch tracks what" to the webview, cheaply and never
stale, so W11, W12, W20–W24 and W30 read from one place.

## Facts (checked `2026-11-04`, `c47207e`)

- `LoadBranchesResult` is at `src/backend/types/queries.types.ts:26`–`:32`.
  `loadBranches` (`src/backend/queries/loadBranches.ts:29`–`:44`) reads
  simple-git's summary, which already carries `linkedWorkTree` per branch,
  and keeps only the names.
- `loadBranches` is CLI-only: the engine's `branches` field is "carried but
  never consumed" (`src/backend/engine/repoInfo.ts:51`). Adding fields here
  needs no parity test.
- The webview's handlers are at `src/webview/main.ts:6795`–`:6816`, and
  `gitBranches` and `gitBranchHead` are set at `:705`–`:706`.

## Steps

1. `LoadBranchesResult` gains:
   - `worktrees: GitWorktree[]`, from W03's reader when integrated, otherwise
     from W02's `loadWorktrees`;
   - `upstreams: Record<string, string | null>`, local branch to its
     upstream's short name, from `git for-each-ref
     --format='%(refname:short)%00%(upstream:short)' refs/heads` in the same
     query.
2. A failure in either is logged and yields an empty value. It never fails
   the branch read.
3. The webview stores `gitWorktrees` and `gitUpstreams`, plus a derived
   `branch → worktree` map that leaves out the current worktree. Clear them
   on repository switch, with the existing request-id guard.
4. Tests:
   - backend: shapes on fixtures, failure isolation;
   - webview: the state and the derived map, including a branch checked out
     in two worktrees via `--ignore-other-worktrees`, which yields both
     paths.

## Touch

`src/backend/queries/loadBranches.ts`, `src/backend/types/queries.types.ts`,
`src/extension/messageHandler.ts` (only if the response passes through a
mapper), `src/webview/main.ts` (state only), `tests/**`

## Acceptance

The fields arrive on every refresh. A failure in either leaves the graph
working. Nothing visible changes.

## Report

Not started.
