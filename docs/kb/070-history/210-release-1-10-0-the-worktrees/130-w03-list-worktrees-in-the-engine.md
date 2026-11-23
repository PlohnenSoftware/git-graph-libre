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

Status: integrated `f9e54a4` (`2026-11-05`)
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

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05 18:20
- **Branch and commits:** `wt-1.10.0/W03` —
  `8845fac G docs(worktrees): claim W03`,
  `3316de1 G feat(engine): list worktrees in the engine (W03)`,
  `727fb30 G test(engine): worktree list parity and declines (W03)`,
  `3909589 G feat(engine): read the worktree list through the engine (W03)`,
  `4c09432 G test(engine): worktree reader routing and parity with the CLI (W03)`
- **Files changed:** `engine/native/core/src/worktrees.rs` (+247, new),
  `engine/native/core/src/lib.rs` (+1), `engine/native/node/src/lib.rs` (+13/−3),
  `engine/native/core/tests/worktrees.rs` (+355, new),
  `src/backend/engine/addon.ts` (+10), `src/backend/engine/worktrees.ts` (+141, new),
  `tests/backend/engine/worktrees.test.ts` (+283, new)
- **Tests added or changed:** Rust 14 in `tests/worktrees.rs` (engine suite 196 to 210);
  TypeScript 24 in `tests/backend/engine/worktrees.test.ts` (backend project 1234 to 1258).
- **Gates:** biome strict clean on the touched TS; typecheck clean; test backend 1258/1258 and webview 802/802, none skipped (engine built, `diff-wasm` copied read-only); l10n n/a; kb:check clean; Rust arm: fmt, clippy `-D warnings`, check, test (210 passed) all clean, then `engine:build` and `engine:smoke` (1.0.26) OK; Sonar: integrator
- **Acceptance:** parity identical on every fixture (main, linked, detached, locked with and without a reason, space and non-ASCII names, mixed case, symlinked path, bare main with linked worktrees, `core.ignorecase`, unborn linked branch), listed from the main, a subdirectory and a linked worktree: met. Declines land on the CLI (below): met. An older binary without the export loads and uses the CLI (`noListWorktrees` test): met.
- **Decline cases (each pinned):** a prunable entry (unlocked, `.git` gone); an admin entry with no `gitdir` file; a stray non-directory in `worktrees/`; a relative `gitdir`; a `gitdir` not ending in `/.git`; a HEAD symbolic outside `refs/heads/`; a git dir not named `.git` (`--separate-git-dir`); a submodule; non-UTF-8 ids, paths or lock files. Any engine error besides these routes to the CLI as `engineThrew`.
- **Findings against the record:** Git 2.56 does not list an admin entry with no `gitdir` file at all (the Git worktree behavior record says prunable); the engine declines either way. Git sorts linked worktrees with `fspathcmp`, so `core.ignorecase=true` changes the order (ASCII case folding), which the engine copies. A locked worktree whose folder is gone is not prunable, and the engine answers it. Lock reasons are trimmed of space, tab, CR and LF on both sides. gix's own `lock_reason()` trims Unicode whitespace, so the engine reads the file itself. `git worktree add` sanitizes the admin id (`orphan wt` becomes `orphan-wt`). The unborn-branch HEAD prints the null id.
- **Deviations from the slice:** the engine reads `worktrees/` and each `gitdir`/`locked` file itself rather than through gix's `worktrees()`, which silently skips entries with no `gitdir` and sorts by admin dir. `malformedPayload` is a reason beyond the six the slice lists. No version bump, as instructed.
- **Open questions / follow-ups:** none.
