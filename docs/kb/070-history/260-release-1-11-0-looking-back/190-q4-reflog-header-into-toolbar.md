---
summary: >-
  Q4: drop the Reflog tab's header bar (ref name and repository name, which
  the ref picker and the tab title already show) and move "Scan for Lost
  Commits…" into the filter bar, right-aligned, so the filter bar becomes
  the tab's top bar and the button keeps its place. From the maintainer's
  test on `2026-11-23`.
---

# Q4 — Reflog: one top bar, no redundant header

Status: claimed by Claude Haiku on 2026-11-23 19:50

Needs: Q2 (integrated); runs beside Q3 (columns), which edits the same files
in other places — keep to the header and the filter bar.

Agent: Claude Haiku

Read first: `AGENTS.md`; Multi-agent releases (Rules); this release's record
(`070-history/260-release-1-11-0-looking-back.md`); the Reflog tab in History
(`070-history/230-reflog-tab.md`); the Webview UI Styling Guide (Reference),
including the headless render recipe; `src/webview/reflogTab/view.ts`
(`header()` around line 86 and the filter bar it is rendered above) and
`media/reflog-tab/reflog-tab.css` (`.reflog-header`, `.reflog-repo`, the
filter bar rules).

## Touch

`src/webview/reflogTab/view.ts` (the header and the filter bar only),
`media/reflog-tab/reflog-tab.css` (their rules only), tests under
`tests/webview/reflogTab/` for those; this file's Status and Report.

## What the maintainer reported

A screenshot of the tab with the top bar "HEAD  Electronic_Instrumentation_manuals"
crossed out ("it shows the name of the opened reference and the repo's
name; it's clutter and redundant since the list item below shows that"),
and the "Scan for Lost Commits…" button circled with an arrow down: it
"has to go down to be in the same bar as the others, which effectively means
it would stay in the same place after that whole bar replaces the deleted
one".

## Task and acceptance

- Remove the header bar (`header()`, `.reflog-header`, `.reflog-ref`,
  `.reflog-repo`) entirely. The tab title already names the repository and
  the ref picker names the reflog.
- Keep the useful hover facts that lived there: the ref picker's `title`
  carries the selected worktree's full path when a worktree `HEAD` is
  chosen (as the removed `.reflog-ref` title did); nothing else needs to
  move.
- "Scan for Lost Commits…" moves into the filter bar (ref picker, search,
  action filter, "Only in the reflog"), pushed to the right end of that bar
  (for example `margin-left: auto`), keeping its id `reflogLostScanBtn`, its
  disabled/`aria-busy` state while scanning, and its click callback. The
  filter bar becomes the first row of the tab, so the button stays where it
  was horizontally.
- When the bar wraps on a narrow tab, the button wraps with the controls
  and never overflows; no horizontal scroll (Q2's rule).
- The lost-commits view and every notice (bare repository, empty, error)
  keep working and keep their place below the bar.
- Accessibility: the bar keeps or gains a toolbar role/label if the filters
  had none, and the tab order is ref picker, search, action filter,
  checkbox, Scan button.
- No new strings; remove labels that only the header used only if nothing
  else reads them (keep them in the bundles otherwise — do not churn l10n).

Tests: the header is gone; the Scan button is inside the filter bar, last,
with its id, disabled state while scanning and callback; the ref picker's
title is the worktree path for a worktree `HEAD`; the bare-repository note
still renders. Headless renders, dark and light, at about 1,560 and 700 px
(harness: copy `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/R90/reflog/` to
`/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/Q4/`, point it at this
worktree, PNGs `reflog-q4-*`); look at each PNG.

Checks: strict Biome on touched files, `pnpm run typecheck`,
`node esbuild.js --production`, the touched suites, the full
`pnpm run test` once (under `timeout`), KB check. Claim and changes are
separate signed commits; never push.

## Report

Not started.
