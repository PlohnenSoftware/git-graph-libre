---
summary: >-
  W25 · wave A · ready · TypeScript + webview · ~200 lines: issue #36.
  A read-only request at dialog open returns the branch's upstream remote and
  Git's own push remote (`%(push:remotename)`). The Push Branch dialog
  pre-checks that remote, ticks Set upstream only for a branch with no
  upstream, and stops `-u` on several remotes leaving the last one tracked.
---

# W25 — Push dialog defaults that follow Git

Status: done — awaiting integration
Needs: —
Decisions: Y11 (which defaults, and the several-remotes rule)
Kind: TypeScript and webview · Size budget: ~200 changed lines outside tests
Source: issue #36; Issue #36: push dialog default remote and Set upstream,
under Open GitHub issues (its checked facts and recommendations)

## Goal

The Push Branch dialog starts from what plain `git push` would do, so
pushing without changing anything changes nothing the user didn't ask for.

## Facts (checked `2026-11-04`, `c47207e`)

- `showPushBranchDialog()` (`src/webview/main.ts:4573`) pre-checks
  `defaultPushRemoteName()` (`origin`, else the first remote; `:4706`), and
  Set upstream is hardcoded `value: true` (`:4579`).
- `pushBranch()` (`src/backend/actions/branchRemote.ts:101`) adds
  `--set-upstream` to the push for every selected remote. With two, the
  upstream ends on the last one pushed (verified).
- `git for-each-ref --format='%(upstream:remotename)%00%(push:remotename)'
  refs/heads/<b>` gives the upstream's remote and Git's push remote, the
  latter after `branch.<b>.pushRemote` and `remote.pushDefault` (verified).
- The read-only request pattern to copy is D11's `resolveRef`
  (`src/backend/queries/resolveRef.ts`).

## Steps (as recommended; Y11 may change them)

1. A read-only request, `branchPushDefaults { repo, branch }`, returns
   `{ upstreamRemote: string | null, pushRemote: string | null }` from the
   `for-each-ref` above, labelled `branchPushDefaults.read`. It is CLI only:
   a dialog-time read needs no engine twin.
2. `showPushBranchDialog()` asks for it first, then opens the dialog. On an
   error, it falls back to today's defaults and logs the error.
3. Pre-check `pushRemote ?? upstreamRemote ?? (origin if present) ?? the
   first remote`.
4. Pre-check Set upstream only when `upstreamRemote` is null.
5. With more than one remote checked, `--set-upstream` applies to the
   pre-checked remote only. Alternatively, Y11 may choose to lock the box
   with a reason while several remotes are checked.
6. Tests:
   - backend: no configuration; `remote.pushDefault`;
     `branch.<b>.pushRemote`; no upstream; a branch name containing `/`;
   - webview: the dialog's defaults in each case;
   - action: only one push carries `-u` when two remotes are chosen.
7. `CHANGELOG.md`, `[Unreleased]`: credit `@cktgh`.

## Touch

`src/backend/queries/branchPushDefaults.ts` (new),
`src/backend/types/queries.types.ts`, `src/extension/messageHandler.ts` (the
request), `src/webview/main.ts` (`showPushBranchDialog`,
`remoteCheckboxInputs`), `src/backend/actions/branchRemote.ts` (the `-u`
rule), tests, `CHANGELOG.md`

## Acceptance

Each case's defaults match plain `git push`, and `-u` never lands on more
than one remote. The tag and all-tags push dialogs are unchanged.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:11 (claim); report written after the gates
- **Branch and commits:** `wt-1.10.0/W25`, base `6b0e232`
  - `e8952b0 G docs(push): claim W25, push dialog defaults that follow Git (W25)`
  - `8d9d705 G feat(push): read a branch's upstream and push remote (W25)`
  - `e877a5d G fix(push): set upstream on the first remote only (W25)`
  - `f0f0513 G feat(push): open Push Branch from Git's push defaults (W25)`
  - the report commit that adds this section follows these four
- **Files changed (vs `6b0e232`, 11 files, +522/−10):** `src/backend/queries/branchPushDefaults.ts` (new, +55); `src/backend/types/queries.types.ts` (+13); `src/extension/messageHandler.ts` (+13); `src/backend/actions/branchRemote.ts` (+7/−2); `src/webview/main.ts` (+83/−4); `CHANGELOG.md` (+9); this slice file; tests: `tests/backend/queries/branchPushDefaults.test.ts` (new, +152), `tests/backend/actions/branchRemote.test.ts` (+19/−2), `tests/webview/rendering.test.ts` (+162), `tests/webview/messageHandler.test.ts` (+17). Code outside tests is about 170 lines, within the ~200 budget.
- **Tests added or changed:** new backend file with 9 tests (no configuration; upstream only; `remote.pushDefault`; `branch.<b>.pushRemote`; no upstream and no push default; a slash in the name; a prefix-named branch not matched; a missing branch; a non-repository error; the recorded label). Backend `branchRemote`: the existing two-remote test now expects `-u` on the first remote only (it encoded the bug), and a new test pins `-u` on one remote of three. Webview: 7 new rendering tests (push-remote pre-check, upstream-remote pre-check, no-upstream defaults, `-u` on the first listed remote, `-u` moved when the pre-checked one is unchecked, failed read keeps today's defaults, stale reply ignored); the existing push-menu test now answers the request; 1 new message-handler route test. Counts: backend 1234 → 1244 total (1184 passed, 60 skipped); webview 802 → 810 total (810 passed). The "before" counts are derived from the test diff, not re-run on the base.
- **Gates:** biome (strict, `--error-on-warnings`) on the 6 backend and 3 webview touched files: exit 0; typecheck: exit 0; test backend 1184/1244 passed (60 skipped by existing platform, engine-build and WASM guards, none added here), webview 810/810; l10n:check 100% (no user-visible text added or changed); kb:check exit 0; Rust arm: n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:**
  - each case's defaults match plain `git push`: met. The pre-check is `pushRemote`, then the upstream's remote, then `origin`/first, each only if it is a repository remote. Tests cover each case.
  - `-u` never lands on more than one remote: met. The backend applies `--set-upstream` to `remotes[0]` only; the dialog lists the `-u` remote first.
  - tag and all-tags push dialogs unchanged: met. `remoteCheckboxInputs` keeps its old default when no default is passed; the tag dialogs do not pass one.
- **Deviations from the slice:**
  - Integrator rule for several remotes: `-u` goes to the pre-checked remote while it stays checked, otherwise to the first checked remote. To avoid changing the action payload (`src/backend/types/actions.types.ts` is not in the Touch list), the webview lists that remote first in `remotes`, and the backend applies `--set-upstream` to index 0 only. The contract is documented in the code comments on both sides.
  - The request is typed through `QueryPayloads` in `queries.types.ts`, so `src/types.ts` needed no change.
  - "Logs the error": the webview has no logger. A failed read is recorded by the git command record (`branchPushDefaults.read`, `success: false`), which `messageHandler` writes to the output channel. The dialog then keeps today's defaults.
  - The Push Branch dialog now opens after one round trip to the backend, not synchronously.
  - The CHANGELOG entry is in the `feat(push)` commit `f0f0513`, not a separate `docs` commit.
  - Option (c) of Y11 (a setting for Set upstream) is not implemented; (a) was answered.
- **Open questions / follow-ups:**
  - KB, for the integrator: the issue #36 subsection still says "Open"; the Phase 9 status line still lists the push-dialog defaults as open. Neither is in this slice's Touch list, so I did not edit them.
  - Verified slice facts at `6b0e232`: all line numbers matched (`main.ts` 4372, 4573, 4579, 4706; `branchRemote.ts` 101, 112; `resolveRef.ts` 39). No mismatch.
