---
summary: >-
  F2-08: a conflict prediction for the todo the user has planned: a debounced
  status line in the editor that names the first conflicting commit and its
  files, built from `git merge-tree --write-tree` replays, labeled as a
  prediction. Waits for F2-04, F2-05 and decision IQ7.
---

# F2-08 — Conflict prediction for the planned todo

Status: done — awaiting integration

Needs: F2-04, F2-05; decision IQ7 (follow-up release) confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.2 (Prediction), 4 (F2-08) and 5 (IQ7) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/queries/rebasePrediction.ts` (new)
- `src/webview/rebaseEditor/*`: the status line, debounced
- `src/extension/webviewL10n.ts` and `l10n/bundle.l10n*.json`
- tests: `tests/backend/queries/rebasePrediction.test.ts` (real Git), `tests/webview/rebaseEditor/prediction.test.ts`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Behavior.** A status line in the editor reads "No conflicts predicted", or
"Conflict at <hash>: <n> files", with the file list in the popover pattern used
elsewhere in the project. It is re-evaluated, debounced, when the todo changes.
When the range exceeds the probe limit, the line says the result is capped.
The line always labels the result as a prediction.

**Method.** Simulate the todo in order. For each non-dropped `pick`, run `git
merge-tree --write-tree --merge-base=<commit>^ <accumulated> <commit>`, and
chain the printed tree OID into the next probe. A `squash` or `fixup` merges
its commit onto the accumulated tree against its own parent the same way.
Stop at the first conflict. Exit status 1 means conflict; file names come from
the `-z` conflicted-file information, never from messages. Cap the number of
probes at a probe limit and say so. Git older than 2.40 (no `--write-tree`
with `--merge-base`) gets "prediction unavailable".

**Limits to state in the code's comment and in the Report.** This models a
merge, not Git's exact rebase. Rename detection and whitespace settings may
differ. The cost grows with the range.

**Tests (real Git):** a reorder with no conflict; a reorder that conflicts
(names the commit and the file); a drop that causes a later conflict; a squash
that conflicts; a non-ASCII path; a fixup chain; the probe cap; Git older than
2.40 through an injected "unsupported" result (the check is injected, not the
Git binary).

**Localization.** About six strings.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

- **Agent / date:** Gemini 4 Neon (agy), 2026-11-23 18:20
- **Branch and commits:** `rebase/F2-08` (base `6b1d7555`) —
  - `95010963 G docs(rebase): claim F2-08 (F2-08)`
  - `6840c0c6 G feat(rebase): add conflict prediction query and handler (F2-08)`
  - `9438d701 G test(rebase): add real-Git conflict prediction query tests (F2-08)`
  - `9b65efa6 G feat(l10n): add conflict prediction strings in all bundles (F2-08)`
  - `ccb0d086 G feat(rebase): add debounced conflict prediction status line and popover (F2-08)`
  - `82514b71 G test(rebase): add conflict prediction webview and CSS tests (F2-08)`
  - `915b3c5f G style(rebase): add full opaque background fallback chain on prediction popover (F2-08)`
  - `b5b49003 G test(rebase): match multiline popover background fallback chain in CSS guard (F2-08)`
  - plus this final report/status commit
- **Files changed** (`git diff --stat 6b1d7555..HEAD` prior to this report commit: 17 files, +2306 / −2):
  - `src/backend/queries/rebasePrediction.ts` (+551)
  - `src/backend/types/queries.types.ts` (+45)
  - `src/extension/messageHandler.ts` (+16)
  - `src/extension/webviewL10n.ts` (+8)
  - `src/webview/rebaseEditor/prediction.ts` (+399)
  - `src/webview/rebaseEditor/index.ts` (+1)
  - `src/webview/rebaseEditor/view.ts` (+23)
  - `src/webview/main.ts` (+35)
  - `media/rebase-editor.css` (+174 / −1)
  - `l10n/bundle.l10n.json` (+8)
  - `l10n/bundle.l10n.nl.json` (+8)
  - `l10n/bundle.l10n.pl.json` (+8)
  - `l10n/bundle.l10n.zh-cn.json` (+8)
  - `l10n/bundle.l10n.zh-tw.json` (+8)
  - `tests/backend/queries/rebasePrediction.test.ts` (+464)
  - `tests/webview/rebaseEditor/prediction.test.ts` (+550)
  - `docs/kb/050-ongoing-work/120-interactive-rebase/180-f2-08-conflict-prediction.md` (Status + Report)
- **Tests added or changed:**
  - `tests/backend/queries/rebasePrediction.test.ts` (20 tests: `parseGitVersion`, `supportsMergeTreeMergeBase`, `parseMergeTreeOutput`, plus real-Git integration cases for clean reorder, conflicting reorder naming commit and file, drop causing later conflict, squash conflict, non-ASCII path, clean and broken fixup chains, probe cap, injected Git <2.40 unsupported check, `--root` rebase and all-dropped todo, and input validation)
  - `tests/webview/rebaseEditor/prediction.test.ts` (5 tests: debouncing + coalescing + message/selection no-op + stale-response rejection, capped/unavailable/error status labels, conflict status with `shortHashLength` + click/hover/Escape/outside-click/destroy popover behavior + safe `textContent` rendering, full `main.ts` message-flow integration, and CSS token/OKLCH/reduced-motion/forced-colors guards)
  - Counts before → after: backend 1,734 passed (60 skipped) → 1,754 passed (60 skipped, 127 files); webview 1,216 passed → 1,221 passed (98 files).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 15 touched `.ts`/`.json` files: passed (0 errors, 0 warnings)
  - `pnpm run typecheck`: passed
  - `pnpm run l10n:check`: passed (980 keys, 100.0% across `nl`, `pl`, `zh-cn`, `zh-tw`; 134 `package.nls.*` keys, 100.0%)
  - `pnpm run test`: passed — backend 127 files, 1,754 passed | 60 skipped (linked-worktree skip expected); webview 98 files, 1,221 passed
  - `node ./docs/kb/housekeeping.mjs --check`: passed
  - Headless renders (PyQt6 QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, `QT_SCALE_FACTOR=2`, visually inspected):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-08/rebase-editor-prediction-clean-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-08/rebase-editor-prediction-clean-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-08/rebase-editor-prediction-conflict-popover-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-08/rebase-editor-prediction-conflict-popover-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-08/rebase-editor-prediction-capped-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-08/rebase-editor-prediction-capped-light.png`
  - Sonar: integrator
- **Acceptance:**
  - Clean-room: Git Graph+ reading was behavioral only; implemented from Git's `git merge-tree --write-tree` documentation, VS Code APIs, and this project's own patterns; no code copied.
  - Status line in editor reading "Prediction: no conflicts predicted", "Prediction: conflict at `<shortHash>`: `<n>` file(s)" (respecting `shortHashLength`), capped notice, checking state, and unavailable state — every state explicitly labels the result as a prediction: met (`src/webview/rebaseEditor/prediction.ts`, verified by `prediction.test.ts` and headless renders).
  - Conflicted file list in body-mounted hover/click popover matching `.componentStatusPopup`/`.dialogLockHint` (`--vscode-editorHoverWidget-*` tokens, `z-index: 410`, Escape/outside-click/hover grace): met (`prediction.ts`, `media/rebase-editor.css`, verified by `prediction.test.ts` and conflict-popover renders).
  - Debounced re-evaluation on todo order/action changes (250 ms, ignoring message/selection edits and stale replies): met (`prediction.ts`, `view.ts`, `main.ts`, verified by `prediction.test.ts`).
  - `git merge-tree --write-tree -z --name-only --no-messages --merge-base=<parent> <accumulated> <commit>` simulation chaining tree OIDs across `pick`/`reword`/`edit`/`squash`/`fixup`, skipping `drop`, stopping at first conflict (exit 1), parsing paths only from `-z` conflicted-file info, capping at `DEFAULT_PREDICTION_PROBE_LIMIT` (20), and returning `"unavailable"` when Git < 2.40: met (`src/backend/queries/rebasePrediction.ts`, verified by `rebasePrediction.test.ts`).
  - Limits documented in code comment (`src/backend/queries/rebasePrediction.ts`) and here: this models a merge, not Git's exact rebase; rename detection and whitespace settings may differ from an actual rebase; the cost grows with the range (capped at 20 probes by default).
  - Translations: all 8 `rebase.prediction*` strings added to all five l10n bundles; `nl`, `pl`, `zh-cn`, and `zh-tw` were translated by the agent and would benefit from native review.
- **Deviations from the slice:**
  - Minimal unavoidable glue edits outside the Touch list: `src/backend/types/queries.types.ts` (request/response/result types for the new `rebasePrediction` query), `src/extension/messageHandler.ts` (handler registration for `rebasePrediction`), `src/webview/main.ts` (wiring `onPredict` and `rebasePrediction` response handling into `showRebaseEditorDialog` and `responseHandlers`), and `media/rebase-editor.css` (styles for the prediction status line, trigger, and body-mounted popover). `src/webview/rebaseEditor/model.ts` was left untouched to avoid merge conflicts with parallel F2-06/F2-10 work.
  - Added 8 l10n keys (slice estimated ~6) to cover singular/plural conflict counts, checking, clean, capped, unavailable (Git < 2.40), failed, and the popover heading.
- **Open questions / follow-ups:**
  - Native review of agent-translated `rebase.prediction*` strings in `nl`, `pl`, `zh-cn`, and `zh-tw`.
  - Forced-colors styling for the prediction status line and popover is pinned by CSS guard tests in `tests/webview/rebaseEditor/prediction.test.ts`, not rendered separately.
