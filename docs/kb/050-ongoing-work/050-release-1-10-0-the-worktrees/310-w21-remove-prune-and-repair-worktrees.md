---
summary: >-
  W21 · wave D · needs W10, W20, Y5 · TypeScript + webview · ~280 lines:
  issue #38. Worktree removal on the CLI: plain `git worktree remove`, with
  `--force` only after a second confirmation that names the files it
  deletes; a locked worktree is unlocked first, never `-f -f`. Remove a stale
  entry; Repair a moved one; Prune with a preview. Offered from the Delete
  Branch dialog; the worktree list (W30) adds its own entry points. Engine
  handles are closed.
---

# W21 — Remove, prune and repair worktrees

Status: done — awaiting integration
Needs: W10, W20
Decisions: Y5 (the removal and force policy)
Kind: TypeScript and webview, l10n · Size budget: ~280 changed lines outside
tests
Source: issue #38 (agents' leftover worktrees); Issue #38: remove a leftover
worktree that blocks a branch, under Open GitHub issues; Git worktree
behavior, verified (Lifecycle)

## Facts

- `git worktree remove` refuses a worktree with local changes ("contains
  modified or untracked files, use --force"). `--force` deletes them for
  good.
- A locked worktree refuses even one `-f`.
- `remove` succeeds on a worktree whose folder is gone.
- `prune -n -v` previews.
- `repair <new path>` fixes a worktree moved by hand, and pruning it instead
  would strand it.
- New actions run through the selected repository's git instance
  (`src/backend/gitClient.ts`). `git worktree` commands work from any
  worktree of the same repository, so no `-C` is needed.
- Design rule 5: whatever removes a repository from the workspace closes its
  engine handle (`closeEngineRepository`, `src/extension/repoManager.ts:50`).

## Steps (as recommended; Y5 may change them)

1. Backend, new `src/backend/actions/worktree.ts` with `runGitRaw` actions:
   - `removeWorktree { path, force }`;
   - `pruneWorktrees {}`;
   - `repairWorktree { path }`.

   Add a read-only `previewPruneWorktrees` that parses `git worktree prune
   -n -v`, plus their payload types and error labels (`actionErrorLabels`).
2. **Delete Branch** for a branch checked out elsewhere (W20 shows the
   fact): an unchecked option, "Also remove the worktree at <path>". Submit
   removes the worktree, then deletes the branch.
3. **Refused for local changes:** a second dialog, "Delete the worktree
   anyway? Uncommitted and untracked files in <path> are deleted
   permanently", runs `--force`. For a locked worktree, say so with its
   reason and offer Unlock (W23). Never `-f -f`.
4. **A prunable entry** (its folder is missing): offer "Remove Stale Entry",
   with no data-loss warning since nothing on disk is lost, and "Repair…",
   which opens a folder picker for the moved location and runs `repair`.
5. **"Prune Stale Worktrees…"**: the confirmation lists `prune -n -v`'s
   preview, then prunes. Its entry point is the worktree list (W30), and,
   if Y5 says so, the Command Palette.
6. After a removal, prune or move: `removeRepo(path)` for any known
   repository at that path, which closes its engine handle, then refresh.
7. Tests (temporary fixtures only, the protocol's worktree rule 1):
   - clean remove;
   - dirty remove refused, then forced;
   - locked refused;
   - stale entry removed;
   - moved worktree repaired;
   - the prune preview;
   - a known repository's handle closed.
8. l10n in all five bundles. `CHANGELOG.md` credits `@rbalet`.

## Touch

`src/backend/actions/worktree.ts` (new), `src/backend/types/actions.types.ts`,
`src/extension/messageHandler.ts` (registration, `removeRepo` on success),
`src/webview/main.ts` (the delete dialog, the confirmations,
`actionErrorLabels`), l10n files, `tests/**`, `CHANGELOG.md`

## Acceptance

No path removes local work without the second confirmation. A locked
worktree is never forced. Stale entries and moved worktrees each have their
safe action, and handles are closed.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-11-05. Branch `wt-1.10.0/W21`.
- **Commits:** claim `22e6c94`; `b94fece` backend actions, types, handler wiring, l10n bundles, backend and handler tests; `e965e44` webview (Delete Branch removal, confirmations, branch-menu items), `webviewL10n.ts`, webview tests, changelog; this report commit.
- **What happens:**
  - Clean: Delete Branch on a branch held by a linked worktree has an unchecked "Also remove the worktree at <path>". Ticked: the worktree's files are read (bounded `git -C <path> status --porcelain -z`, at most 20 paths); none, so `worktree remove` (no force) runs, then the branch is deleted.
  - Dirty: a second dialog lists the uncommitted and untracked files (and says more exist) and says they are deleted permanently; only its confirm sends `--force`. An unreadable status still sends no force, so Git's own refusal is the guard.
  - Locked: the dialog says it is locked (with the reason) and will be unlocked first; the backend refuses a locked worktree unless `unlock` is set, then runs `worktree unlock` and `remove`. Never `-f -f`, never `--force` implied by unlock.
  - Stale (folder gone): removed with plain `remove`, no read and no warning ("nothing on disk is deleted"). Branch menu: Remove Stale Worktree Entry.
  - Moved: branch menu Repair Worktree… opens a folder picker (`showOpenDialog`) and runs `worktree repair <folder>`; success is checked against the worktree list (the old path must no longer be stale), otherwise a localized error. A cancelled picker changes nothing.
  - Prune: branch menu Prune Stale Worktrees… (shown only while a stale, unlocked entry exists) previews the entries and then runs `worktree prune`. Locked stale entries are neither previewed nor pruned.
  - The main worktree and the worktree the graph shows are refused by the backend; the main worktree keeps W20's explain-only dialog.
  - After remove or prune: `closeEngineRepository(path)` for every removed path and `removeRepo` for any known repository at that canonical path, then the repo list is re-sent.
- **Decisions from the list, not messages:** the prune preview is the list's `prunable` entries without `locked` (tested equal to the count `prune -n -v` reports), not a parse of `prune -n -v` text.
- **Gates:** strict Biome on touched files clean; typecheck clean; `pnpm run test`: backend 1254 passed, 60 skipped of 1314; webview 851 of 851; no "Unhandled Errors"; `l10n:check` 100% in all four locales. Sonar: integrator.
- **l10n:** 29 keys in all five bundles, real translations for nl, pl, zh-cn, zh-tw (machine-written by the agent, worth a native glance).
- **Deviations / follow-ups:**
  - Command Palette "Prune Stale Worktrees": not done. The Touch list does not name `package.json` or `package.nls*`, so it is a follow-up (a command plus nls strings; the webview dialog and `pruneWorktrees` action exist).
  - W30 (worktree list) does not exist yet, so the entry points are the Delete Branch dialog and the local branch menu.
  - Outside the Touch list: `src/backend/types/queries.types.ts` (the `worktreeChanges` query the confirmation needs), `src/extension/webviewL10n.ts` (the pattern requires it), `src/extension/messageHandler.ts` also registers the query and the folder picker; the status read lives in `worktree.ts` instead of a new queries file.
  - Existing W20 test "explains instead of deleting" now uses the main-worktree case (the linked case became the removal dialog); nothing loosened.
  - A removal that unlocked a worktree but then failed leaves it unlocked.
- **Open questions:** none blocking.
