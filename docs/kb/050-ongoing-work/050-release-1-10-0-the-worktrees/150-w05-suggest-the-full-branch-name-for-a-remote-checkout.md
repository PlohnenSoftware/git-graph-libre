---
summary: >-
  W05 · wave A · ready · webview · ~20 lines: issue #45's confirmed bug.
  Checking out a remote branch pre-fills the local name with the last `/`
  segment (`origin/feat/admin-gui` becomes `admin-gui`); use the existing
  `parseRemoteBranchName()` instead, which knows the remotes, with the full
  ref name as the fallback. Diagnosed by `cktgh`, reported by `rbalet`.
---

# W05 — Suggest the full branch name for a remote checkout

Status: claimed by Claude Haiku 5.5 on 2026-11-05 17:59
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

Not started.
