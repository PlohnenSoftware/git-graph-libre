---
summary: >-
  W30 · wave E · needs W10, W21, W31, Y3 · webview + l10n · ~280 lines: one
  place that shows the repository's worktrees and acts on them. Each entry
  shows its folder, path, branch or detached HEAD, and its main, current,
  locked, prunable or bare state, with Open, Switch, Copy Path, Lock/Unlock,
  Move, Remove and Repair; plus Create Worktree… and Prune Stale
  Worktrees…. Its form, a toolbar popup or a top-bar list, is decision Y3.
---

# W30 — A worktree list

Status: ready once W10, W21 and W31 are integrated
Needs: W10, W21 (removal handlers), W31 (open and switch)
Decisions: Y3 (the surface), Y20 (whether it shows local changes, via W51)
Kind: webview, CSS and l10n · Size budget: ~280 changed lines outside tests
Source: full worktree support; Phase 18's slice 18.3

## Steps (as recommended under Y3 (a))

1. A "Worktrees" toolbar button, shown when the repository has a linked
   worktree or always, per Y3, opens a popup in the Settings popup's style
   (with D50's pinned header). The rows come from W10's `gitWorktrees`.
2. **Each row:**
   - the folder name, with the full path in a tooltip and Copy Path;
   - the branch, or "detached at <short hash>";
   - badges for main, current, locked (with its reason) and prunable
     ("missing: moved or deleted"); a bare main shows as the repository
     itself.
3. **Row actions:**
   - Open in New Window, Open Here, Switch Graph (W31);
   - Lock or Unlock, Move… (W23);
   - Remove… (W21), and Repair… or Remove Stale Entry for prunable rows
     (W21).
4. **Footer:** Create Worktree… (W22, from HEAD), and Prune Stale
   Worktrees… (W21) when any row is prunable.
5. Keyboard access, like the existing popups, all strings in l10n, the
   styling guide's tokens, and headless renders.
6. Tests: rows for every state; actions wired to the right messages; the
   popup's open and close behavior.

## Touch

`src/webview/main.ts` (button, popup), a new `src/webview/worktreeList.ts`
(preferred, keeping `main.ts` from growing), `media/*.css`,
`src/extension/webviewToolbar.ts` (if the toolbar is built there), l10n
files, `tests/webview/**`

## Acceptance

Every worktree state Git reports is shown correctly, and every action is
reachable from the keyboard.

## Report

Not started.
