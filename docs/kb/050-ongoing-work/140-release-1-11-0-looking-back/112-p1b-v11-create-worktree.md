---
summary: >-
  P1b: popup fix V11, maintainer answer (b): on a branch another worktree has
  checked out, "Create Worktree…" opens Create Worktree offering only the two
  modes Git allows there (a new branch from it, a detached HEAD) instead of
  the Open Worktree dialog.
---

# P1b — V11: Create Worktree on a branch another worktree holds

Status: done — awaiting integration

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

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 17:50
- **Branch and commits:** `rel-1.11.0/P1b` (base `cb71af3f`) —
  - `65b2d8d2 G docs(kb): claim V11 create-worktree slice (P1b)`
  - `3b8c392a G fix(webview): Create Worktree on a held branch offers a new branch or a detached HEAD (P1b)`
  - `43d513a4 G docs(kb): mark popup review V11 done (P1b)`
  - plus the signed commit carrying this report and final status
- **Files changed:** 4 files, +135/−30 before this report commit (`git diff --stat cb71af3f..HEAD`):
  - `src/webview/main.ts` (+31/−20): new exported pure helper `resolveCreateWorktreeSource()` beside `CreateWorktreeSource`; `showCreateWorktreeDialog()` resolves the source through it instead of diverting a held branch to `openWorktreeAction()`.
  - `tests/webview/createWorktreeDialog.test.ts` (+101/−7): the old refusal test replaced by the V11 acceptance tests; helper unit tests; unheld three-mode pin.
  - `docs/kb/050-ongoing-work/090-popup-and-context-menu-visual-review.md` (+2/−2): V11 heading and Status line done.
  - `docs/kb/050-ongoing-work/140-release-1-11-0-looking-back/112-p1b-v11-create-worktree.md` (+1/−1, then this report): claim, then this report.
- **Tests added or changed:** `tests/webview/createWorktreeDialog.test.ts` 24 → 27 tests. Replaced "refuses a branch checked out elsewhere and offers that worktree instead" with "opens Create Worktree with only a new branch and a detached HEAD for a branch checked out elsewhere (P1b)" (menu keeps both items; dialog title/folder; select exactly `["new", "detach"]` with labels "New branch from feature/menu" / "Detached HEAD at feature/menu"; default `new`; no `openWorktree` message; submit posts `addWorktree` with `branch: null, newBranch: "feature/menu-copy", startPoint: "feature/menu", detach: false`) and "detaches at the held branch's tip when that mode is chosen (P1b)" (`newBranch: null, detach: true`). Added `resolveCreateWorktreeSource (P1b)` unit tests (held → `branch: null, mode: "new"`; unheld, current-worktree-held, and branch-less sources returned unchanged by identity). The unheld branch test now pins all three option values `["branch", "new", "detach"]`. "Open Worktree…" behavior stays covered by `tests/webview/branchWorktreeActions.test.ts` (unchanged, passing).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings src/webview/main.ts tests/webview/createWorktreeDialog.test.ts`: clean (one pre-existing `info` that the config `$schema` names 2.5.13 against CLI 2.6.8).
  - `pnpm run typecheck`: exit 0.
  - `node esbuild.js --production`: exit 0 (`out/web.min.js` rebuilt; `out/` is ignored).
  - Focused: `npx vitest run --project webview tests/webview/createWorktreeDialog.test.ts tests/webview/branchWorktreeActions.test.ts`: 2 files, 54 passed.
  - `pnpm run test` (full, run twice; the second run only to capture both project summaries): backend 119 files, 1,592 passed, 60 skipped (expected in a linked worktree); webview 94 files, 1,317 passed.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - `pnpm run l10n:check`: not run — no user-visible string changed; the two modes reuse the existing `dialog.createWorktree.newBranchFrom` / `dialog.createWorktree.detachedAt` strings in all five bundles, so no translation was needed.
  - Headless renders (PyQt6 QtWebEngine under `xvfb-run`, `QT_QPA_PLATFORM=xcb`, `QT_SCALE_FACTOR=2`; the real webview DOM dumped from the jsdom test boot after opening the held branch's dialog, wrapped with the real `media/*.css` in `webviewHtml.ts` order and injected Dark Modern / Light Modern `--vscode-*` token values — injected, not read from the editor over CDP; both PNGs inspected):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/P1b/v11-create-worktree-held-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/P1b/v11-create-worktree-held-light.png`
    - Both show "Create a worktree from feature/menu", Check out = "New branch from feature/menu", the New branch row, the pre-filled folder with Browse, Lock the worktree unticked with no reason row, and Create Worktree / Cancel. The scratch dump test and harness (`/tmp/ggl-p1b-render/`) were removed from the tree and are not committed.
  - Sonar: integrator. `resolveCreateWorktreeSource()` is a separate small function (two guards); `showCreateWorktreeDialog()` gained no new branching beyond the resolve call.
- **Acceptance:**
  - Held branch: "Create Worktree…" opens Create Worktree with exactly the new-branch and detached modes — met (dialog tests + both renders). The checkout-the-held-branch mode is **hidden, not shown disabled**: the dialog's existing pattern omits the `branch` option whenever no checkable branch fits (commit, tag, HEAD and current-branch sources), and P1b follows it.
  - Default mode is "new branch"; the new-branch field and folder behave as P1's V3/V4 left them — met (default `new`; folder default, title, Browse and lock-reason dependency untouched and visible in the renders).
  - "Open Worktree…" unchanged — met (`branchWorktreeActions.test.ts` passes unedited; the held menu still lists it, asserted in the new dialog test).
  - Unheld branches keep today's behavior exactly — met (three modes pinned; every pre-existing dialog test passes unedited except the one refusal test this slice replaces).
  - Each mode posts the right request — met (new: `newBranch` + `startPoint` = held branch; detach: `detach: true` + same `startPoint`; `branch: null` in both, so the backend's `assertCreatable` never sees a held checkout and `git worktree add -b … <held>` / `--detach … <held>` are the two forms Git allows).
  - Headless renders dark and light under `renders/P1b/` — met (above).
  - V11 marked done in the popup review with this slice's ID — met (`43d513a4`; heading "— done (P1b)", review Status done).
- **Deviations from the slice:** none outside the Touch list. No `src/types.ts` or host change was needed (the `addWorktree` request already carries the mode through `branch`/`newBranch`/`startPoint`/`detach`), and no new l10n string was needed. One scope note: the resolve lives in the shared dialog, so a remote branch whose local branch is held now also opens Create Worktree (new branch from the remote ref, or detached at it) instead of the Open Worktree dialog — the same V11 rule applied at the one dialog entry point; its "Open Worktree…" item is unchanged.
- **Open questions / follow-ups:** none. For the integrator: this slice edits `src/webview/main.ts` (two cohesive spots: the helper by `CreateWorktreeSource`, and `showCreateWorktreeDialog()`) and no l10n bundle, so the expected overlap with F4-06/Q2/L2 is `main.ts` only.
