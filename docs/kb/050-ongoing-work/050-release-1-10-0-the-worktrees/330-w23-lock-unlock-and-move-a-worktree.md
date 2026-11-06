---
summary: >-
  W23 · wave E · needs W21, W30 · TypeScript + webview · ~150 lines: Lock
  Worktree… (with a reason), Unlock, and Move Worktree… (a new path), from the
  worktree list and a branch's worktree marker. A locked worktree is never
  moved by force: unlock it first. After a move, the repository list follows
  the new path and the old engine handle is closed.
---

# W23 — Lock, unlock and move a worktree

Status: integrated `6a33321` (`2026-11-06`)
Needs: W21 (shared action file), W30 (entry points)
Decisions: —
Kind: TypeScript and webview, l10n · Size budget: ~150 changed lines outside
tests
Source: full worktree support; Git worktree behavior, verified (locked
worktrees refuse `move` and `remove` without `-f -f`)

## Steps

1. Actions in `src/backend/actions/worktree.ts`:
   - `lockWorktree { path, reason }` runs `git worktree lock [--reason]`;
   - `unlockWorktree { path }`;
   - `moveWorktree { path, newPath }`.
2. Move refuses a locked worktree in the UI: say why and offer Unlock. A
   move into a path that exists is refused before Git runs.
3. After a move: `removeRepo(old)`, which closes its handle; then add the new
   path if the old one was known; then refresh. Moving the worktree this
   window has open is offered only with a warning that the window's folder
   moves, or is not offered at all. That choice is noted in the report.
4. Tests (temporary fixtures):
   - lock with and without a reason, and its display through W10;
   - unlock;
   - a clean move;
   - a move of a locked worktree refused;
   - the repository list following the moved path.

   Then l10n.

## Touch

`src/backend/actions/worktree.ts`, `src/backend/types/actions.types.ts`,
`src/extension/messageHandler.ts`, `src/extension/repoManager.ts` (only the
path follow-up, if needed), `src/webview/main.ts`, l10n files, `tests/**`

## Acceptance

A lock shows up with its reason. A move updates everything that knows the
path, and leaves no handle open on the old one.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 14:43. Branch `wt-1.10.0/W23`, from `b63be4b`.
- **Branch and commits** (all `G`; the last line is this report):
  - `099bfa8 G docs(worktrees): claim W23, lock, unlock and move a worktree (W23)`
  - `0be6540 G feat(worktrees): lock, unlock and move a worktree on the CLI (W23)`
  - `86068a4 G test(worktrees): cover lock, unlock and move on temporary fixtures (W23)`
  - `79354e5 G test(worktrees): drop an unused fixture value in the lock case (W23)` (Biome found it after `86068a4`)
  - `41af0a3 G feat(worktrees): lock, unlock and move from the Worktrees popup and a branch (W23)`
  - `925beee G test(worktrees): cover the popup's lock, unlock and move (W23)`
  - `08646e4 G test(worktrees): cover lock, unlock and move through the message handlers (W23)`
  - this report commit
- **Files changed** (`git diff --stat b63be4b..HEAD`, +/−): `src/backend/actions/worktree.ts` +100; `src/backend/types/actions.types.ts` +16/−6 (a misplaced doc block moved); `src/extension/messageHandler.ts` +36; `src/extension/webviewL10n.ts` +13; `src/webview/main.ts` +114; `src/webview/worktreeList.ts` +24/−6; `l10n/bundle.l10n{,.nl,.pl,.zh-cn,.zh-tw}.json` +24 each; tests: `tests/backend/actions/worktree.test.ts` +181, `tests/webview/worktreeHandlers.test.ts` +88/−1, `tests/webview/worktreeList.test.ts` +29/−2, `tests/webview/worktreeListPopup.test.ts` +88. Non-test source and l10n: +423/−12, above the ~150-line guide; not split.
- **Tests added or changed:** backend `worktree.test.ts` 17 → 29 (12 new: lock with and without a reason, a dashed reason, refusals of main and already-locked, graph-shows lock, unlock and its refusal; clean move with a space and an accent, locked move refused then done after unlock, no-reason locked move, existing and listed targets, main/current/stale refusals, empty folder). Webview: 11 new cases across `worktreeList.test.ts` (row table, labels, `lifecycleRowActions`), `worktreeListPopup.test.ts` (lock, move, locked-move explanation, unlock) and `worktreeHandlers.test.ts` (lock/unlock through Git's `-z` list, move follow-up, unknown worktree, refused locked move). Before/after totals for the full suite were not measured on this base.
- **Gates:**
  - strict Biome (`--error-on-warnings`) on the 10 touched TS files: exit 0;
  - `pnpm run typecheck`: exit 0;
  - `pnpm run test`: backend 106 files, 1389 passed; webview 76 files, 948 passed; no "Unhandled Errors";
  - `pnpm run l10n:check`: 100% for nl, pl, zh-cn, zh-tw;
  - `pnpm run kb:check`: exit 0;
  - Sonar: integrator.
- **Acceptance:**
  - *A lock shows up with its reason:* met. The backend reads the reason through `loadWorktrees`, and the popup's existing badge shows `locked: <reason>`. Covered by the backend and handler tests.
  - *A move updates everything that knows the path, and leaves no handle open on the old one:* met for the repository list and the engine handle. A move that succeeds calls `removeRepo(old)` (which closes its handle) and `setRepoState(new)` for a known repository, closes the old path's handle even when it was unknown, and re-sends the list. The branch markers refresh through the graph refresh that follows a successful response. Covered by the handler tests. Not checked in a live VS Code window.
- **How lock, unlock and move behave:**
  - *Lock:* refuses the main worktree and an already-locked one, from the list, before Git runs. An empty or missing reason locks without one. The reason goes in as one `--reason=` argument, with `--` before the path. Locking the worktree the graph shows is allowed, because Git allows it (the test asserts it).
  - *Unlock:* refused from the list when the worktree is not locked. Unlock from a row is direct, with no confirmation.
  - *Move:* refuses the main worktree, the worktree the graph shows (no Move button is offered for it), a stale entry, a target path that exists (empty or not), a path already listed, and an empty folder. A locked worktree is never moved: the row's Move explains the lock and offers Unlock only; after Unlock the user chooses Move again, nothing moves on its own.
  - *Entry points:* the popup rows (`lifecycleRowActions` / `worktreeRowActions`), and the branch menu for the worktree that holds the branch (non-stale, non-main).
- **Deviations from the slice:**
  - *Files outside Touch:* `src/webview/worktreeList.ts` and `src/extension/webviewL10n.ts` are outside the Touch list. They went into `41af0a3` with `src/webview/main.ts` instead of their own commit. I did not rewrite history to split them; flagged here.
  - *CHANGELOG.md:* not in the Touch list, so no `[1.10.0]` line. The integrator adds it.
  - *New path:* a text field in the dialog (the Create Worktree folder pattern), not a folder or save picker. No host-side picker was added.
  - *Branch marker:* the Lock, Unlock and Move items are in the branch's menu, which the summary allows. The W11 marker itself is unchanged.
  - *Stale rows:* no Unlock on stale rows. Remove Stale Worktree Entry still unlocks first, as W21 does.
  - *Doc fix:* the `removeWorktree` doc comment sat above `addWorktree` in `actions.types.ts`; moved back.
  - *Git probes:* no `git worktree` probe was run outside a fixture, per the protocol. Each refusal is decided from the list, and the behaviour above is what the fixture tests show.
- **Open questions / follow-ups:**
  - Should an existing empty folder be a valid move target? The slice says a path that exists is refused, so I refuse it. Changing that means editing `assertMovable`.
  - A relative new path is passed to Git unchanged, as Create Worktree does. It is not checked to be absolute.
  - The nl, pl, zh-cn and zh-tw strings are my own translations; a native read would help.
  - Git quotes non-ASCII in non-`-z` porcelain output (`locked "keep \303\251"`). The app reads `-z`, so this does not affect it.
  - The change is not run in a VS Code window; the gates above are the evidence.
