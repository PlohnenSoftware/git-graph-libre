---
summary: >-
  W05 · wave A · ready · webview · ~20 lines: issue #45's confirmed bug.
  Checking out a remote branch pre-fills the local name with the last `/`
  segment (`origin/feat/admin-gui` becomes `admin-gui`); use the existing
  `parseRemoteBranchName()` instead, which knows the remotes, with the full
  ref name as the fallback. Diagnosed by `cktgh`, reported by `rbalet`.
---

# W05 — Suggest the full branch name for a remote checkout

Status: done — awaiting integration
Needs: —
Decisions: —
Kind: webview · Size budget: ~20 changed lines outside tests
Source: issue #45, `cktgh`'s comment of `2026-11-03`; Issue #45: checking
out a remote branch whose local branch exists, under Open GitHub issues

## Goal

Pre-fill the local name Git would use: `origin/feat/admin-gui` suggests
`feat/admin-gui`. Today the misnamed branch it creates (`admin-gui`) later
blocks the next checkout of the same remote branch with "a branch named
'admin-gui' already exists".

## Facts (checked `2026-11-04`, `c47207e`)

- `checkoutBranchAction()` (`src/webview/main.ts:5326`) pre-fills
  `refName.split("/").at(-1) ?? refName` (`:5335`, `:5339`).
- `parseRemoteBranchName(refName, remoteNames)` (`src/webview/refLabels.ts:16`)
  tries the known remote names longest first, so it handles a `/` in both
  the remote's name and the branch's. The remote-branch context menu already
  uses it (`main.ts:4091`).

## Steps

1. In `checkoutBranchAction()`, pre-fill
   `parseRemoteBranchName(refName, this.getRemoteNames())?.branchName ?? refName`.
2. Tests (webview):
   - `origin/feat/admin-gui` suggests `feat/admin-gui`;
   - a remote named `my/fork` with `my/fork/topic` suggests `topic`;
   - a ref matching no known remote takes the documented fallback;
   - a slash-free name, `origin/main`, still suggests `main`.
3. `CHANGELOG.md`, `[Unreleased]`, under Fixed: credit `@cktgh` for the
   diagnosis and `@rbalet` for the report.

## Touch

`src/webview/main.ts` (`checkoutBranchAction` only), a webview test file for
it, `CHANGELOG.md`

## Acceptance

The four cases pass, and no other checkout behavior changes. The collision
itself (the local branch exists) is W24.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:01
- **Branch and commits:** `wt-1.10.0/W05` — `9787c51 G docs(checkout): claim W05 slice (suggest the full branch name)`; `0d91d1f G fix(checkout): suggest the full branch name for a remote checkout (W05)`; `74bd7a1 G docs(changelog): note the full branch name suggestion for remote checkouts (W05)`; this report commit follows.
- **Files changed:** `src/webview/main.ts` +9/−2 (`checkoutBranchAction` only); `tests/webview/checkoutRemoteBranchName.test.ts` +172 (new); `CHANGELOG.md` +10; this slice file (claim, report, status).
- **Tests added or changed:** new file `tests/webview/checkoutRemoteBranchName.test.ts`, 4 tests: `origin/feat/admin-gui` gives `feat/admin-gui`; `my/fork/topic` with a `my/fork` remote gives `topic`; `upstream/topic` with no matching remote keeps the full name; `origin/main` gives `main`. Before the fix, the first and third failed (`admin-gui`, `topic`); the second already passed by accident, since the old last-segment code also gives `topic`. Webview count 791 before, 795 after. Backend unchanged.
- **Gates:** biome strict (`--error-on-warnings`) on `src/webview/main.ts` and the new test file: exit 0, no findings (the run prints a pre-existing config-schema notice, `biome.strict.jsonc` says 2.5.13, CLI is 2.6.3); typecheck exit 0; test backend 1144 passed / 1204 (60 skipped); webview 795/795; l10n n/a (no user-visible string added); kb:check exit 0; Rust arm n/a (no `engine/**` change); Sonar: integrator.
- **Acceptance:** the four cases pass (met); no other checkout behavior changed (met, only the suggested name in the remote branch of `checkoutBranchAction` moved); the collision itself is left for W24 (met).
- **Deviations from the slice:** Step 1's literal code, `parseRemoteBranchName(...)?.branchName ?? refName`, does not produce the documented fallback. For an unknown remote the function returns the first segment as the remote (not null), so `feat/admin-gui` with no known remotes would still suggest `admin-gui`. The fix trusts the parse only when `parsed.remote` is a configured remote, otherwise uses the full ref name. `refLabels.ts` is untouched. Possible follow-up: the same first-segment guess exists in `parseRemoteBranchName` for its other callers; left alone as out of this slice's scope.
- **Open questions / follow-ups:** none blocking. Backend skipped count (60) was recorded as the run reported it; I did not check it against the base commit. The engine binary copied from the main checkout was used only for the local run (gitignored, not committed).
