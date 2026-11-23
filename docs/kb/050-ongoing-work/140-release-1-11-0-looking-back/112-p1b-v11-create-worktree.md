---
summary: >-
  P1b: popup fix V11, maintainer answer (b): on a branch another worktree has
  checked out, "Create Worktree…" opens Create Worktree offering only the two
  modes Git allows there (a new branch from it, a detached HEAD) instead of
  the Open Worktree dialog.
---

# P1b — V11: Create Worktree on a branch another worktree holds

Status: claimed by Muse Code on 2026-11-23 17:41

Needs: P1 (integrated)

Agent: Muse Code

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section
(`050-ongoing-work/140-release-1-11-0-looking-back.md`, the answers table
row "V11 (P1b)"); the popup review
(`050-ongoing-work/090-popup-and-context-menu-visual-review.md`, V11 and the
V3/V4 entries P1 already fixed in the same dialog); P1's report
(`140-release-1-11-0-looking-back/110-p1-popup-fixes.md`); the Webview UI
Styling Guide (Reference), including the headless render recipe.

## Touch

The branch context menu and the Create Worktree dialog code in the graph
webview (`src/webview/main.ts` around `showCreateWorktreeDialog()`, and the
dialog/worktree modules it calls under `src/webview/`); `src/types.ts` or
the extension-side worktree handler only if the request shape must carry
the mode; `l10n/bundle.l10n*.json` (all five, translated by you) only if a
new string is unavoidable; tests under `tests/webview/` (and
`tests/backend/` if the host side changes); the V11 entry's status in
`090-popup-and-context-menu-visual-review.md`; this file's Status and Report.

## Task and acceptance

- The maintainer's answer (b): in the context menu of a branch that another
  worktree has checked out, "Create Worktree…" stays, and opens **Create
  Worktree** (not the Open Worktree dialog) with exactly the two modes Git
  allows for a branch that is already checked out elsewhere: **a new branch
  starting from it** and **a detached `HEAD` at its tip**. The mode that
  would check out the held branch itself is not offered (hidden, not shown
  disabled, unless the dialog's existing pattern shows unavailable modes
  disabled with a reason — follow the existing pattern and say which).
- The default mode is "new branch"; the new-branch name field and folder
  behave as P1's V3/V4 fixes made them.
- "Open Worktree…" in the same menu is unchanged.
- Branches not held by another worktree keep today's Create Worktree
  behavior exactly.
- Tests: the held-branch menu item opens Create Worktree with the two modes
  only; each mode posts the right request (new branch from the held
  branch's tip; detached at its tip); the unheld path is unchanged.
- Headless renders, dark and light, of the dialog opened from a held
  branch, PNGs under `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/P1b/`.
- Mark V11 done in the popup review with this slice's ID.

Checks: strict Biome on touched files, `pnpm run typecheck`,
`node esbuild.js --production`, the touched Vitest suites, the full
`pnpm run test` once (record counts), `pnpm run l10n:check` if strings
changed, KB check. Claim and changes are separate signed commits; never
push.

## Report

Not started.
