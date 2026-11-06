---
summary: >-
  W33 · wave E · needs W32, Y17 · TypeScript + webview · ~120 lines (option
  a): the bare-clone-plus-worktrees layout that agent tools use. Show the
  bare repository as its worktrees' group header, so its linked worktrees
  belong together. Opening the bare repository's own graph, with no working
  tree, no uncommitted row and no checkout, is option (b), decision Y17.
---

# W33 — Bare repositories with worktrees

Status: claimed by Claude Haiku 5.5 on 2026-11-06 15:24
Needs: W32
Decisions: Y17 ((a) a group header only; (b) also a read-only graph of the
bare repository)
Kind: TypeScript and webview · Size budget: ~120 changed lines outside tests
for (a)
Source: Git worktree behavior, verified (the bare case); the probe's tests
already classify bare shapes (`tests/backend/utils/repositoryProbe.test.ts`)

## Facts

- `git worktree list --porcelain` lists a bare main repository first, as
  `worktree <path>` and `bare` with no HEAD.
- `git rev-parse --show-toplevel` fails in it, so discovery never opens it as
  a repository today.
- Every linked worktree's `--git-common-dir` is the bare repository.

## Steps for (a)

1. W32's grouping uses the bare common dir as the group's header, named after
   its folder. It is not selectable.
2. The worktree list (W30) shows the bare main record as "the repository
   (bare)", with no actions except Create Worktree….
3. Tests: grouping and list rows for a bare clone with two linked worktrees.

Option (b), if chosen, needs its own slice: every read and action would have
to work with no work tree, the uncommitted row and staging hidden, and
checkout and reset refused.

## Touch

`src/webview/settingsWidget.ts`, `src/webview/worktreeList.ts` (W30), `tests/**`

## Acceptance

A bare-clone layout reads as one repository with its worktrees.

## Report

Not started.
