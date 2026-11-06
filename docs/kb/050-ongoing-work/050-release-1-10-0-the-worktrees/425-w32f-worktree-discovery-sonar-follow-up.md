---
summary: >-
  W32F · wave E · ready · TypeScript · ~80 lines: clear the 13 SonarQube
  findings that turned the gate on `e023aeb` red (13 new violations against
  5 allowed), all in W32's code: ten `await` inside a loop (S9382) and three
  nested functions to move to the outer scope (S7721). One shared sequential
  helper keeps the order where it matters, such as the trust writes to the
  global Git config. Behavior and tests stay unchanged.
---

# W32F — Worktree discovery Sonar follow-up

Status: claimed by Claude Haiku 5.5 on 2026-11-06 14:24
Needs: W32 (integrated `426b789`)
Decisions: —
Kind: TypeScript · Size budget: ~80 changed lines outside tests
Source: the gate on `e023aeb` (`2026-11-06`, Sonar task
`8e5b06cb-73c9-418c-9733-c5a2f8494685`, quality gate `ERROR`: 13 new
violations against 5 allowed)

## Facts

The findings, all new code from W32:

- `typescript:S9382`, "Unexpected `await` inside a loop":
  - `src/backend/utils/repositoryProbe.ts` `:219`, `:252`, `:255`, `:256`
    and `:258`. These are in `namedWorktreeFolders()` and
    `untrustedSiblingEntries()`.
  - `src/extension/repositoryRecovery.ts:69`: the loop writing each
    trusted entry with `trustGitRepository()`.
  - `src/extension/worktreeDiscovery.ts` `:165`, `:190`, `:207` and
    `:208`.
- `typescript:S7721`, "Move function to the outer scope":
  - `src/extension/repoManager.ts:118` `workspaceRoots`, and `:122`
    `isInsideRoots`;
  - `src/extension/worktreeDiscovery.ts:120`, the async `describe`.

Precedents for the same rules in this release: D66F (`await` in loops in
a gate script), W26HF (a `.then`-chained worker in `remoteTags.ts`) and
W22's `4aa010e`.

## Steps

1. Decide per loop whether order matters.
   - The `safe.directory` writes in `repositoryRecovery.ts` must stay
     sequential, one `git config --global --add` after another: parallel
     writes to the same config file race.
   - The probe and discovery loops each spawn `git` or read the file
     system per item. Keep them sequential, or bounded, rather than
     unbounded parallel. A workspace can hold many worktrees.
2. Add one small shared helper, for example
   `forEachSequential(items, fn)` or `mapSequential(items, fn)` in
   `src/backend/utils/`. It chains through `reduce` over promises, or
   through recursion, so there is no `await` in a loop. Unit-test it for
   order, early rejection and empty input, and use it at every
   order-sensitive site. Where order truly doesn't matter, and the count
   is bounded, `Promise.all` is fine.
3. Move `workspaceRoots`, `isInsideRoots` and `describe` to module scope.
   Pass in what they closed over.
4. No suppressions: no `NOSONAR`, no `biome-ignore`. Every existing test
   passes unchanged.

## Touch

`src/backend/utils/repositoryProbe.ts`, `src/extension/repositoryRecovery.ts`,
`src/extension/worktreeDiscovery.ts`, `src/extension/repoManager.ts`, one new
helper module under `src/backend/utils/` with its test, `tests/**` (only for
the helper)

## Acceptance

- The integrator's rescan shows none of the 13 findings, and the quality
  gate is `OK`.
- The trust writes stay sequential.
- Every existing test passes unchanged.

## Report

Not started.
