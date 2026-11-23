---
summary: >-
  F1-06: Recovers from a reflog entry: create branch here (first), create tag
  here, check out detached, copy hash, show in graph, and reset the current
  branch through the existing reset dialog (mixed by default, hard behind its
  second confirmation).
---

# F1-06 — Recovery actions that cannot lose data

Status: done — awaiting integration

Needs: F1-08

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

`src/extension/reflogTab/*`; `src/webview/reflogTab/*`; reuse of the
existing actions in `src/backend/actions/*` without changing their behavior;
the existing dialogs; `src/extension/webviewPanel.ts` (or the graph's message
path) only for "Show in Graph"; the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- Actions per entry: "Create Branch Here…" (first, never moves HEAD),
  "Create Tag Here…", "Check Out (Detached)" with today's dirty-tree handling,
  "Copy Hash", "Show in Graph" (reveals the commit when the graph has it,
  otherwise offers to turn on `includeReflog` for the repository with a
  visible note, never silently) and "Reset Current Branch to Here…" through
  the existing reset dialog: mixed by default, hard only behind the existing
  second confirmation that names what is lost.
- A `missing` entry disables every action and says why.
- Only Git commands the product already runs: `git branch`, `git tag`,
  `git checkout --detach`, and the existing reset modes.
- Tests with real Git: make a commit unreachable with a hard reset and
  recover it through each action; a dirty working tree on checkout; the
  missing case; assertions that no action moves any ref except the intended
  one.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Gemini 4 Argon (agy, initial commits `2a34c3e1`–`70db9757`, cut off by quota) + Gemini 4 Neon (agy, completion and fixes `8c683c90`–HEAD), 2026-11-23 13:16
- **Branch and commits:** `reflog/F1-06` (base `4f23e530`):
  - `2a34c3e1 G docs(reflog): claim slice F1-06 (F1-06)`
  - `d5b96a01 G feat(reflog): add recovery action types and localized labels (F1-06)`
  - `b09a8ebd G feat(reflog): run safe recovery actions through existing backend actions (F1-06)`
  - `70db9757 G feat(reflog): wire recovery action messages, copyHash, and Show in Graph (F1-06)`
  - `8c683c90 G feat(reflog): add recovery context menu and dialogs in reflog webview (F1-06)`
  - `d9272d56 G fix(reflog): fix l10n keys, worktree Show in Graph routing, and forced-colors styles (F1-06)`
  - plus the signed report/status commit on top of `d9272d56`
- **Files changed:** 24 files changed (`+2276 / -39` before report commit):
  - `docs/kb/050-ongoing-work/080-reflog-tab/150-f1-06-safe-recovery-actions.md`
  - `l10n/bundle.l10n.{json,nl.json,pl.json,zh-cn.json,zh-tw.json}` (+11 keys each, placed inside the `reflog.*` block immediately before `"reflog.action.commit"`; translated nl, pl, zh-cn, zh-tw by agent — native review would help)
  - `src/reflogTabTypes.ts` (+165/-1)
  - `src/extension/reflogTab/reflogData.ts` (+114/-10)
  - `src/extension/reflogTab/reflogTabHtml.ts` (+23/-1)
  - `src/extension/reflogTab/reflogTabPanel.ts` (+144/-8)
  - `src/extension/webviewPanel.ts` (+40/-1)
  - `src/types.ts` (+13)
  - `src/webview/main.ts` (+53)
  - `src/webview/reflogTab/dialogs.ts` (+559, new)
  - `src/webview/reflogTab/main.ts` (+11)
  - `src/webview/reflogTab/rowModel.ts` (+2/-1)
  - `src/webview/reflogTab/view.ts` (+53/-4)
  - `tests/webview/reflogTab/fixtures.ts` (+44/-1)
  - `tests/webview/reflogTab/main.test.ts` (+51)
  - `tests/webview/reflogTab/reflogData.test.ts` (+262)
  - `tests/webview/reflogTab/rowModel.test.ts` (+93/-2)
  - `tests/webview/reflogTab/view.test.ts` (+324/-3)
  - `tests/webview/reflogTabPanel.test.ts` (+244)
  - `tests/webview/webviewPanel.test.ts` (+31/-1)
- **Tests added or changed:** +21 tests in the webview project (1,142 → 1,163; backend unchanged at 1,578 passed / 60 skipped in linked worktree):
  - `tests/webview/reflogTab/rowModel.test.ts`: validation of `normalizeReflogRecoveryAction` (all 4 kinds, dash-led/control-char rejections, worktree path bounds)
  - `tests/webview/reflogTab/reflogData.test.ts`: 6 real-Git tests — hard-reset unreachable commit recovered via Create Branch Here (without moving HEAD or any other ref), Create Tag Here (lightweight and annotated), Check Out (Detached) with non-conflicting and conflicting dirty working trees, Reset Current Branch (mixed, soft, hard) without moving other branches, `missing` object refused on every action with zero ref movement, and F1-08 worktree routing (runs in target worktree, refuses unlisted and prunable/stale worktrees without touching current worktree)
  - `tests/webview/reflogTabPanel.test.ts`: 6 tests — recovery action execution + refresh on success, error reply without reload on failure, `copyHash` + clipboard failure reporting, `showInGraph` with explicit `includeReflog` confirmation, F1-08 worktree targeting for `showInGraph`, and regression test verifying every `l10n.t(...)` key in `reflogTabPanel.ts` exists in `l10n/bundle.l10n.json`
  - `tests/webview/webviewPanel.test.ts`: 1 test — `showCommitInGraph` reveals panel, sets `includeReflog` only when confirmed, posts `showCommit`, clears on dispose
  - `tests/webview/reflogTab/view.test.ts`: 6 tests — menu ordering with Create Branch Here first, `missing` entry disables all 6 actions with reason header and tooltip, validation and submission for Create Branch / Create Tag (annotated & lightweight) / Check Out / Copy Hash, Show in Graph reachable vs reflog-only confirmation note, Reset Current Branch defaults to mixed / names "the current branch" even when viewing another branch reflog / requires second confirmation for hard reset naming discarded staged and working-tree changes, and error dialog rendering
  - `tests/webview/reflogTab/main.test.ts`: 1 test — webview message round-trip for `copyHash`, `showInGraph`, `action`, and `reflogActionResult` error display
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings <all 23 touched .ts/.json files>`: 23 files checked, 0 errors, 0 warnings
  - `pnpm run l10n:check`: 877/877 bundle keys (100% in nl, pl, zh-cn, zh-tw), 133/133 package.nls keys (100%)
  - `pnpm run package` (`typecheck` + `biome lint .` + `node esbuild.js --production`): passed (405 files checked, 0 errors)
  - `pnpm run test`: backend 118 files, 1,578 passed / 60 skipped (expected in linked worktree); webview 85 files, 1,163 passed (0 failed)
  - `node ./docs/kb/housekeeping.mjs --check`: passed (verified after updating this slice file)
  - Headless visual renders (PyQt6 QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, `QT_SCALE_FACTOR=2`, inspected all 10 PNGs):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/menu-reflogonly-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/menu-reflogonly-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/menu-missing-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/menu-missing-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/dialog-reset-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/dialog-reset-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/dialog-reset-hard-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/dialog-reset-hard-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/dialog-show-in-graph-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-06/dialog-show-in-graph-light.png`
  - Sonar: integrator
- **Acceptance:**
  - Six actions per entry in order with "Create Branch Here…" first (never moves HEAD), "Create Tag Here…", "Check Out (Detached)" with today's dirty-tree handling, "Copy Hash", "Show in Graph" (reveals directly when reachable, offers to turn on `includeReflog` with a visible note for reflog-only commits, never silently), and "Reset Current Branch to Here…" reusing the existing reset dialog (mixed default, hard behind a second confirmation naming discarded staged and working-tree changes): **met** (`dialogs.ts`, `reflogData.ts`, `reflogTabPanel.ts`, `webviewPanel.ts`, `main.ts`, `view.test.ts`, `reflogData.test.ts`, headless renders).
  - `missing` entry disables every action and explains why: **met** (`dialogs.ts` header + disabled items with tooltip, `reflogTabHtml.ts` disabled & forced-colors styles, `reflogData.ts` backend guard, `view.test.ts`, `reflogData.test.ts`, `menu-missing-{dark,light}.png`).
  - Only Git commands the product already runs, reusing `src/backend/actions/{branch,tag,commit}.ts` unchanged: **met** (`git diff 4f23e530..HEAD -- src/backend/actions/` is empty).
  - Real-Git tests covering hard-reset recovery through each action, dirty working tree on checkout, missing object, ref-isolation assertions, and F1-08 worktree routing/refusals: **met** (`tests/webview/reflogTab/reflogData.test.ts`).
  - No new telemetry events or declarations: **met** (`telemetry.json` and telemetry modules untouched).
- **Deviations from the slice:** Minimal glue in `src/types.ts` (`ResponseShowCommit`) and `src/webview/main.ts` (`showCommit` response handler) to complete the graph's message path for "Show in Graph" alongside `src/extension/webviewPanel.ts`. No files in `src/backend/actions/*` were modified.
- **Open questions / follow-ups:** Native review of the agent-authored `nl`, `pl`, `zh-cn`, and `zh-tw` translations for the 11 new `reflog.*` keys would help.
