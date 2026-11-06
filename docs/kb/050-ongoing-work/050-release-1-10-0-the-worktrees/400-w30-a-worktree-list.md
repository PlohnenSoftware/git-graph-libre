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

Status: done — awaiting integration
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

- **Agent / date:** Claude Sonnet 5.5, 2026-11-06. Branch `wt-1.10.0/W30`.
- **What was built:** a Worktrees toolbar button (`worktreesBtn`, always shown, Y3 (a)) opening a popup built in `src/webview/worktreeList.ts` (`WorktreePopup`, pure `renderWorktreeList`, `worktreeRowActions`). Rows show folder, path (tooltip and text), branch or "detached at <short hash>", and main, current, bare, locked (reason) and prunable badges, all from the `loadBranches` worktree list. Row buttons: Open in New Window, Open Here, Switch Graph, Copy Path (W31 messages), Remove… (confirmation, then W21's flow, which reads local changes and asks again before `--force`), Repair… and Remove Stale Entry for a prunable row (W21). Footer: Create Worktree… from HEAD (W22 dialog) and Prune Stale Worktrees… (W21 preview) while an unlocked entry is stale. Esc, the backing and the close button close it; the popup redraws when the list changes and closes on a repository switch.
- **Seam for W23:** `worktreeRowActions()` in `worktreeList.ts` decides each row's buttons from its listed state; W23 adds `lock`, `unlock` and `move` to `WorktreeRowAction`, `labels.actions`, that function, and `handleWorktreeRowAction()` in `main.ts`. Lock/Unlock/Move are not implemented.
- **Y20:** no local-changes display (W51's).
- **Deviations:** Remove asks a plain confirmation first (the list has no other dialog before W21's flow). Main, current and bare rows get no Remove; current gets no Open or Switch; a bare main gets no Switch (W33). The Touch list did not name `src/extension/webviewL10n.ts`; it is the pattern's required bridge for new strings. CSS went into `media/settings.css` (no new stylesheet, which would need `webviewHtml.ts`). The popup's elements are created by `worktreeList.ts`, not `webviewHtml.ts`. No changelog entry (outside Touch).
- **l10n:** 15 new keys in all five bundles; nl, pl, zh-cn, zh-tw are the agent's own translations (worth a native glance).
- **Gates:** strict Biome on touched files clean; typecheck clean; `pnpm run test`: backend 1341 of 1341, webview 913 of 913, no "Unhandled Errors"; `l10n:check` 100% in all locales. Sonar: integrator. Renders (light and dark, PyQt6 headless, real CSS): `/tmp/claude-1000/w30-renders/{light,dark}.png`, not committed.
- **Open questions:** none blocking.
