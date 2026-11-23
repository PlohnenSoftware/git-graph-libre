---
summary: >-
  P1: the open popup defects V1–V11 from "Popup and context-menu visual
  review" (History), with VQ1 answered (`2026-11-23`: icon buttons for
  the Worktrees popup's upkeep actions, Remove included). Optional for
  release 1.11.0.
---

# P1 — Popup fixes V1–V11

Status: done — awaiting integration (V1–V10). V11 split off by the integrator as slice P1b, blocked on a maintainer decision (`2026-11-23`).

Needs: —

Agent: Muse Code

Read first: `AGENTS.md`; the KB index and every *always read* section;
Multi-agent releases (Rules); the release section
(`070-history/260-release-1-11-0-looking-back.md`); "Popup and
context-menu visual review" (`070-history/250-popup-and-context-menu-visual-review.md`),
whole: it is this slice's specification (each V item's Shows, Where, Fix
proposed and Keep); the Webview UI Styling Guide (Reference) and its
subsections, including the headless render recipe.

## Decisions

- **VQ1 (maintainer, `2026-11-23`): icon-only buttons are acceptable for the
  upkeep actions, Remove included** — V2 as proposed: Copy Path, Lock or
  Unlock, Move and Remove as compact icon buttons with their label as
  `title` and `aria-label`; the go-to actions stay text buttons.

## Touch

The files each V item names under "Where" (webview TypeScript under
`src/webview/**`, `media/*.css`), their tests (the CSS regression tests in
`tests/webview/dialogStyles.test.ts`, `tests/webview/tableStyles.test.ts`
and the dialogs' own tests), `l10n/bundle.l10n*.json` when a string
changes (new keys in their own block, not at the end of the file and not in
the `reflog.*` block), the review file's Status line and V items' status,
and this slice file's Status and Report.

## Task and acceptance

Fix V1, V3–V11 in the review's suggested order, then V2, each with its test,
rendered headlessly in dark and light (and forced colors where the review
asks) before it is called done, PNGs under
`/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/p1/`. Mark each V item done in
the review file as it lands. Keep every action keyboard-reachable and every
`data-*` attribute tests and handlers use.

## Report

- **Agent / date:** Muse Code (claimed and landed V1, V3, V4, V6–V10 before provider HTTP 429 cutoff), continued and completed through V5, V2, renders and verification by Gemini 4 Neon (agy), 2026-11-23 12:41
- **Branch and commits:** `rel-1.11.0/P1` (base `7db1d290`) —
  - `7b27ec4f G docs(kb): claim popup fixes slice (P1)`
  - `f01ae3bc G fix(l10n): drop doubled ellipsis from worktree status strings (P1)`
  - `aec1b420 G fix(webview): no empty form table, one capped list block for dialogs (P1)`
  - `b2bbdb38 G fix(webview): error icon in its own column (P1)`
  - `25ccc9f1 G fix(webview): Remove Worktree confirms with Remove, not Yes (P1)`
  - `eb04f258 G fix(webview): checkbox box aligns with its first line (P1)`
  - `c3cc8e09 G fix(webview): Create Worktree folder, select width, lock reason (P1)`
  - `3960097a G fix(webview): remote checkout prompt title, inline reason, folder chip (P1)`
  - `a09924db G fix(webview): worktree-created finish step as one-click choices (P1)`
  - `acdb0f81 G fix(webview): Delete Branch worktree note and required removal box (P1)`
  - `6892e14b G fix(webview): unify Worktrees popup rows with top-right upkeep icons (P1)`
  - `686ec824 G chore(webview): format checkoutRemoteExistingBranch test and update review status (P1)`
  - plus the signed commit carrying this report and final status
- **Files changed:** 22 files changed, +768/−145 before this report commit (`git diff --stat 7db1d290..HEAD`):
  - `docs/kb/070-history/250-popup-and-context-menu-visual-review.md` (+11/−11)
  - `docs/kb/070-history/260-release-1-11-0-looking-back/110-p1-popup-fixes.md` (+1/−1, then this report)
  - `l10n/bundle.l10n.json` (+10/−6), `l10n/bundle.l10n.nl.json` (+10/−6), `l10n/bundle.l10n.pl.json` (+10/−6), `l10n/bundle.l10n.zh-cn.json` (+9/−5), `l10n/bundle.l10n.zh-tw.json` (+9/−5)
  - `media/dialogs.css` (+60/−4)
  - `media/settings.css` (+54/−6)
  - `scripts/generate-octicons.js` (+4)
  - `src/extension/webviewL10n.ts` (+10/−2)
  - `src/octicons.ts` (+20)
  - `src/webview/global.d.ts` (+43/−5)
  - `src/webview/main.ts` (+184/−38)
  - `src/webview/worktreeList.ts` (+49/−8)
  - `tests/backend/l10n.test.ts` (+24)
  - `tests/webview/branchWorktreeActions.test.ts` (+64/−18)
  - `tests/webview/checkoutRemoteExistingBranch.test.ts` (+22/−3)
  - `tests/webview/createWorktreeDialog.test.ts` (+45/−13)
  - `tests/webview/dialogStyles.test.ts` (+58)
  - `tests/webview/worktreeList.test.ts` (+75/−2)
  - `tests/webview/worktreeListPopup.test.ts` (+2)
- **Tests added or changed:**
  - `tests/backend/l10n.test.ts`: added guard that no `status.*` string across any bundle ends in trailing dots or ellipsis (V1).
  - `tests/webview/dialogStyles.test.ts`: added CSS regression tests for V2 (`.worktreeRow`, `.worktreeRowHeader`, `.worktreePath`, `.worktreeActions`, `.worktreeIconAction`), V3 (folder dialog cap, full-width selects), V6 (`.dialogList`, `.dialogListNote`, `.dialogFormListCell`), V7 (`.dialogInputError`), V8 (`.dialogErrorTitle`, `.dialogErrorIcon`, `.dialogErrorText`), V10 (`align-items: flex-start` on `.dialogFormCheckbox > .checkRow`).
  - `tests/webview/branchWorktreeActions.test.ts`: updated/added assertions for V5 (note row with folder name + hover path, question-only title, required removal checkbox blocking submission while keeping dialog open, type-based reading of force-delete and remote-delete boxes), V6 (no empty form table; `.dialogList` and `.dialogListNote`), V8 (`.dialogErrorTitle` / `.dialogErrorIcon` / `.dialogErrorText`).
  - `tests/webview/createWorktreeDialog.test.ts`: updated/added tests for V3 (folder field `title` and scrolled end, lock reason hidden until lock checkbox ticked) and V4 (choice dialog with remembered primary button and Cancel as do-nothing).
  - `tests/webview/checkoutRemoteExistingBranch.test.ts`: updated/added tests for V7 (new title wording, inline `#dialogInputError0` with `aria-invalid`, folder chip with full path in `title`).
  - `tests/webview/worktreeList.test.ts` and `tests/webview/worktreeListPopup.test.ts`: added V2 tests (`git-commit` octicon for detached HEAD, go-to text buttons vs top-right upkeep `<button>` icon buttons with `title`/`aria-label` and `data-worktree-action`) and V9 (`Remove` submit button).
  - Full suite counts after all changes (`pnpm run test`): backend 115 files, 1,555 passed, 60 skipped (expected in linked worktrees); webview 85 files, 1,121 passed. (Before counts were not recorded on base `7db1d290` because this run continued mid-slice.)
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings <all 18 touched .ts/.js/.json files>`: clean (0 errors, 0 warnings).
  - `pnpm run typecheck`: exit 0.
  - `pnpm run l10n:check`: 100% complete across `nl`, `pl`, `zh-cn`, `zh-tw` (867 `bundle.l10n.*` keys, 133 `package.nls.*` keys). Translations for `nl`, `pl`, `zh-cn`, `zh-tw` were produced by the agent; a native review would help.
  - `pnpm run test`: backend 115 passed (1,555 passed, 60 skipped); webview 85 passed (1,121 passed).
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Headless renders (PyQt6 QtWebEngine under `xvfb-run` with `QT_QPA_PLATFORM=xcb`, real `media/*.css` and bundled `src/webview/main.ts`, Dark Modern and Light Modern tokens; all 26 PNGs inspected under `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/P1/`):
    - `v1-running-{dark,light}.png`
    - `v2-worktrees-popup-wide-{dark,light}.png`, `v2-worktrees-popup-narrow-{dark,light}.png`
    - `v3-create-worktree-{dark,light}.png`, `v3-create-worktree-locked-{dark,light}.png`
    - `v4-worktree-created-{dark,light}.png`
    - `v5-delete-branch-held-{dark,light}.png`, `v5-delete-branch-held-ticked-{dark,light}.png` (also covers V10 wrapped two-line checkbox alignment)
    - `v6-forced-removal-list-{dark,light}.png`
    - `v7-remote-checkout-name-invalid-{dark,light}.png`, `v7-remote-checkout-held-chip-{dark,light}.png`
    - `v8-error-dialog-{dark,light}.png`
    - `v9-remove-worktree-{dark,light}.png`
  - Forced-colors CSS rules were added and checked by unit tests (`@media (forced-colors: active)` in `media/settings.css` for `.worktreeIconAction`/`.worktreeAction`); a separate forced-colors Chromium render was not captured.
  - Sonar: integrator.
- **Acceptance:**
  - **V1:** met — trailing ` ...` dropped in all five bundles, English title-cased, guard test in `tests/backend/l10n.test.ts`, verified in `v1-running-{dark,light}.png`.
  - **V2 (VQ1):** met — unified row shape, path and go-to actions indented to text column (22px), top-right keyboard-reachable `<button>` icon buttons for Copy Path, Lock/Unlock, Move and Remove with `title`/`aria-label` and `data-worktree-action`, `git-commit` icon for detached HEAD, verified in `worktreeList.test.ts`, `worktreeListPopup.test.ts`, `dialogStyles.test.ts`, and wide/narrow dark/light renders.
  - **V3:** met — wider folder dialog cap (560px), field scrolled to end with full path in `title`, full-width selects in every dialog form, checkbox-driven `dependsOn` hiding Lock reason while unticked, verified in `createWorktreeDialog.test.ts`, `dialogStyles.test.ts`, and dark/light renders.
  - **V4:** met — `finishCreateWorktree()` uses `showChoiceDialog()` with last choice primary and Cancel as do-nothing, verified in `createWorktreeDialog.test.ts` and dark/light renders.
  - **V5:** met — question alone in `.dialogTitle`, worktree explanation in `.dialogFormNote` preserving folder name and hover path, required removal checkbox blocking submit until ticked, type-based checkbox extraction, verified in `branchWorktreeActions.test.ts` and dark/light renders.
  - **V6:** met — `renderDialogForm()` omits empty table when `inputs.length === 0`, new `list` dialog input renders `.dialogList` (capped 180px scrolling block at body size) + `.dialogListNote`, verified in `branchWorktreeActions.test.ts`, `dialogStyles.test.ts`, and dark/light renders.
  - **V7:** met — `dialog.createBranch.title` updated in English/nl/pl to match zh-cn/zh-tw, inline `#dialogInputError*` with `aria-invalid` under every `text-ref` field, folder chip with hover path in `existingBranchMessage()`, verified in `checkoutRemoteExistingBranch.test.ts`, `dialogStyles.test.ts`, and dark/light renders.
  - **V8:** met — `.dialogErrorTitle` flex row with fixed `.dialogErrorIcon` and wrapped `.dialogErrorText`, verified in `branchWorktreeActions.test.ts`, `dialogStyles.test.ts`, and dark/light renders.
  - **V9:** met — `confirmRemoveWorktree()` uses `showFormDialog(..., [], l10n.worktreeRemove, ...)`, verified in `worktreeListPopup.test.ts` and dark/light renders.
  - **V10:** met — `.dialogFormCheckbox > .checkRow` uses `align-items: flex-start`, verified in `dialogStyles.test.ts` and `v5-delete-branch-held-{dark,light}.png`.
  - **V11:** not met (blocked) — review explicitly states V11 is behavioral ("Either leave the item out of that menu, or let it open Create Worktree with the two modes that still work there (a new branch from it, a detached HEAD). This is behavior rather than appearance, so it needs the maintainer's word.") and neither the review, slice file nor release section records a decision or recommendation. Left untouched per Hard Rule 10.
- **Deviations from the slice:**
  - `src/extension/webviewL10n.ts` (`a09924db`, outside *Touch*): unavoidable glue to plumb the new V4 l10n keys to the webview.
  - `scripts/generate-octicons.js` and `src/octicons.ts` (`6892e14b`, outside *Touch*): unavoidable glue to add the 16px `file-moved`, `lock`, `trash` and `unlock` octicons via `pnpm run icons:generate` as required by the Webview UI Styling Guide.
  - Renders were written to `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/P1/` (matching the dispatch prompt and sibling `F3-02` directory casing) rather than lowercase `p1/`.
  - `nl`, `pl`, `zh-cn` and `zh-tw` l10n updates were translated by the agent; a native review would help.
- **Open questions / follow-ups:**
  - **V11 (blocker for full V1–V11 completion):** maintainer decision needed on whether a branch held by another worktree should (a) omit "Create Worktree…" from its context menu (since "Open Worktree…" already sits above it), or (b) open Create Worktree with the two modes Git still allows there (new branch from it, detached HEAD). V1–V10 are completely implemented, tested, rendered and signed and can be integrated as-is if V11 is deferred to a follow-up.
