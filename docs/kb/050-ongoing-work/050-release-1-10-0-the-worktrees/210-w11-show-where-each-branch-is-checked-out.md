---
summary: >-
  W11 · wave C · needs W10, Y4 · webview + l10n · ~220 lines: issue #37's
  core. A branch checked out in another worktree gets a worktree marker on
  its badge. Its tooltip and context-menu header name the worktree's folder
  and path, and whether it is locked or prunable. The current worktree's
  branch keeps today's markers. OKLCH tokens, all five languages, headless
  renders.
---

# W11 — Show where each branch is checked out

Status: ready once W10 is integrated
Needs: W10
Decisions: Y4
Kind: webview, CSS and l10n · Size budget: ~220 changed lines outside tests
Source: issue #37 ("It would be handy to see which branches are checked out
where"); Phase 18's slice 18.2

## Facts (checked `2026-11-04`, `c47207e`)

- `renderCommitRefs()` and `groupCommitRefs()` (`src/webview/main.ts:4938`–`:4961`,
  `src/webview/refLabels.ts:36`–`:68`) group local and remote refs and put
  the active branch first.
- `renderCommitRef()` emits `.gitRef.<type>[.active][.signed]`
  (`main.ts:4962`–`:4972`). "Active" is the head ref named `gitBranchHead`.
- The signed-tag badge (`media/refs.css:85`–`:116`, `.gitRefSignedBadge`) is
  the template for a small segment inside a badge.
- The HEAD marker is a `commitHeadDot` on the HEAD row
  (`main.ts:4793`, `:4810`; `media/commit-details.css:480`) plus a hollow
  node from `setCurrent()` (`src/webview/graph.ts:292`–`:294`).
- No octicon is a worktree. The candidates the package ships:
  `file-directory`, `repo-clone`, `stack`, `versions`,
  `file-directory-symlink` (W11 adds the chosen one through
  `pnpm run icons:generate`).

## Steps

1. For each head ref in W10's `branch → worktree` map, render a worktree
   segment per Y4, for example `.gitRefWorktree` with the chosen octicon,
   built like `.gitRefSignedBadge`. Use VS Code tokens first and OKLCH
   fallbacks (Webview UI Styling Guide).
2. The tooltip, and the context menu's header, say "Checked out in worktree
   <folder>" with the full path, plus "locked: <reason>" or "missing (moved
   or deleted)" for a prunable entry. A branch checked out twice
   (`--ignore-other-worktrees`) lists both.
3. Add every string to the webview l10n (`src/extension/webviewL10n.ts`,
   `src/webview/l10n.d.ts`) in all five bundles; `l10n:check` must be 100%.
4. Tests:
   - webview markup for marked and unmarked refs, and for locked and
     prunable states;
   - a CSS regression test;
   - headless light and dark renders (Verifying webview visuals without a
     browser), attached to the report.

## Touch

`src/webview/main.ts` (ref rendering, the context menu header),
`src/webview/refLabels.ts`, `media/refs.css`, `src/octicons.ts` (generated),
`scripts/generate-octicons.js` (the icon list, if that is where it lives),
`src/extension/webviewL10n.ts`, `src/webview/l10n.d.ts`, `l10n/bundle.l10n*.json`,
`tests/webview/**`

## Acceptance

Every branch checked out elsewhere is marked, with its path on hover. Nothing
changes for a repository without linked worktrees, and renders look right in
both themes.

## Report

Not started.
