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

Status: gated on Y5
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

Not started.
