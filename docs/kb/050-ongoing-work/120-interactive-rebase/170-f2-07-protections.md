---
summary: >-
  F2-07: the protections for starting an interactive rebase: autostash for a
  dirty tree with an explained choice, an acknowledgement before rewriting
  published commits, a disabled entry for a branch checked out in another
  worktree, and a prompt for a very long range. Waits for F2-04 and decision IQ5.
---

# F2-07 — Dirty tree, published history and worktree protections

Status: done — awaiting integration

Needs: F2-04; decision IQ5 confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.1 (Dirty tree), 1.3 (Branch checked out in another
worktree), 4 (F2-07) and 5 (IQ5) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/webview/rebaseEditor/*`: the dirty-tree choice, the acknowledgement, the disabled state, the long-range prompt
- `src/backend/rebase/preflight.ts` (from F2-02): the reasons only
- `src/backend/actions/rebaseInteractive.ts`: `--autostash` and a `--no-autostash` pass-through
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/actions/rebaseInteractive.test.ts` (extended), `tests/webview/rebaseEditor/protections.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Dirty tree.** The dialog offers "Stash and reapply local changes"
(`--autostash`) and "Cancel", and explains the choice in one sentence. Without
the choice, Git refuses; the refusal is shown with Git's stderr.

**Published commits (IQ5, recommended: warn and require acknowledgement).** When
the range has published commits, Start needs an explicit acknowledgement
checkbox, and the published commits are listed. No force push is offered or
run by this slice.

**Branch in another worktree.** The entry is disabled, with the reason
"checked out at <path>", and offers Open Worktree where W31 exists. Use the
worktree data, and the preflight's `alreadyUsedElsewhere`.

**Rebase already in progress.** The entry is disabled and points at the F2-03
banner.

**Very long range.** When the preflight marks `tooLong`, Start asks for
confirmation first.

**Autostash conflicts.** When the stash pop conflicts, Git keeps the stash and
says so. The F2-03 state read must notice "Applying autostash resulted in
conflicts" in a way that does not parse text: check the stash entry and the
unmerged paths instead. Show the stash entry is kept.

**Tests (real Git):** autostash success; autostash with a conflict leaves the
stash entry and the message; the refusal copy for a branch checked out in
another worktree; published ahead and behind variants with a bare remote.

**Localization.** About ten strings.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

- **Agent / date:** Gemini 4 Neon (agy), 2026-11-23 17:53
- **Branch and commits:** `rebase/F2-07` (base `688fe71e`)
  - `37ca6a54 G docs(rebase): claim slice F2-07 (F2-07)`
  - `45ee285c G feat(rebase): add autostash pass-through and preflight option (F2-07)`
  - `5489ace9 G feat(rebase): detect and display autostash conflicts without text parsing (F2-07)`
  - `2a5aec42 G feat(rebase): add editor protections for dirty tree, published ack, worktrees and long ranges (F2-07)`
  - `79dab2b5 G feat(rebase): disable menu entries for worktree and in-progress conflicts and wire editor protections (F2-07)`
  - `1a16cfea G test(rebase): add webview protection unit and integration tests (F2-07)`
  - `dd1187b3 G style(rebase): align editor protection checkboxes flush with notice text (F2-07)`
  - plus this report commit
- **Files changed:** 27 files changed, +1,890 / -143 lines (`git diff --stat 688fe71e..dd1187b3`; ~777 lines outside tests and l10n):
  - `src/backend/actions/rebaseInteractive.ts` (+19 / -2)
  - `src/backend/queries/operationState.ts` (+70 / -2)
  - `src/backend/rebase/preflight.ts` (+23 / -1)
  - `src/backend/types/actions.types.ts` (+6 / -0)
  - `src/backend/types/queries.types.ts` (+18 / -3)
  - `src/extension/webviewL10n.ts` (+13 / -0)
  - `src/webview/global.d.ts` (+2 / -0)
  - `src/webview/main.ts` (+72 / -23)
  - `src/webview/rebaseBanner.ts` (+51 / -2)
  - `src/webview/rebaseEditor/index.ts` (+1 / -0)
  - `src/webview/rebaseEditor/model.ts` (+54 / -10)
  - `src/webview/rebaseEditor/protections.ts` (+292 / -0, new)
  - `src/webview/rebaseEditor/view.ts` (+88 / -96)
  - `media/checkbox.css` (+10 / -0)
  - `media/dialogs.css` (+24 / -0)
  - `media/rebase-editor.css` (+91 / -0)
  - `l10n/bundle.l10n.json`, `.nl.json`, `.pl.json`, `.zh-cn.json`, `.zh-tw.json` (+13 each, inside existing `rebase.*` block)
  - `tests/backend/actions/rebaseInteractive.test.ts` (+135 / -0)
  - `tests/backend/queries/operationState.test.ts` (+42 / -0)
  - `tests/backend/rebase/preflight.test.ts` (+37 / -1)
  - `tests/webview/rebaseBanner.test.ts` (+23 / -0)
  - `tests/webview/rebaseEditor/protections.test.ts` (+755 / -0, new)
  - `docs/kb/050-ongoing-work/120-interactive-rebase/170-f2-07-protections.md` (Status + Report)
- **Tests added or changed:**
  - `tests/backend/rebase/preflight.test.ts` (+2 tests: `autostash` option and `effectiveRebasePreflight`)
  - `tests/backend/actions/rebaseInteractive.test.ts` (+5 real-Git tests: autostash success, `--no-autostash` refusal with `rebase.autoStash=true`, autostash conflict keeping `stash@{0}` and setting `autostashConflict`, branch checked out in another worktree preflight refusal, published ahead/behind/diverged variants with a bare remote)
  - `tests/backend/queries/operationState.test.ts` (+2 real-Git tests: autostash conflict detection without text parsing + clear after staging, regular stash ignored when no unmerged paths)
  - `tests/webview/rebaseBanner.test.ts` (+1 test: autostash conflict banner showing kept `stash@{0}` and clickable conflict files)
  - `tests/webview/rebaseEditor/protections.test.ts` (+12 tests: dirty tree autostash choice/explanation/Cancel, dirty+other blocker, IQ5 published commit list & acknowledgement checkbox gating Start without force push, >12 published cap, worktree conflict reason + Open Worktree button, in-progress rebase banner pointer, very-long-range confirmation preserving edits on Cancel, menu disabled state evaluator, CSS token/OKLCH/forced-colors checks, full webview integration for disabled commit/branch menus, autostash forwarding, conflict banner, and stderr refusal display)
  - Counts: backend `1,709` → `1,718` passed (`60` skipped, expected in linked worktrees, 126 files); webview `1,190` → `1,203` passed (97 files).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 23 touched `.ts`/`.json` files: pass (0 errors, 0 warnings)
  - `pnpm run typecheck`: pass
  - `pnpm run l10n:check`: pass (960/960 keys, 100% across `nl`, `pl`, `zh-cn`, `zh-tw`; translations by agent — a native review would help)
  - `node ./docs/kb/housekeeping.mjs --check`: pass
  - `pnpm run test`: pass — backend 126 files (`1,718 passed | 60 skipped`), webview 97 files (`1,203 passed`)
  - Headless renders (PyQt6 QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, real `media/*.css` + esbuild browser bundle), visually inspected in dark and light (and caught/fixed a default checkbox margin misalignment in `dd1187b3`):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-07/rebase-editor-protections-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-07/rebase-editor-protections-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-07/rebase-editor-worktree-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-07/rebase-editor-worktree-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-07/rebase-banner-autostash-conflict-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-07/rebase-banner-autostash-conflict-light.png`
  - Forced-colors styles are pinned by CSS regression tests (`protections.test.ts`, `dialogStyles.test.ts`, `view.test.ts`); not separately rendered.
  - Clean-room note: implemented from Git 2.56 behavior probed in temporary repositories, VS Code APIs, and this repository's own patterns; any Git Graph+ background in the research notes was behavioral only and no code was copied.
  - Sonar: integrator
- **Acceptance:**
  - **Dirty tree:** met — editor renders the dirty-tree notice explaining the choice in one sentence (`rebase.dirtyExplain`) with the `.checkRow` checkbox `"Stash and reapply local changes (--autostash)"` (`#rebaseEditorAutostash`) and Cancel (`#dialogDismiss`); `runInteractiveRebase` passes `--autostash` / `--no-autostash` and surfaces Git's stderr on refusal (`rebaseInteractive.test.ts`, `protections.test.ts`).
  - **Published commits (IQ5):** met — `requirePublishedAck` now defaults to `true`, the warning notice lists published commits (`shortHash` + subject, capped at 12 + `+N more`) and requires `#rebaseEditorPublishedAck` before Start enables; no force push is offered or run (`protections.test.ts`).
  - **Branch in another worktree:** met — commit, multi-select, and branch menus disable `"Interactive Rebase…"` with reason `"Checked out at <path>"` and offer W31 `"Open Worktree…"` right beside it; editor dialog also renders `"This branch is checked out at <path>."` + inline `"Open Worktree…"` button when `alreadyUsedElsewhere` blocks Start (`rebaseInteractive.test.ts`, `protections.test.ts`).
  - **Rebase already in progress:** met — menus disable `"Interactive Rebase…"` pointing at the banner above (`rebase.menuDisabledInProgress`), and the editor dialog's `inProgress` blocker points at the F2-03 banner when `inProgressKind === "rebase"` (`protections.test.ts`).
  - **Very long range:** met — `tooLong` displays a warning notice and Start / `Ctrl+Enter` opens an inline confirmation prompt (`#rebaseEditorLongRangePrompt`) that preserves todo edits on Cancel and runs Start on Confirm (`protections.test.ts`).
  - **Autostash conflicts:** met — `loadOperationState` detects post-rebase autostash conflicts without parsing Git text by checking `refs/stash` (in `commonDir`, zero Git calls on clean repos), unmerged paths (`git diff --diff-filter=U -z`), and the top stash reflog entry (`%gs === "autostash"`), and `renderRebaseBanner` displays the kept stash selector (`stash@{0}`) and clickable conflict files (`operationState.test.ts`, `rebaseBanner.test.ts`, `protections.test.ts`).
  - **Tests (real Git):** met — autostash success, `--no-autostash` refusal, autostash conflict keeping `stash@{0}` + `loadOperationState` detection, worktree `alreadyUsedElsewhere` refusal, and bare-remote published ahead/behind/diverged variants (`rebaseInteractive.test.ts`, `operationState.test.ts`).
  - **Localization:** met — 13 new keys added in the `rebase.*` block across all five bundles, reusing `l10n.openWorktree` and `l10n.dialogCancel`; `pnpm run l10n:check` reports 100% (agent-translated for `nl`, `pl`, `zh-cn`, `zh-tw`; native review recommended).
- **Deviations from the slice:**
  - Minimal unavoidable glue edits outside the Touch list:
    - `src/backend/types/actions.types.ts`: added optional `autostash?: boolean` to `ActionPayloads["interactiveRebase"]` so the `--autostash`/`--no-autostash` pass-through typechecks across webview and backend.
    - `src/backend/types/queries.types.ts`, `src/backend/queries/operationState.ts`, `src/webview/rebaseBanner.ts` (and their tests `operationState.test.ts`, `rebaseBanner.test.ts`): required by the slice's "Autostash conflicts" acceptance item ("The F2-03 state read must notice ... check the stash entry and the unmerged paths instead. Show the stash entry is kept.").
    - `src/webview/global.d.ts`, `src/webview/main.ts`, `media/dialogs.css`: minimal glue for disabled context menu items (`disabled`, `reason`) so "Interactive Rebase…" disables cleanly in commit/multi-select/branch menus for in-progress rebases and worktree-held branches (offering Open Worktree via W31), and to pass `otherWorktreePath`, `onOpenWorktree`, `autostash`, and `autostashConflict` through.
    - `media/rebase-editor.css`, `media/checkbox.css`: styling for the new editor protection rows, published list, long-range prompt, and joining the shared `.checkRow` / `checkbox.css` rule set per the Webview UI Styling Guide.
- **Open questions / follow-ups:**
  - Parallel merge with F2-05: F2-07's logic is isolated in `src/webview/rebaseEditor/protections.ts` with minimal hooks in `model.ts`/`view.ts` (untouched row rendering) and new l10n keys appended to the end of the `rebase.*` block so the integrator can rebase/merge both cleanly.
  - Native review of agent-authored `nl`, `pl`, `zh-cn`, `zh-tw` translations for the 13 new `rebase.*` keys is welcome.
