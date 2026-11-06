---
summary: >-
  W34F · wave E · ready · webview + l10n · ~40 lines: W34's step 2, left out
  because it needs l10n strings while another slice held that slot. In the
  Settings popup's Repository tab, when the repository has linked
  worktrees, add one note that Git's own settings (remotes, user, config)
  apply to all of them.
---

# W34F — Repository-tab note for worktrees

Status: claimed by Claude Haiku 5.5 on 2026-11-06 15:31
Needs: W34 (integrated `a9d58f2`), W32 (the worktree layout)
Decisions: Y18 (a)
Kind: webview and l10n · Size budget: ~40 changed lines outside tests
Source: W34 — Share repository settings across worktrees, step 2

## Steps

1. In the Settings popup's Repository tab
   (`src/webview/settingsWidget.ts`), when the repository has linked
   worktrees, show one short note: Git's own settings (remotes, user,
   config) apply to every worktree of this repository. The repository list
   knows this from W10's worktree list or W32's layout, whichever already
   reaches the webview. Use existing note styling and theme tokens.
2. Add one l10n key in all five bundles, plus `src/extension/webviewL10n.ts`
   if the pattern requires it, with real translations where you can.
3. Tests: the note is shown with linked worktrees and hidden without them.

## Touch

`src/webview/settingsWidget.ts`, `src/webview/main.ts` (only to pass the
worktree fact, if needed), `src/extension/webviewL10n.ts`, the five
`l10n/bundle.l10n*.json`, `media/settings.css` (only if a style is
missing), `tests/**`

## Acceptance

The note is shown only for a repository with linked worktrees, and
`l10n:check` is at 100%.

## Report

Not started.
