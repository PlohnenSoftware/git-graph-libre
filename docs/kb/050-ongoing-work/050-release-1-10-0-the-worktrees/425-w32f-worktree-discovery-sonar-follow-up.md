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

Status: integrated `3b13162` (`2026-11-06`)
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

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-06 14:26
- **Branch and commits:** `wt-1.10.0/W32F` — `1c32b0a G` claim; `4ecfc86 G` test(utils): mapSequential helper and its test; `c3dd8ee G` refactor(worktrees): trust discovery and trust writes; `50854a8 G` refactor(worktrees): discovery placement and module-scope helpers; this commit: the report.
- **Files changed:** `src/backend/utils/sequential.ts` +27 (new); `src/backend/utils/repositoryProbe.ts` +28 −13; `src/extension/worktreeDiscovery.ts` +23 −19; `src/extension/repoManager.ts` +8 −8; `src/extension/repositoryRecovery.ts` +4 −2; this slice file. Source total +132 −42, of which the new helper is 27 lines; the existing files change 105 lines (`git diff --numstat 5d697a4..HEAD`).
- **Tests added or changed:** added `tests/backend/utils/sequential.test.ts` (4 tests: empty input, order kept when later tasks settle first, one task at a time, first rejection stops the chain). No existing test changed. Backend passed 1310 before to 1314 after (the baseline was derived by subtracting the 4 new tests, not run on the base); skipped unchanged at 60.
- **Gates:** `pnpm run typecheck` exit 0; strict Biome (`biome.strict.jsonc`, `--error-on-warnings`) clean on all six touched files, exit 0; `pnpm run test` exit 0: backend 1314 passed, 60 skipped (1374), 106 files; webview 932 passed (76 files); no "Unhandled Errors"; Sonar: integrator.
- **Acceptance:**
  - The 13 findings, each by site (Sonar not run here; the integrator's rescan decides): repositoryProbe.ts `:219` gitdir reads → `mapSequential`; `:252`, `:255`, `:256`, `:258` in `untrustedSiblingEntries` → a sequential dedupe, then `mapSequential` over a new `siblingEntry` helper that holds the sharing check, the probe and the entry; repositoryRecovery.ts `:69` trust writes → `mapSequential`; worktreeDiscovery.ts `:165` canonical lookups in `dropUnlisted` → read together with `Promise.all` before a loop with no `await`; `:190` placement → placement collected in listing order, then `mapSequential`; `:207`/`:208` group loop → `mapSequential`; repoManager.ts `:118` `workspaceRoots` and `:122` `isInsideRoots` → module scope; worktreeDiscovery.ts `:120` `describe` → module scope (its `toSlashes` and `canonicalizePath` are module-level already).
  - Trust writes stay sequential: met. `confirmGitTrust` runs `mapSequential` over the entries, so each `git config --global --add` starts after the previous one settles.
  - Every existing test passes unchanged: met (full suite above; the only test file added is the helper's).
  - No `NOSONAR`, no `biome-ignore`, no config edits: met. Functions stay under cognitive complexity 16: the touched functions are smaller than before; the largest change is `applyListing`, now two loops and two calls.
- **Deviations from the slice:** (1) `untrustedSiblingEntries` gained a private `siblingEntry` helper so the per-folder checks can run through `mapSequential`; that is inside the restructure the slice asked for. (2) `listGroup`'s `await list(...)` inside its `for` loop is unchanged: it returns early on the first success, it was not one of the 13 findings, and a `mapSequential` would call every member, changing behavior. (3) `dropUnlisted` and the canonical reads in `applyListing` use `Promise.all` over one repository's worktrees (bounded, pure `realpath`), not a sequential map.
- **Open questions / follow-ups:** (a) `biome.strict.jsonc` declares schema 2.5.13 while the pinned CLI is 2.6.3, so Biome prints a "configuration schema version" note on every run. The checks still apply (a probe file with `var` was flagged `noVar`, exit 0 on clean files). I left the config alone (not in Touch); the maintainer may want to align it. (b) The 60 skipped backend tests sit in existing test files I did not change; I did not measure the skip count on the base. (c) The worktree's engine binary is 1.0.30 as dispatched; I did not run `pnpm run engine:build`, since this slice touches no engine code.
