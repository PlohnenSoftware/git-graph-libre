---
summary: >-
  W34F · wave E · ready · webview + l10n · ~40 lines: W34's step 2, left out
  because it needs l10n strings while another slice held that slot. In the
  Settings popup's Repository tab, when the repository has linked
  worktrees, add one note that Git's own settings (remotes, user, config)
  apply to all of them.
---

# W34F — Repository-tab note for worktrees

Status: done — awaiting integration
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

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 15:31
- **Branch and commits:** `wt-1.10.0/W34F`
  - `3238093 G docs(worktrees): claim W34F, the Repository-tab note (W34F)`
  - `29a8a7d G feat(settings): add the Repository-tab worktree note string (W34F)`
  - `ea6d71b G feat(settings): note on the Repository tab when worktrees are linked (W34F)`
  - `cfa2fb5 G test(settings): the Repository-tab worktree note, shown and hidden (W34F)`
  - this report commit, `G docs(worktrees): report W34F, the Repository-tab note (W34F)`
- **Files changed** (`git diff --stat 34e838d..HEAD`, insertions plus deletions): `src/webview/settingsWidget.ts` (+10 −1); `src/webview/main.ts` (+2); `src/extension/webviewL10n.ts` (+1); `media/settings.css` (+2 −1, selector list only); `l10n/bundle.l10n.json`, `.nl`, `.pl`, `.zh-cn`, `.zh-tw` (+1 each); `tests/webview/settingsWidget.test.ts` (+19 −1); `tests/webview/settingsWidgetActions.test.ts` (+38 −2). This slice file (status and report). Source outside tests is 16 changed lines.
- **Design:** `main.ts` passes `hasLinkedWorktrees: this.gitWorktrees.length > 1`, from the worktree list W10 already loads, so no new data or request. The note is a `<p class="settingsRepoNote">` at the top of the Repository tab, and it shares the contributors note's existing style through the selector list. No new color.
- **Tests added or changed:** 4 new, 0 before. `settingsWidget.test.ts`: shown with `hasLinkedWorktrees`, hidden without. `settingsWidgetActions.test.ts`: a `loadBranches` response with a linked worktree shows the note in the Repository panel, and one with only the main worktree does not (`it.each`, 2 cases). The `render` and `bootWithSettingsOpen` helpers gained parameters that default to the old behavior.
- **Gates:**
  - Strict Biome with `--error-on-warnings`, exit 0, on all 7 touched TS/JSON files checked one at a time (`settingsWidget.ts`, `main.ts`, `webviewL10n.ts`, both test files, and the five bundles in one call). The CLI prints the known config-schema version notice (CLI 2.6.3 vs 2.5.13), which predates this slice.
  - `pnpm run typecheck`: clean (exit 0).
  - `pnpm run test`: backend 1366 passed, 60 skipped, of 1426 (109 files); webview 979 of 979 (76 files). No "Unhandled Errors". The 60 skips are existing guards in other files. The engine binary was present (`engine/native/linux-x64/git-graph.node`), so no rebuild was needed.
  - `pnpm run l10n:check`: 100% in all five bundles, "All translations are complete" (exit 0).
  - Sonar: integrator.
- **Acceptance:**
  - The note is shown only for a repository with linked worktrees: met (the widget test and the actions test, both sides).
  - `l10n:check` at 100%: met.
- **Deviations from the slice:**
  - `main.ts` and `media/settings.css` were touched, both within the Touch list. The CSS change extends the existing `.settingsContributorsNote` rule to `.settingsRepoNote`, so no new style is defined.
  - The `hasLinkedWorktrees` rule counts entries in the worktree list, so a bare repository with a linked worktree also counts as having linked worktrees. That matches the rule in the slice.
- **Open questions / follow-ups:**
  - The translations for nl, pl, zh-cn and zh-tw are my own and have not been reviewed by native speakers. The English is: "Git settings on this tab (remotes, user details and config) apply to every worktree of this repository."
  - The note's position (top of the tab, above General) is a judgment call. Say if it should move to the bottom.
  - The worktree list is held per current repository, so the note depends on the list having loaded. Until `loadBranches` returns, the note stays hidden, which is the intended fallback.
