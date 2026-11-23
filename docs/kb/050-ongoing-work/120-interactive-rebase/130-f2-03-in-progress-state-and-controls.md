---
summary: >-
  F2-03: a banner above the graph while a rebase is in progress, with
  Continue, Skip and Abort, the conflict file list, and the operation-state
  reader that tells a rebase begun anywhere from a stale one. Real-Git tests
  and webview tests.
---

# F2-03 — In-progress state and controls

Status: done — awaiting integration

Needs: none (F2-01b for the end-to-end checks)

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions IQ2, IQ9 and the
clean-room rules; the Webview UI Styling Guide (Reference) for the banner;
research sections 1.1 (In progress), 2 (Conflict / in-progress detection),
3 (principle 3) and 4 (F2-03) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English, OKLCH
colors through tokens (the VS Code theme tokens first). Every user-visible
string goes into all five l10n bundles, and `pnpm run l10n:check` reports
complete. No new telemetry events or declarations. Do not bump versions or edit
CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/queries/operationState.ts` (new): reads the state files, never messages
- `src/backend/actions/rebase.ts`: continue, skip and abort only
- `src/repoFileWatcher.ts`: watch `rebase-merge`, `rebase-apply`, `MERGE_HEAD`,
  `REBASE_HEAD` in the per-worktree git dir; check the debouncing
- `src/types.ts`: the state shape
- `src/webview/rebaseBanner.ts` (new), a banner module of its own
- `media/rebase-banner.css` (new, OKLCH through tokens)
- `src/webview/main.ts`: the hook-in only
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json` (five bundles)
- tests: `tests/backend/queries/operationState.test.ts`, `tests/backend/actions/rebaseControls.test.ts`, `tests/webview/rebaseBanner.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Behavior.** While a rebase is in progress, a banner above the graph reads
"Rebase in progress: stopped at <short hash> <subject> (<n> of <m>)" with
Continue, Skip and Abort. For a conflict it shows the unmerged file list with
an Open file action (VS Code opens its merge editor). For an `edit` stop it
says "Stopped to amend; commit your changes, then Continue". Abort asks for
confirmation first. Continue is blocked while unmerged paths remain (IQ9):
the banner tells the user to resolve and stage the files in the SCM view, and
offers no silent `add -A`.

**Detection.** From files only: `rebase-merge/` (with `stopped-sha`, `msgnum`,
`end`, `head-name`, `onto`) or `rebase-apply/`; plus `MERGE_HEAD`,
`CHERRY_PICK_HEAD`, `REVERT_HEAD` for context. Conflict files come from
`git diff --name-only --diff-filter=U`. Locale-independent: never parse Git's
messages. A rebase started from the terminal mode is detected the same way.

**Git commands.** `git rebase --continue` (with `GIT_EDITOR=true`),
`git rebase --skip`, `git rebase --abort`, through the recorded runner with
labels `rebase.continue`, `rebase.skip`, `rebase.abort`.

**Watcher.** The state directory and markers trigger a refresh; check the
debouncing so a burst of writes during a rebase does not cause a storm.

**Localization.** About twelve strings: banner states, the "n of m" progress,
button labels, confirm text and errors.

**Tests (real Git):** an edit stop; a conflict stop; continue to completion;
skip; abort restores the branch tip; a stale `REBASE_HEAD` after success is
not "in progress" (regression for `a79f444`); `rebase-apply` state; linked
worktree state in its own git dir; detection of a rebase started outside the
banner. Webview tests: banner rendering per state, and the confirm dialog.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run tests/backend/queries/operationState.test.ts tests/backend/actions/rebaseControls.test.ts tests/webview/rebaseBanner.test.ts
pnpm run l10n:check
```

## Report

- **Agent / date:** Muse Code (claimed 2026-11-23 12:01, interrupted by HTTP 429 after commits `e23968dd`..`c66a653c`), continued and finished by Gemini 4 Argon (agy), 2026-11-23 12:41. Git Graph+ was read for behavior only through the research note; the implementation is from Git's documented and observed behavior and this project's own patterns, and copies no code.
- **Branch and commits:** `rebase/F2-03` —
  - `e23968dd G docs(rebase): claim F2-03 (F2-03)`
  - `50182e59 G feat(rebase): add operation state reader (F2-03)`
  - `0bf9eff3 G feat(rebase): add continue, skip and abort controls (F2-03)`
  - `eb0ec64c G feat(rebase): watch rebase state in the per-worktree git dir (F2-03)`
  - `31d9ea01 G feat(rebase): add banner strings in all five bundles (F2-03)`
  - `c66a653c G feat(rebase): add in-progress banner above the graph (F2-03)`
  - `41a76fa1 G refactor(rebase): route control replies via responseHandlers and export state types (F2-03)`
  - `c258ff1a G test(rebase): add real-Git tests for operation state and rebase controls (F2-03)`
  - `deb4a862 G test(rebase): cover rebase state file watching and banner UI (F2-03)`
  - (plus this report commit)
- **Files changed:**
  - `src/backend/queries/operationState.ts` (+205, new)
  - `src/backend/actions/rebase.ts` (+132/−3)
  - `src/repoFileWatcher.ts` (+29/−2)
  - `src/types.ts` (+7)
  - `src/backend/types/actions.types.ts` (+6)
  - `src/backend/types/queries.types.ts` (+48)
  - `src/extension/messageHandler.ts` (+40/−1)
  - `src/extension/webviewHtml.ts` (+2)
  - `src/extension/webviewL10n.ts` (+14)
  - `src/webview/rebaseBanner.ts` (+165, new)
  - `src/webview/main.ts` (+92)
  - `media/rebase-banner.css` (+145, new)
  - `l10n/bundle.l10n.json` (+14)
  - `l10n/bundle.l10n.nl.json` (+14)
  - `l10n/bundle.l10n.pl.json` (+14)
  - `l10n/bundle.l10n.zh-cn.json` (+14)
  - `l10n/bundle.l10n.zh-tw.json` (+14)
  - `tests/backend/queries/operationState.test.ts` (+354, new)
  - `tests/backend/actions/rebaseControls.test.ts` (+283, new)
  - `tests/webview/rebaseBanner.test.ts` (+438, new)
  - `tests/webview/repoFileWatcher.test.ts` (+59)
  - `docs/kb/050-ongoing-work/120-interactive-rebase/130-f2-03-in-progress-state-and-controls.md` (status and report)
- **Tests added or changed:** 30 new tests across 4 files:
  - `tests/backend/queries/operationState.test.ts` (10 real-Git tests: clean repo with 0 Git commands, `edit` stop with hash/subject/progress/branch/onto, `conflict` stop with unmerged files and resolved state as `"other"`, failed `exec` stop as `"other"`, terminal-started rebase detection, stale `REBASE_HEAD` after success not treated as in-progress [`a79f444`], `rebase-apply` state from `git rebase --apply`, linked worktree state isolation in `.git/worktrees/<id>`, detached HEAD rebase with `branch: null`, and `merge` in progress as context).
  - `tests/backend/actions/rebaseControls.test.ts` (8 real-Git tests: `continueRebase` from `edit` stop to completion removing `<gitdir>/ggl-rebase/`, IQ9 refusal while unmerged paths remain without running `git rebase --continue` or staging files, `continueRebase` after resolving and staging a conflict, `continueRebase` pausing again at a second `edit` stop then finishing, `skipRebase` skipping a conflicting commit, `abortRebase` from an `edit` stop restoring branch tip and removing `<gitdir>/ggl-rebase/`, `abortRebase` from a conflict stop restoring branch tip and file content, and finishing/aborting a terminal-started rebase).
  - `tests/webview/repoFileWatcher.test.ts` (3 new tests, 9 → 12: refreshes for `rebase-merge/done`, `rebase-apply`, `MERGE_HEAD` and `REBASE_HEAD` in the git dir; watches a linked worktree's own rebase state and ignores the main worktree's in `commonDir`; folds a burst of 5 `rebase-merge/*` writes into 1 debounced refresh).
  - `tests/webview/rebaseBanner.test.ts` (9 new tests: empty rendering when no rebase is in progress or on `merge`/error; `edit` stop with shortened hash, subject, `(1 of 3)` progress and amend hint; `shortHashLength` compliance; `conflict` stop with file buttons opening `openFile` and Continue disabled with conflict hint title; `"other"` stop with generic hint and Continue enabled; control callbacks; busy state disabling all controls; markup and `$&`/backtick safety in subjects; full `main.ts` integration test covering `operationState` requests, stale/wrong-repo filtering, Abort confirmation dialog via `showConfirmationDialog`, control responses and error dialogs; and `media/rebase-banner.css` token/OKLCH/forced-colors regression test).
  - Suite counts before: backend 120 files, 1,676 passed (60 skipped); webview 85 files, 1,117 passed. After: backend 122 files, 1,694 passed (60 skipped); webview 86 files, 1,129 passed.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 20 touched `.ts`/`.json` files: clean (exit 0).
  - `pnpm run typecheck`: clean (`tsc -p ./src --noEmit && tsc -p ./src/webview --noEmit && tsc -p ./tests --noEmit`, exit 0).
  - Focused tests (`pnpm exec vitest run tests/backend/queries/operationState.test.ts tests/backend/actions/rebaseControls.test.ts tests/webview/rebaseBanner.test.ts tests/webview/repoFileWatcher.test.ts`): 4 files, 43 passed.
  - Full test suite (`pnpm run test`): backend 122 passed (1,694 passed | 60 skipped); webview 86 passed (1,129 passed).
  - `pnpm run l10n:check`: 100.0% complete across all 4 locales (`nl`, `pl`, `zh-cn`, `zh-tw`; 879 bundle keys, 133 package keys).
  - `node ./docs/kb/housekeeping.mjs --check`: clean (exit 0).
  - Headless renders (`PyQt6.QtWebEngineWidgets` + `xvfb-run` with `QT_QPA_PLATFORM=xcb` and `QT_SCALE_FACTOR=2` over the bundled working-tree `src/webview/main.ts` and `media/*.css`), saved under `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/` and visually verified:
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/rebase-banner-edit-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/rebase-banner-edit-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/rebase-banner-conflict-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/rebase-banner-conflict-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/rebase-banner-abort-confirm-dark.png`
  - Sonar: integrator.
- **Acceptance:**
  - Banner above the graph while a rebase is in progress reading `"Rebase in progress: stopped at <short hash> <subject> (<n> of <m>)"` with Continue, Skip and Abort: met (`src/webview/rebaseBanner.ts`, `media/rebase-banner.css`, `#rebaseBannerSlot` in `#topBar`).
  - Conflict stop shows the unmerged file list with an Open file action, blocks Continue while unmerged paths remain (IQ9), tells the user to resolve and stage in the Source Control view, and never runs a silent `add -A`: met (enforced both in `renderRebaseBanner` and in `continueRebase` on the backend).
  - `edit` stop shows `"Stopped to amend; commit your changes, then Continue"`, detected from the merge backend's `amend` state file so a resolved conflict is not mislabelled as an `edit` stop: met.
  - Abort asks for confirmation first (`showConfirmationDialog` with `l10n.rebaseAbortConfirm`): met.
  - Locale-independent detection from files only (`rebase-merge/` with `stopped-sha`, `msgnum`, `end`, `head-name`, `onto`, `amend`, or `rebase-apply/` with `original-commit`, `next`, `last`; plus `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD` for context, never `REBASE_HEAD` alone) and `git diff --name-only --diff-filter=U -z`: met.
  - Git commands `git rebase --continue` (with `GIT_EDITOR=true`), `git rebase --skip`, `git rebase --abort` through the recorded runner with labels `rebase.continue`, `rebase.skip`, `rebase.abort`, and removal of `<gitdir>/ggl-rebase/` when the rebase finishes or is aborted (F2-01b follow-up): met.
  - Watcher watches `rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `REBASE_HEAD` in the per-worktree git dir (`gitDir`/`sharedDir`, not `commonDir` of another worktree) and debounces bursts of state-file writes into a single refresh: met.
  - Localization in all five bundles (`rebase.*` block placed immediately before the first `reflog.*` key; `nl`, `pl`, `zh-cn`, `zh-tw` translated by the agents — a native review would help): met.
  - Real-Git tests and webview tests covering all required scenarios: met.
- **Deviations from the slice:**
  - Minimal glue in `src/backend/types/actions.types.ts`, `src/backend/types/queries.types.ts`, `src/extension/messageHandler.ts` and `src/extension/webviewHtml.ts` (alongside `src/types.ts`, which re-exports the state shapes): required so the `operationState` query and `continueRebase`/`skipRebase`/`abortRebase` actions are typed, registered on the message bridge, and have `#rebaseBannerSlot` and `media/rebase-banner.css` in the webview document (matching F2-01b and F2-02).
  - `tests/webview/repoFileWatcher.test.ts` extended with 3 unit tests for the `src/repoFileWatcher.ts` changes in this slice's Touch list.
- **Open questions / follow-ups:**
  - Native speaker review of the 14 `rebase.*` translations in `nl`, `pl`, `zh-cn`, and `zh-tw` would be welcome.
