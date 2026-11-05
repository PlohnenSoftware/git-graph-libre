---
summary: >-
  W25 · wave A · gated on Y11 · TypeScript + webview · ~200 lines: issue #36.
  A read-only request at dialog open returns the branch's upstream remote and
  Git's own push remote (`%(push:remotename)`). The Push Branch dialog
  pre-checks that remote, ticks Set upstream only for a branch with no
  upstream, and stops `-u` on several remotes leaving the last one tracked.
---

# W25 — Push dialog defaults that follow Git

Status: gated on Y11
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

Not started.
