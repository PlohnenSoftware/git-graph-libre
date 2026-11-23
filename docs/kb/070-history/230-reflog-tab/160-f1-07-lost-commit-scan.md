---
summary: >-
  F1-07: An opt-in "Scan for Lost Commits…" in the Reflog tab that finds
  commits no ref and no reflog reaches, with Git's read-only fsck, lists them,
  and offers Create Branch Here.
---

# F1-07 — Lost-commit scan (opt-in)

Status: done — awaiting integration

Needs: F1-06

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`070-history/230-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
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

New `src/backend/queries/lostCommits.ts`; `src/backend/queries/loadCommits.ts`
only to export and reuse its unreachable-commit parser; `src/extension/reflogTab/*`;
`src/webview/reflogTab/*`; `media/reflog-tab/*`; the reflog strings module;
`l10n/bundle.l10n*.json`; tests; the slice file's Status and Report.

## Task and acceptance

- Runs `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
  (the same scan the graph setting uses), then reads each commit's subject
  and date. Never `--lost-found`, and never a garbage collection or prune.
- Shows progress, can be cancelled, and has a timeout; says plainly that
  these commits disappear when Git collects garbage.
- Offers "Create Branch Here…" (F1-06's action) for each result.
- Tests: a fixture with a dropped stash and an abandoned commit; cancel and
  timeout; an empty result.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Gemini 4 Neon (agy), 2026-11-23 13:01
- **Branch and commits:** `reflog/F1-07` —
  - `32b83a33 G docs(kb): claim lost-commit scan slice (F1-07)`
  - `e2b15ae4 G feat(reflog): add read-only lost-commit scan query (F1-07)`
  - `b5d7a2d8 G feat(l10n): add lost-commit scan strings in all five locales (F1-07)`
  - `d0a483f7 G feat(reflog): wire opt-in lost-commit scan and Create Branch Here UI (F1-07)`
  - `18250ca1 G test(reflog): cover lost-commit scan data, panel, view, and CSS (F1-07)`
  - `8330ecb5 G style(reflog): align lost-commit Action header and row cells (F1-07)`
  - (plus this report commit)
- **Files changed:** 24 files before this report commit (+2086/−16):
  - `src/backend/queries/lostCommits.ts` (new, +420)
  - `src/extension/reflogTab/lostCommitsController.ts` (new, +193)
  - `src/extension/reflogTab/reflogData.ts` (+63)
  - `src/extension/reflogTab/reflogTabPanel.ts` (+41/−2)
  - `src/reflogTabTypes.ts` (+75/−2)
  - `src/webview/reflogTab/lostCommitsView.ts` (new, +195)
  - `src/webview/reflogTab/main.ts` (+19)
  - `src/webview/reflogTab/rowModel.ts` (+54/−3)
  - `src/webview/reflogTab/view.ts` (+24/−2)
  - `media/reflog-tab/reflog-tab.css` (+148/−3)
  - `l10n/bundle.l10n.json`, `l10n/bundle.l10n.nl.json`, `l10n/bundle.l10n.pl.json`, `l10n/bundle.l10n.zh-cn.json`, `l10n/bundle.l10n.zh-tw.json` (+14 each; 14 new `reflog.lostCommits.*` keys immediately before `reflog.action.commit`; translated by this agent — a native review would help)
  - `tests/backend/queries/lostCommits.test.ts` (new, +261)
  - `tests/webview/reflogTab/fixtures.ts` (+43)
  - `tests/webview/reflogTab/reflogData.test.ts` (+49)
  - `tests/webview/reflogTabPanel.test.ts` (+229/−1)
  - `tests/webview/reflogTab/rowModel.test.ts` (+30)
  - `tests/webview/reflogTab/view.test.ts` (+134/−2)
  - `tests/webview/reflogTab/main.test.ts` (+20/−1)
  - `tests/webview/reflogTab/reflogTabCss.test.ts` (+16)
  - `docs/kb/070-history/230-reflog-tab/160-f1-07-lost-commit-scan.md` (Status and Report)
- **Tests added or changed:** 24 new tests (11 backend, 13 webview/extension):
  - `tests/backend/queries/lostCommits.test.ts` (+11): `parseLostCommitRecords` sorting/dedup/malformed records; real-Git dropped stash + abandoned commit discovery without `.git/lost-found`; empty clean repo; U1 non-zero `fsck` exit tolerance; genuine `fsck` failure (`stderr` only); missing `gitPath`; pre-aborted and in-flight cancel; timeout; real child process cancel and timeout via `runBoundedGitProcess`.
  - `tests/webview/reflogTab/reflogData.test.ts` (+2): real-Git `scanLostCommits` + `createBranch` recovery without moving `HEAD` + rescan excludes recovered commit; invalid hash / dash-led branch name rejection.
  - `tests/webview/reflogTabPanel.test.ts` (+5): scan progress/results + replay on `ready` + no extra telemetry; cancel / close / repo switch / dispose aborting in-flight scan; timeout & error states; `createLostCommitBranch` prompt/validation/branch creation/list update/refresh; failed branch creation feedback.
  - `tests/webview/reflogTab/rowModel.test.ts` (+1): `applyLostCommits`, stale `scanId` & foreign repo drop, repo-switch reset.
  - `tests/webview/reflogTab/view.test.ts` (+3): idle/scanning/cancel UI; results table with GC warning, `Create Branch Here…`, busy state, feedback; empty/canceled/timed-out/error states.
  - `tests/webview/reflogTab/main.test.ts` (+1): message round-trip for scan, cancel, create-branch, close.
  - `tests/webview/reflogTab/reflogTabCss.test.ts` (+1): theme tokens, alignment rules, `prefers-reduced-motion`, and `forced-colors` button outlines.
  - Counts: backend 1,579 → 1,590 passed (60 skipped in linked worktree, 119 files); webview 1,210 → 1,223 passed (92 files).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings <all 22 touched .ts/.json files>`: clean (0 errors, 0 warnings)
  - `pnpm run typecheck`: clean
  - `pnpm run l10n:check`: 100% complete across `nl`, `pl`, `zh-cn`, `zh-tw` (896 bundle keys, 134 package keys)
  - `pnpm run test`: backend 119 files / 1,590 passed / 60 skipped; webview 92 files / 1,223 passed
  - `node ./docs/kb/housekeeping.mjs --check`: clean
  - Headless renders (`PyQt6` QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, `QT_SCALE_FACTOR=2`) inspected and refined (aligned Action header right over buttons, middle-aligned lost-commit row cells):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-07/dark-results.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-07/light-results.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-07/dark-scanning.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F1-07/dark-recovered-empty.png`
  - Sonar: integrator
- **Acceptance:**
  - Runs `git fsck --unreachable --no-reflogs --no-progress --connectivity-only` (via U1's `discoverUnreachableCommitHashes` / `FSCK_UNREACHABLE_ARGS` with `-c core.commitGraph=false` and label `reflog.lostCommits.fsck`), then reads each commit's subject and date via one batched `git log --no-walk=unsorted --ignore-missing --stdin -z` call; never `--lost-found`, `gc`, or `prune`: **met** (`src/backend/queries/lostCommits.ts`, pinned in `tests/backend/queries/lostCommits.test.ts`).
  - Shows progress, can be canceled, and has a timeout (`DEFAULT_LOST_COMMITS_TIMEOUT_MS = 30_000`, killing process tree via `killProcessTree`); says plainly that these commits disappear when Git collects garbage: **met** (`lostCommits.ts`, `lostCommitsController.ts`, `lostCommitsView.ts`, `reflog-tab.css`, verified in tests and headless renders).
  - Offers "Create Branch Here…" for each result: **met** (reuses `createBranch` from `src/backend/actions/branch.ts` with `checkout: false` through `createReflogSource().createBranch`, prompted via `vscode.window.showInputBox` and validated against option injection; never moves `HEAD` and never duplicates F1-06's reflog-entry action code).
  - Tests with a dropped stash and an abandoned commit, cancel and timeout, and an empty result: **met** (`tests/backend/queries/lostCommits.test.ts`, `tests/webview/reflogTab/reflogData.test.ts`, `tests/webview/reflogTabPanel.test.ts`, `tests/webview/reflogTab/view.test.ts`).
- **Deviations from the slice:** None outside the Touch list. Note inside Touch: `src/backend/queries/loadCommits.ts` did not need editing because U1 (`0a94f150`) already moved and exported `discoverUnreachableCommitHashes`, `FSCK_UNREACHABLE_ARGS`, and `parseUnreachableCommitHashes` in `src/backend/queries/unreachableCommits.ts`, which `src/backend/queries/lostCommits.ts` imports directly.
- **Open questions / follow-ups:**
  - When integrating F1-06 and F1-07 together: F1-07's `Create Branch Here…` uses `createReflogSource().createBranch` (which calls `src/backend/actions/branch.ts` directly with `checkout: false`) and `vscode.window.showInputBox`, avoiding any DOM/dialog overlap with F1-06. If the integrator prefers sharing F1-06's branch-creation prompt/dialog helper after both slices land, `lostCommitsController.ts`'s `createBranchHere` is a single isolated seam.
  - Machine-authored `nl`, `pl`, `zh-cn`, and `zh-tw` translations for the 14 `reflog.lostCommits.*` keys could benefit from native-speaker review.
