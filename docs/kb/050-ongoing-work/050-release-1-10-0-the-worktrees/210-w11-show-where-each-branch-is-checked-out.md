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

Status: integrated `54065b5` (`2026-11-05`)
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

- **Agent / date:** Muse Code powered by muse-wonder-full-1.0, 2026-11-05 20:02
- **Branch and commits:** `wt-1.10.0/W11` —
  `afbe4e2 G docs(worktrees): claim W11, show where each branch is checked out (W11)`;
  `bfabd61 G feat(icons): ship the file-directory octicon for worktree markers (W11)`;
  `6cd3621 G feat(l10n): strings for a branch checked out in another worktree (W11)`;
  `2758aea G feat(webview): worktree segment on branches checked out elsewhere (W11)`;
  `752589b G test(webview): worktree badge segment, tooltip, header and CSS (W11)`;
  `c607748 G style(webview): format the worktree badge test helper (W11)`;
  plus this report commit.
- **Files changed:** 14 files, +440/−8 against `38cc431` before this report
  commit: `src/webview/main.ts` +61/−6 (segment in `renderCommitRef`, the
  exported `otherWorktreesHoldingBranch`/`describeWorktreeCheckout`, the
  context-menu header now built from holders), `media/refs.css` +28
  (`.gitRefWorktreeBadge`, `.gitRef.inWorktree > svg`), `scripts/
  generate-octicons.js` +1 and generated `src/octicons.ts` +6/−1 (the
  `file-directory` octicon Y4 chose; the generator also refreshed the
  `@primer/octicons` version comment 19.40.0 → 19.42.0, paths unchanged),
  `src/extension/webviewL10n.ts` +4, five `l10n/bundle.l10n*.json` +4 each,
  tests +319 (`branchWorktrees.test.ts` +97, `tableStyles.test.ts` +18, new
  `worktreeBranchBadge.test.ts` +204), this slice file. About 121 lines
  outside tests, inside the ~220 hint.
- **Tests added or changed:** 7 new tests. Units (`branchWorktrees.test.ts`
  6 → 11): holder lookup (current worktree excluded, branch in two
  worktrees listed twice) and `describeWorktreeCheckout` for plain, locked
  with and without a reason, prunable, and `$&`-style patterns in paths and
  reasons staying literal. Render (new `worktreeBranchBadge.test.ts`, 1): a
  full page load asserting exactly one `.gitRefWorktreeBadge` with the
  `file-directory` octicon on a branch held by a locked and a prunable
  worktree, both named with folder, path and state in the tooltip and in
  the context-menu header, and no segment or title change on the current
  worktree's branch or an unheld one. CSS (`tableStyles.test.ts` 30 → 31):
  badge tokens first with OKLCH-backed fallbacks, no raw color literal,
  signed-badge metrics, flush icon margin. Focused set before: 57 passed
  (4 files); after: 64 (5 files). Full suite after: backend 1331 passed
  (102 files), webview 872 passed (70 files; 865 → 872 is these 7).
- **Gates:** strict Biome (`biome.strict.jsonc --error-on-warnings`) on
  every touched `.ts`/`.js`/`.json` — clean (one format fix, `c607748`);
  `pnpm run typecheck` — clean; `pnpm run test` — 1331 + 872 passed, no
  failures; `pnpm run l10n:check` — "All translations are complete" (four
  new keys in all five bundles; the non-English strings are the agent's
  translations); `pnpm run kb:check` — passed on this report before its
  commit. Headless render of the segment with PyQt6 QtWebEngine +
  `xvfb-run` against the real `media/*.css`, dark and light: the segment
  sits flush against the branch icon, also inside a branch group, and
  reads clearly in both themes (probe and screenshots in `/tmp/w11-shot/`).
  Sonar: integrator.
- **Acceptance:** "Every branch checked out elsewhere is marked, with its
  path on hover. Nothing changes for a repository without linked
  worktrees, and renders look right in both themes." — Met. Marked: the
  render test asserts the one segment on the held branch and none on the
  current or unheld branches (whose titles stay exactly the branch name,
  so a worktree-free repository renders as before). Path on hover: the
  tooltip and the context-menu header both read "Checked out in worktree
  <folder> (<path>)", plus "locked: <reason>" (bare "locked" without one)
  or "missing (moved or deleted)" for a prunable entry, listing every
  holder of a twice-checked-out branch — asserted for both surfaces in
  the render test and per state in the units. Both themes: the dark and
  light screenshots in `/tmp/w11-shot/`, inspected before this report.
- **Deviations from the slice:** (1) `src/webview/l10n.d.ts` and
  `src/webview/refLabels.ts` untouched: the webview `l10n` type derives
  from `webviewL10n.ts`, and the new pure helpers live beside W10's/
  W12's `branchWorktreeMap`/`worktreeFolderName` in `main.ts`, where the
  folder-name helper already is. (2) The icon reaches the markup through
  a direct `octicon("file-directory", "worktreeIcon")` import in
  `main.ts` (the `commitDetailsView.ts` precedent), because the shared
  `svgIcons` catalog (`src/webview/utils/icons.ts`) is outside the Touch
  list. (3) The context-menu header already existed from W20 with title
  and paths; W11 keeps its title and refusal sentence and replaces the
  bare path list with the same per-worktree description as the tooltip
  (folder, path, locked/missing), also switching its `{0}` substitution
  to a replacer function so `$`-patterns in a path stay literal.
  (4) On W12 agreement: the two markers are related, not identical. W12's
  detached-HEAD badge is its own dashed badge whose leading icon is the
  filled folder (`file-directory-fill`, via `closedFolder`) on the
  commit color; W11's segment is Y4's outline `file-directory` on the
  editor badge tokens inside the branch badge. In the side-by-side
  render they read as one family without being confusable — a place a
  worktree sits versus a branch held elsewhere. No W12 change is needed
  for W11's acceptance.
- **Open questions / follow-ups:** If the maintainer wants the two folder
  glyphs to match exactly, a small follow-up can switch W12's badge icon
  to the outline `file-directory` (or W11's segment to the fill); that is
  a taste call, recorded here rather than made. Nothing else.
