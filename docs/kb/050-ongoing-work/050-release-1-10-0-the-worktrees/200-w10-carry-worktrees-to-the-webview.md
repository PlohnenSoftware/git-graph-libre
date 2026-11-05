---
summary: >-
  W10 · wave C · needs W02 · TypeScript · ~150 lines: put the worktree list,
  and each local branch's upstream, on the `loadBranches` response. That read
  is CLI-only already, so it needs no engine parity; it uses W03's reader
  once integrated. The webview keeps both in its state for markers, actions
  and #45. No visible change.
---

# W10 — Carry worktrees to the webview

Status: done — awaiting integration
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

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:17
- **Branch and commits:** `wt-1.10.0/W10`
  - `ecc947f G docs(worktrees): claim W10, carry worktrees to the webview (W10)`
  - `c55b21d G feat(worktrees): carry worktrees and upstreams on loadBranches (W10)`
  - `b818934 G test(worktrees): loadBranches worktrees and upstreams, with failure isolation (W10)`
  - `175e7af G fix(worktrees): keep a __proto__ branch as an own upstream key (W10)`
  - `985c412 G feat(worktrees): keep worktrees and upstreams in the webview state (W10)`
  - `78c9d8c G test(worktrees): the derived branch-to-worktree map and the response wiring (W10)`
  - this report commit (`docs(worktrees)`), signed as well
- **Files changed** (changed lines from `git diff --stat`, insertions plus deletions):
  - `src/backend/queries/loadBranches.ts`: 72
  - `src/backend/types/queries.types.ts`: 7
  - `src/webview/main.ts`: 49
  - `tests/backend/queries/loadBranches/list.test.ts`: 24
  - `tests/backend/queries/loadBranches/worktrees.test.ts`: 200 (new)
  - `tests/webview/branchWorktrees.test.ts`: 178 (new)
  - 18 more `tests/webview/*.test.ts` fixture files: 4 to 12 each, for the two new response fields
  - Source outside tests is 128 changed lines, within the ~150 budget.
- **Tests added or changed:**
  - New: 8 backend tests in `worktrees.test.ts` (listing and current marking from both sides, detached, a branch checked out twice, upstreams against a real remote, both failure paths, and the `__proto__` key), 4 webview tests in `branchWorktrees.test.ts`.
  - Changed: the 5 exact-shape `toEqual` expectations in `list.test.ts` and the webview `loadBranches` fixtures gain `worktrees` and `upstreams`. Nothing was loosened. Count for `loadBranches` tests: 9 before, 17 after.
- **Gates:**
  - Biome (strict, `--error-on-warnings`) on the 24 touched TypeScript files: exit 0. The only notice is the config-schema version message.
  - `pnpm run typecheck`: clean.
  - `pnpm run test`: backend 1182 passed, 60 skipped, of 1242 (96 files); webview 806 of 806 (66 files).
  - The 60 skips are existing guards in files this slice does not touch (engine parity, ssh-keygen, and similar).
  - `pnpm run kb:check`: exit 0.
  - `pnpm run l10n:check`: not run; the slice adds no user-visible text.
  - Rust arm: n/a, the engine is untouched.
  - Sonar: integrator.
- **Acceptance:**
  - Fields arrive on every refresh: met for the response. Every branch read sets both fields after the branch read succeeds. The webview stores them on each non-error response that changes them. The stored fields are private and not read back by any test; this is covered by typecheck and the map tests only.
  - A failure leaves the graph working: met. Fake-git tests show a failed worktree list or upstream read keeps `error: null` and the branches, returns an empty value for its own field, and writes `worktrees=unavailable` or `upstreams=unavailable` to the operation log.
  - Nothing visible changes: met for rendering. One side effect: the unchanged-branches check now also compares worktree state, so a worktree-only change counts as a change, and that closes an open menu or dialog, as a branch change already does.
- **Deviations from the slice:**
  - Upstreams read `%(refname)` and `%(upstream)` (full names, prefixes stripped), not `%(refname:short)` and `%(upstream:short)`. The short forms can gain a `heads/` prefix when a tag has the same name.
  - The webview fields are in memory only and are not in the saved view state. `WebViewState` lives in `src/webview/global.d.ts`, outside the Touch list, and `setState` is type-checked against it.
  - `src/webview/main.ts` also exports `branchWorktreeMap` for the tests, and the view gains a public accessor `worktreePathsFor(branch)`, which W11 and W12 will read.
  - Failure logs go through `logBackendRoute`, the existing exported logger. The Touch list has no operation-log file to add to.
  - Slice facts checked against the code:
    - `LoadBranchesResult` at `queries.types.ts:26` to `:32`: matches.
    - `loadBranches` is at `loadBranches.ts:18` to `:55`, not `:29` to `:44`.
    - simple-git's branch summary does carry `linkedWorkTree` per branch (`node_modules/simple-git/dist/typings/response.d.ts:9`). The code never reads it, and the CLI worktree list is the authority.
    - The webview handler is at `main.ts:6802` to `:6812` (slice said `:6795` to `:6816`). `gitBranches` and `gitBranchHead` are set at `:705` and `:706`: matches.
    - `engine/repoInfo.ts:51`: matches.
    - The section cited as "Data flow to the webview" in the worktree map does not exist in `docs/kb`. I found no such heading.
- **Open questions / follow-ups:**
  - Persisting the three fields: if they should survive a webview reload, `WebViewState` in `src/webview/global.d.ts` needs the optional fields. That file is outside this Touch list, so I did not change it.
  - Cost: each branch read now runs two extra Git commands (`worktree list`, `for-each-ref`). Not measured.
  - W03 swap: replace the body of `readWorktrees` in `loadBranches.ts`. The response keeps the `GitWorktree` shape.
  - Lead to decide: whether the webview-only test seam (the exported map) is acceptable in `main.ts`.

Response shape added to `loadBranches`: `worktrees: GitWorktree[]` (Git's order, main first, empty on failure), and `upstreams: Record<string, string | null>` (local branch to upstream short name, `null` when it tracks nothing, `{}` on failure). The response `error` is unchanged by either.
