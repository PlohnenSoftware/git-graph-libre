---
summary: >-
  F3-02: The Statistics tab in the webview, a plain TypeScript view with a
  contributors list and a 7 x 24 weekday-by-hour heatmap over the F3-01 reads,
  OKLCH colors, and English copies of its strings in every bundle until F3-04.
---

# F3-02 — Statistics tab, webview

Status: done — awaiting integration

Needs: F3-01 integrated; TQ1 and TQ2 confirmed

Model: Muse Code, headless (`muse exec --yolo`) in the slice worktree; it is
not a Haiku slice because it spans the message bus, the toolbar and the view.

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`); the research
(`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 2.1, 2.2 and 6; the Webview UI Styling Guide (Reference); the reflog
tab's panel and bundle (`src/extension/reflogTab/`, `src/webview/reflogTab/`)
as the pattern for an editor-tab view.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). Tests ship with
behavior, and touch only temporary directories or fakes. Strict Biome on
touched files, no `var`, American English, OKLCH colors through `--ngg-*`
tokens with VS Code theme tokens first. No new telemetry events or
declarations. Do not bump versions or edit CHANGELOG, README or notices; the
integrator does. Report Sonar: integrator.

## Touch

New `src/extension/statsTab/` (the panel and its reads, modeled on
`src/extension/reflogTab/`); new `src/webview/statsTab/` (the view and its
bundle entry); `src/types.ts` and `src/extension/messageHandler.ts` for the
message shape; `src/webview/` toolbar wiring where the view mode switch lives
(found by grep for the reflog tab's command); `l10n/bundle.l10n.json` and the
four `l10n/bundle.l10n.{nl,pl,zh-cn,zh-tw}.json` files, adding only the new
keys with English copies; new tests under `tests/webview/` and
`tests/backend/` for this slice; the slice file's Status and Report.

## Task and acceptance

- A command opens the Statistics tab (command id and toolbar placement follow
  the reflog tab). The panel is a singleton, reads through F3-01's
  `readAuthorStats` and `readActivityHeatmap`, and sends the payload to the
  webview as project-owned types only.
- Contributors: ranked by commit count; each row shows the name, a bar
  relative to the top author, the count and the percentage.
- Heatmap: 7 rows (Sunday to Saturday) by 24 hour columns; one cell per
  weekday and hour, with a hover title giving the weekday, the hour and the
  count, and a five-step legend. Cell color is an OKLCH ramp derived from a
  `--ngg-*` token; no literal hex.
- Every user-visible string uses a new `stats.*` key, added to all five
  bundles with English copies. F3-04 replaces the copies with translations.
  Say so in the Report.
- When the reads return `unavailable`, the view shows its unavailable state
  and does not fall back to the CLI (TQ2). F3-03 decides the entry point.
- Loading state while the first payload is pending; each open reloads (TQ7).
- Tests: a DOM test for 7 rows, 24 columns per row and 5 legend cells; the
  empty state; the unavailable state; the message shape; and the panel
  against a fake reader.
- Do not match Git Graph+ identifiers or magic constants (TQ3); derive sizes
  from GGL's own geometry.

## Checks

- Strict Biome on each touched file; `pnpm run typecheck`
- `pnpm exec vitest run --project backend <touched backend files>` and
  `pnpm exec vitest run --project webview <touched webview files>`
- `pnpm run l10n:check` (expected to pass with English copies)
- Record each command and its counts in the Report.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 12:14
- **Branch and commits:** `stats/F3-02`
  - `f9e93001 G docs(stats): claim statistics tab slice (F3-02)`
  - `be55602c G feat(stats): statistics tab panel, source and webview (F3-02)`
  - `4a6efb10 G feat(stats): wire the statistics command, toolbar and bundles (F3-02)`
  - `d5d84b46 G test(stats): cover the statistics tab and engine parity (F3-02)`
  - `4460f683 G fix(stats): name the repository once in the tab header (F3-02)`
  - this report and the status line: the final commit on the branch
- **Files changed:** 40 files, 2,193 insertions, 16 deletions vs `69da63be`
  (`git diff --stat`). New: `src/statsTabTypes.ts` (+86),
  `src/extension/statsTab/` (panel +201, source +27, html +32),
  `src/webview/statsTab/` (view +181, model +118, main +31),
  `media/stats-tab/stats-tab.css` (+150), tests (+1,074 across 9 new
  files). Edited: `media/tokens.css` (+5, `--ngg-stats-accent`),
  `src/types.ts` (+6), `src/extension/messageHandler.ts` (+25),
  `src/extension/commandManager.ts` (+68/−15 incl. the shared tab-repo
  picker), `src/extension/webviewL10n.ts` (+1),
  `src/extension/webviewToolbar.ts` (+1), `src/webview/main.ts` (+5),
  `src/octicons.ts` (+5, regenerated) and `scripts/generate-octicons.js`
  (+1, the `graph` icon), `esbuild.js` (+3/−1, the `statsTab.min`
  entry), `package.json` (+5, the command), the five l10n bundles
  (+33 keys each) and the five `package.nls*.json` (+1 key each), the
  slice file. `tests/webview/commandManager.test.ts` +34 (the new
  command in both registered lists, a harness mock, two command cases).
- **Tests added or changed:** 38 new tests (36 in 8 new files, 2 in
  `commandManager.test.ts`), 0 before for this surface. Model 7, view
  7, webview main 3, source 4, CSS guard 4, panel 7, assembly 2,
  backend parity 2, command 2.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings`
    over all 37 touched `.ts`/`.js`/`.json` files: clean (only the
    known `$schema` 2.5.13 vs CLI 2.6.8 info note, not a diagnostic).
  - `pnpm run typecheck`: clean.
  - `pnpm run l10n:check`: 100% for nl, pl, zh-cn, zh-tw ("All
    translations are complete").
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - `pnpm run compile`: builds `out/statsTab.min.js` beside the other
    bundles.
  - Focused: webview stats suites + panel + assembly +
    `commandManager.test.ts` 92 passed; backend
    `stats.test.ts` + `statsParity.test.ts` 28 passed.
  - Full `pnpm run test`: backend 121 files, 1,678 passed, 60 skipped
    (the usual linked-worktree skips); webview 92 files, 1,152 passed.
  - Headless renders (PyQt6 QtWebEngine + `xvfb-run`,
    `QT_QPA_PLATFORM=xcb`, real `media/*.css` and the compiled
    `statsTab.min.js`, theme tokens injected by the harness):
    `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F3-02/stats-tab-dark.png`
    and `stats-tab-light.png`, both read; the dark one re-read after
    the header fix. No forced-colors render (the harness cannot
    emulate it); the CSS carries a forced-colors block and a test
    pins it.
  - Clean-room census on the diff (`StatsView`, `getStats`, `byAuthor`,
    `byWeekdayHour`, `binCommitTime`, the blue literal): only
    `StatsViewState`/`createStatsView`, which mirror this repository's
    own `ReflogViewState`/`createReflogView`; nothing else matched.
  - Sonar: integrator
- **Acceptance:**
  - A command opens the tab, following the reflog tab: the
    `git-graph-libre.showStatistics` command (palette) and a graph
    toolbar button (`statisticsBtn`, `showStatistics` message). The
    panel is a singleton and reads only through F3-01's
    `readAuthorStats`/`readActivityHeatmap`; the payload crosses as
    project-owned types (`src/statsTabTypes.ts`). Met.
  - Contributors ranked by commit count with name, a bar relative to
    the top author, the count and the percentage. Met (view tests,
    renders).
  - Heatmap 7 rows (Sunday first) by 24 hours, each cell titled with
    weekday, hour and count, five-step legend, OKLCH ramp mixed in
    oklab from `--ngg-stats-accent` (theme chart color first), no
    literal hex. Met (DOM test counts 7/24/5; CSS guard).
  - Every user-visible string a new `stats.*` key (33 keys incl. two
    `command.showStatistics.*`), in one block immediately before the
    first `reflog.` key of each bundle. Met — and see Deviations:
    translated, not English copies.
  - `unavailable` shows its own state with the reason (four
    reason-specific texts) and never falls back to the CLI (TQ2); the
    entry point stays offered for F3-03 to gate. Met.
  - Loading state while the first payload is pending. Met. Reloading:
    see Deviations (the integrator's TQ6/TQ7 reading).
  - Tests: DOM 7/24/5, empty, unavailable, message shape
    (`RequestShowStatistics` in `src/types.ts`, exercised through the
    handler in the assembly suite), panel against a fake source. Met.
  - No Git Graph+ identifiers or constants (census above); the 16px
    cell follows this project's icon-size family. Met.
  - The broader parity check F3-01 asked for: `statsParity.test.ts`
    proves the engine against `git shortlog -sne --all --no-merges`
    and `git log --all --no-merges --format=%aI` over a temporary
    repository (two authors, fixed dates in +02:00/−05:00/UTC, a
    branch-only commit, a merge). Met; no `.mailmap` (F3-05, TQ5).
- **Deviations from the slice:**
  - **Translations done here, not English copies.** The slice and its
    summary say English copies until F3-04, but the maintainer's
    binding answers of 2026-11-23 (Release 1.11.0 section) say agents
    translate nl, pl, zh-cn and zh-tw themselves, and the dispatch's
    protocol required the same. All 33 keys and
    `command.showStatistics` are translated by this agent in all five
    bundles; a native review would help. F3-04 becomes a review pass.
  - **TQ6/TQ7 per the integrator's maintainer answers, not the slice
    text.** No cap, a loading state, and a result cache: a successful
    result is cached per repository in the panel, a reopen serves it
    without reading, and the `RepoFileWatcher` (repository change) or
    the webview's Refresh button drops it and reloads. The slice's
    "each open reloads (TQ7)" is superseded by "refresh on repository
    change, not on every tab open". Closing the tab drops the cache
    with the panel.
  - **Glue outside the Touch list, each unavoidable for "a command
    opens the tab" on the reflog pattern:** `package.json` and the
    five `package.nls*.json` (the command), `src/extension/commandManager.ts`
    (its registration; the reflog/statistics commands now share one
    `pickRepoForTab`), `src/extension/webviewToolbar.ts` and
    `src/extension/webviewL10n.ts` (the toolbar button and its label),
    `esbuild.js` (the bundle entry, named in the dispatch),
    `scripts/generate-octicons.js` + regenerated `src/octicons.ts`
    (the `graph` icon), `media/tokens.css` (the accent token, where
    the reflog colors also live), `src/statsTabTypes.ts` at `src/`
    root (where `reflogTabTypes.ts` lives), and the registered-command
    lists in `tests/webview/commandManager.test.ts`.
- **Open questions / follow-ups:**
  - **Telemetry hook point for T1 (not implemented; no T1 helper
    exists on this branch).** The palette command already passes the
    command chokepoint (`feature: git-graph-libre.showStatistics`,
    proven in `commandManager.test.ts`). The missing half is the
    toolbar route: `bridge.onMessage("showStatistics", …)` in
    `src/extension/messageHandler.ts` and the load outcome in
    `statsTabPanel.ts`'s `load()` (its `result.state`) are where a
    tab-open/outcome record belongs once T1 lands.
  - F3-03 (hiding the entry points without the engine) is untouched;
    until it lands, the button and command open a tab that shows the
    unavailable state on the `git-cli` backend.
  - F3-05 (mailmap) is untouched; until it lands, contributors can
    differ from `git shortlog` on repositories with a `.mailmap`,
    exactly as TQ5 records.
  - The tab has no date range (F3-06, if ever dispatched) and no
    click-through from an author or a cell; neither was in the slice.
