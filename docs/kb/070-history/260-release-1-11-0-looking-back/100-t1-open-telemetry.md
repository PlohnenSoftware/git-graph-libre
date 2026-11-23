---
summary: >-
  T1: telemetry approved by the maintainer (`2026-11-23`): whether each tab
  (Reflog, GGL Diff, and later Blame and Statistics) was opened from its
  button or command and whether that went without errors, and the same for
  every worktree button; nothing about content or option use. Inside the
  existing `feature` event and the three chokepoints; `telemetry.json` and
  the README disclosure updated.
---

# T1 — Open-and-outcome telemetry for tabs and worktree buttons

Status: done — awaiting integration

Needs: —

Agent: Muse Code

Read first: `AGENTS.md`; the KB index and every *always read* section;
Multi-agent releases (Rules); the release section
(`070-history/260-release-1-11-0-looking-back.md`), its Telemetry
answer above all; Telemetry (Reference) and its three subsections, whole.

## The maintainer's words (`2026-11-23`)

"Please measure if a given feature, i.e. a tab, was opened, i.e. if the
person clicked the buttons to open it, and if that went without errors; same
for the buttons for worktrees; don't measure [what they did with it]."

## Touch

`src/telemetry/**`; `src/extension/commandManager.ts` and
`src/extension/messageHandler.ts` (their existing chokepoints only);
`src/extension/reflogTab/reflogTabPanel.ts` and the GGL Diff tab's panel
(`src/extension/diffTab*`), only to report whether opening succeeded;
`telemetry.json`; `README.md`'s Telemetry section only; tests under
`tests/**/telemetry*` and the touched panels' tests; this slice file's
Status and Report. If a worktree button's outcome is not already reported
by `registerAction()`, the worktree action handlers it routes to.

## Task and acceptance

- **Audit first** and record the result in the Report: which tab-opening
  commands and buttons, and which worktree buttons (Open in New Window, Open
  Here, Switch Graph, Copy Path, Create, Lock, Unlock, Move, Remove, Repair,
  Remove Stale Entry, Prune), already reach the ingest today through
  `register()` (palette commands) or `registerAction()` (webview actions,
  outcome included), with which feature id and whether the outcome
  (succeeded or failed) is included.
- **Fill only the gaps**, inside the existing event types: the ingest
  accepts only `activate` and `feature`. Feature ids follow the existing
  naming and the ingest pattern `^[a-z][a-zA-Z0-9._-]{0,63}$`, asserted in
  tests. A tab counts as opened when its panel was created or revealed and
  its first content load did not fail; a failed open (no repository, load
  error) reports a failure outcome. A worktree button reports one event with
  its outcome.
- **Never send** paths, branch names, hashes, file names, search text,
  options, counts of rows, or which entries were looked at; no per-use
  timing. Opening from the toolbar button and from the palette may share one
  feature id; do not add an entry-point property unless an existing
  chokepoint already carries one.
- Respect every existing rule: the `createTelemetryLogger` boundary, the
  tri-state `telemetry.enabled`, consent, no direct `fetch`.
- `telemetry.json` declares every new feature id/property; the README's
  Telemetry section (the user-facing disclosure) lists them in plain words,
  in step with `telemetry.json`.
- Leave a small, documented helper or pattern the Blame tab (F4-03 onward)
  and the Statistics tab (F3-02) will call when they open, and say in the
  Report how to use it.
- Check the sibling ingest repository read-only
  (`/home/zam/Desktop/prog/_GGL/git-graph-libre-telemetry`, if present) for
  any feature-id allowlist beyond the pattern; report, do not change it.
- Tests: each new signal fires once with the right id and outcome, never
  carries forbidden data, and nothing fires with telemetry disabled.

Focused checks: strict Biome on touched files, `pnpm run typecheck`, the
touched test files, `pnpm run l10n:check` if any string changed,
`node ./docs/kb/housekeeping.mjs --check`. Sonar: integrator.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 12:17
- **Branch and commits:** `rel-1.11.0/T1`
  - `7405a853 G docs(kb): claim slice T1 (T1)`
  - `9096b3b0 G feat(telemetry): add the tab-open reporter helper (T1)`
  - `032ff996 G feat(telemetry): report Reflog and GGL Diff tab opens from their panels (T1)`
  - `2c694fc7 G feat(telemetry): wire tab-open routes and the worktree Copy Path button (T1)`
  - `3d29e21b G docs(telemetry): declare the tab-open and Copy Path signals (T1)`
  - plus this report's commit.
- **Audit (before this slice).** Tabs: the palette commands
  `git-graph-libre.showReflog` and the three
  `git-graph-libre.openDiffTab.*` SCM commands already reached the ingest
  through `register()` (feature id = command id, `ok` = handler did not
  throw), but a no-repository refusal returned normally and so logged
  `ok: true`, and a panel's first-load failure was invisible to both
  chokepoints. The graph toolbar's Reflog button (`showReflog` bridge
  message) and Commit Details' "Open in GGL Diff" (`openDiffTab` bridge
  message, including its silent fallback to `vscode.diff`) sat outside
  `registerAction()` and sent nothing. The graph tab itself was already
  covered (`git-graph-libre.view`, plus `view.failure.*`) and stayed out
  of scope. Worktree buttons: Create (`addWorktree`), Lock, Unlock, Move,
  Remove (`removeWorktree`), Repair, Remove Stale Entry (routes to
  `removeWorktree`) and Prune (`pruneWorktrees`, plus the palette's
  `pruneStaleWorktrees`) already reported once with outcome through
  `registerAction()`. Open in New Window / Open Here, Switch Graph, Add to
  Workspace and Reveal report **twice** per click (the `registerAction()`
  event and the delegated command's `register()` event) — pre-existing,
  left as found, see Open questions. Copy Path sent nothing: it rides the
  shared `copyToClipboard` bridge route outside `registerAction()`.
- **What was added.** `src/telemetry/tabOpen.ts` (`createTabOpenReporter`,
  `tab.reflog`, `tab.diff`): one `feature` event per open attempt, fixed id
  plus `ok`, nothing else. Each panel reports when its open's first load
  settles (Reflog: first page, `page.error` decides; refresh/paging/query
  stay silent. Diff: settled payload, `error` kind decides; binary and
  too-large count as opened; a superseded load stays silent). Routes
  report `ok: false` only when no panel is reached: palette Reflog with no
  repository, a refused toolbar Reflog open, an SCM file in no known
  repository, and a commit-details Diff open that falls back or throws.
  Dismissing the repository picker reports no tab event (no repository was
  chosen). Copy Path now reports `copyWorktreePath` with the clipboard
  write's outcome; the copied path is never sent. No entry-point property:
  button, menu and command share each tab's id.
- **For Blame (F4-03 onward) and Statistics (F3-02):** add the tab's fixed
  id (`tab.<name>`) in `src/telemetry/tabOpen.ts`, declare it in
  `telemetry.json` and the README in the same change, accept
  `telemetry?: Pick<TelemetryReporter, "logFeature">` in the panel deps,
  build `createTabOpenReporter(deps.telemetry, TAB_FEATURE_<NAME>)` once,
  call it once when the open's first load settles, report `false` from any
  route that never reaches the panel, and pass the reporter at every
  assembly site. The module header carries the full contract.
- **Ingest check (read-only):** `/home/zam/Desktop/prog/_GGL/git-graph-libre-telemetry`
  validates the feature id by the pattern alone (`validate.go`, the same
  `^[a-z][a-zA-Z0-9._-]{0,63}$`); no allowlist beyond it, and only the
  `activate`/`feature` event kinds. Nothing there was changed.
- **Files changed:** 18 files, +486/−21 through `3d29e21b` (plus this
  file's Status/Report): `src/telemetry/tabOpen.ts` (new, +67);
  `src/extension/reflogTab/reflogTabPanel.ts` +15,
  `src/extension/diffTab/diffTabPanel.ts` +9,
  `src/extension/diffTab/scmCommands.ts` +6,
  `src/extension/commandManager.ts` +11/−2,
  `src/extension/messageHandler.ts` +32/−6, `src/extension.ts` 1 line;
  `telemetry.json`, `README.md` (+9); tests:
  `tests/backend/telemetry/tabOpen.test.ts` (new, +66),
  `tests/webview/{reflogTabPanel,diffTabPanel,messageHandler,commandManager,telemetryReporter}.test.ts`,
  `tests/webview/diffTab/scmCommands.test.ts`,
  `tests/webview/__mocks__/vscode.ts` (+7, clipboard).
- **Tests added or changed:** 18 new cases (backend `tabOpen` 4 incl. the
  ingest-pattern and `telemetry.json`-declaration guards; webview:
  consent-gate tab-open 3, diff panel 5, reflog panel 4, Copy Path 2) and
  7 extended (no-repo/dismissed palette Reflog, refused toolbar Reflog,
  diff fallback, two SCM cases). Full suite after: backend 116 files /
  1558 passed / 60 skipped (the expected linked-worktree skips), webview
  85 files / 1130 passed.
- **Gates:** strict Biome (`biome.strict.jsonc --error-on-warnings`) on
  every touched `.ts`/`.json` — clean (the config-schema version notice is
  pre-existing); `pnpm run typecheck` — pass; focused vitest per commit
  (helper 3+10, panels 38, routes 124, telemetry dirs 98+75) — pass;
  `pnpm run test` once at the end — exit 0; `pnpm run l10n:check` — 100%
  all locales (no bundle strings changed; nothing user-visible was added,
  so no translations were needed); `node ./docs/kb/housekeeping.mjs
  --check` — pass; all commits `G` in
  `git log --format='%h %G? %s' 7db1d290..HEAD`. No visual change, so no
  renders. Sonar: integrator.
- **Acceptance:** audit recorded (above) — met. Gaps filled inside the
  existing `feature` event with pattern-valid, test-asserted ids — met.
  Opened = panel created/revealed + first load clean; no-repository and
  load error report failure — met (argued per route above). One event per
  worktree button with outcome — met for every button this slice touched;
  four buttons still double-report from before (below). Nothing forbidden
  sent, no timing, no entry-point property — met, pinned by tests that
  keep repository, path, ref, title and search text out of the events.
  Logger boundary, tri-state consent, no direct fetch — met (all sending
  still goes through `logFeature`). `telemetry.json` + README disclose the
  new ids in step — met, test-pinned. Helper left for Blame/Statistics —
  met. Ingest checked read-only — met. Tests: each signal fires once with
  id and outcome, carries no forbidden data, and nothing fires with
  telemetry disabled (unset and disabled cases) — met.
- **Deviations from the slice:** `src/extension.ts` gained one `telemetry`
  property in its Source Control diff assembly (outside the Touch list,
  unavoidable: it is the only other `openDiffTab` assembly, and without it
  SCM opens would reach the panel unmeasured). `src/extension/diffTab/scmCommands.ts`
  was read as inside the `src/extension/diffTab*` Touch glob.
  `tests/webview/__mocks__/vscode.ts` gained the clipboard VS Code always
  provides, so the Copy Path route could be tested.
- **Open questions / follow-ups:** the four delegating worktree actions
  (Open, Add to Workspace, Reveal, Switch Graph) emit two events per
  click — `openWorktree` via `registerAction()` and
  `git-graph-libre.openWorktree` via `register()`. This slice left both
  series untouched rather than bend a chokepoint unasked; deduping (and
  choosing which id survives) is a maintainer/integrator call. A panel
  closed before its first load settles reports no open — deliberate, noted
  in both panels. Native-speaker translation review: not applicable, no
  localized strings were added.
