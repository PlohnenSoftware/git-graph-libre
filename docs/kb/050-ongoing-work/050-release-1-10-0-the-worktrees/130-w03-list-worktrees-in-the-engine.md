---
summary: >-
  W03 · wave B · needs W01, W02 · Rust + TypeScript · ~250 lines:
  `list_worktrees`, an optional engine export that lists worktrees through
  gix and reads every sibling's HEAD through `worktrees/<id>/HEAD` without
  opening it, mapped into W02's `GitWorktree`, with a parity test against the
  CLI. It declines to the CLI whenever gix cannot answer exactly as Git
  (missing `gitdir`, prunable entries).
---

# W03 — List worktrees in the engine

Status: ready once W01 and W02 are integrated
Needs: W01, W02
Decisions: —
Kind: Rust and TypeScript, the Rust arm applies · Size budget: ~250 changed
lines outside tests
Source: Engine changes for worktrees; Phase 18's slice 18.1

## Goal

The worktree list costs no spawn when the engine is available, and it is
provably the same list Git gives.

## Read first

- Engine changes for worktrees: the gix API, its gaps against Git, and the
  trust rule for siblings
- D43 — Engine export for the staged copy of a file: the optional-export
  pattern (`loadIndexFile?`, left out of `isEngineAddon` and
  `REQUIRED_EXPORTS`)
- `src/backend/engine/stagedFile.ts`: the reader shape (engine, then the CLI,
  with a logged reason)
- `tests/backend/engine/parity.test.ts` (about `:1486`–`:1518`): the parity
  pattern

## Steps

1. Core crate, new module `worktrees.rs`:
   - Build the main entry from `kind()`, the common dir and its HEAD (or
     `bare`). Build the linked entries from `worktrees()`, sorted the way
     `git worktree list` sorts them (by path), and check that order on
     non-ASCII paths.
   - Read each sibling's HEAD with `find_reference("worktrees/<id>/HEAD")`.
     **Never** open a sibling with `into_repo*()` or `main_repo()`: they
     inherit this handle's trust options (Engine changes for worktrees,
     Trust).
   - Read the lock reason as Git prints it. Trim and newline rules are
     settled by the parity test, not by guessing.
   - Return `Error::unsupported` (a decline) when any admin entry has no
     `gitdir` file, or when an entry is prunable. Git's reason text has
     several wordings, and the CLI is the authority.
2. Node crate: `#[napi] pub async fn list_worktrees(path: String) ->
   Result<String>`, shaped like `load_index_file`.
3. TypeScript:
   - `listWorktrees?(repoPath)` in `addon.ts`, optional and outside the
     required shape check;
   - a reader in `src/backend/engine/worktrees.ts` that tries the engine,
     then W02's `loadWorktrees`, logged through `logBackendRoute` with
     reasons `setting`, `unverified`, `engineUnavailable`, `noListWorktrees`,
     `declined` and `engineThrew`;
   - strict payload parsing into `GitWorktree`.
4. Tests:
   - Rust unit tests;
   - a parity test over W02's fixtures (main plus linked, detached, locked
     with a reason, paths with a space and non-ASCII, bare main with linked
     worktrees), asserting identical lists;
   - the decline cases (prunable; no `gitdir`), asserting the CLI answered.
5. No engine version bump: the export is optional and feature-detected.

## Touch

`engine/native/core/src/worktrees.rs` (new), `engine/native/core/src/lib.rs`
(module), `engine/native/node/src/lib.rs`, `engine/native/core/tests/**`,
`src/backend/engine/addon.ts`, `src/backend/engine/worktrees.ts` (new),
`tests/backend/engine/**`

## Acceptance

Parity is identical on every fixture, the declines land on the CLI, and an
older binary without the export loads and uses the CLI.

## Report

Not started.
