---
summary: >-
  Research (`2026-11-08`) into a "timeline" in Git Graph+ at `c6c2a9a`:
  nothing there is called that. The candidates are its Statistics view
  (contributors and a weekday-by-hour activity heatmap) and a File History
  search removed from its UI. Slices F3-01 to F3-08, conditional on decision
  TQ1 (what "timeline" means), and decisions TQ1 to TQ7.
---

# Research: "timeline" in Git Graph+ (c6c2a9a) and integration path for Git Graph Libre

Scope: read-only research. No code, docs, builds or git state changed in either repository.
Git Graph+ commit: `c6c2a9a` (`main`, 2026-07-01), Apache-2.0.
Git Graph Libre (GGL): `/home/zam/Desktop/prog/_GGL/git-graph-libre`, AGPL-3.0-or-later.

## 1. What "timeline" can mean

`git grep -i timeline c6c2a9a` returns nothing in code, docs, i18n, `package.json` or CHANGELOG. There is no
feature literally named Timeline, no VS Code Timeline contribution and no date scrubber. Three candidates:

| Candidate | Exists at `c6c2a9a`? | Evidence |
| --- | --- | --- |
| (a) **Statistics** (contributors + commits by weekday/hour heatmap) | Yes, in full | `webview-ui/src/components/common/StatsView.svelte`, `src/git/git-service.ts:2138-2165`, `src/panels/MainPanel.ts:1240-1251`, `webview-ui/src/App.svelte:250, 509-511`, `webview-ui/src/components/layout/Toolbar.svelte:222-228` |
| (b) **File History** | No UI. A backend remains: `searchByFile` | CHANGELOG `0.1.6` line 674 added "Search by file ... context menu 'File History'". The same release's Refactoring section (line 793) removed "file history" as unused. The backend survives: `src/git/git-service.ts:1975-1988`, `src/panels/MainPanel.ts:1191-1197`, `src/utils/message-bus.ts:84`. No webview code sends `searchByFile`. The only other hit is the i18n key `lfs.fileHistory` (`en.ts:657`), which no component uses. |
| (c) **VS Code Timeline** view, date scrubber, relative-time axis | No | `package.json` has no `timeline` or `registerTimelineProvider`; the only `views` contribution is the SCM group (`package.json:180`, Branches, Remotes, Tags, Stashes, Worktrees). |

### Current state in GGL

- **Statistics:** no UI. The engine has both reads (`engine/native/core/src/stats.rs:20` `author_stats`, `:69`
  `activity_heatmap`; napi wrappers `engine/native/core/src/api.rs:259-266`; types `engine/native/core/src/types.rs` around 345-360).
  The TypeScript addon typings in `src/backend/engine/addon.ts` do not declare them, and `src/` has no reference.
  The KB records this as **"planned: a Statistics tab" (2026-09-23)**, in
  `docs/kb/050-ongoing-work/030-implementation-roadmap/010-phase-16-rust-engine-backend/170-the-engine-surface-what-is-wired-what-was-removed-what-is.md`
  lines 51, 65-77. It also says the tab would be engine-only (a deliberate exception to design rule 2) and would not be
  offered when the engine is unavailable. `docs/kb/070-history/210-release-1-10-0-the-worktrees/500-w40-engine-reads-on-linked-worktrees-proven.md:70` says the stats are not wired in TypeScript yet.
- **File History:** none. GGL has no `searchByFile`, no `--follow` and no path-scoped log in `src/` or `engine/native/core/src`.
- **Timeline:** none. No `timeline` in `src/` or `package.json`.

### Recommendation for "timeline"

**Most likely (a), the Statistics view, read as its time dimension (activity over time).** Reasons:

1. It is the only time-ordered view in Git Graph+. The heatmap and author table are the features that answer "when and by whom".
2. GGL already has the engine reads and a KB decision to build this exact tab.
3. The Git Graph+ commits that touch timing (`0e8e310` "bin commit stats by author's local time", `9b6ea23` memoized heatmap lookups) match a Statistics feature.

Caveats: the word "timeline" appears nowhere. If the maintainer meant the VS Code Timeline view, or a per-file history, the plan
changes (slices F3-06 and F3-07 below). Decision TQ1 asks.

## 2. Candidate (a): Statistics

### 2.1 User-facing behavior (Git Graph+)

- Entry: a `Stats` tab in the toolbar's view switcher (Toolbar.svelte 222-228) next to History and Reflog, and Ctrl+3
  (`App.svelte:250`). The tab content lives in `.stats-container` (`App.svelte:509-511`).
- Shows: (1) **Contributors**, ranked by commit count, each row with avatar (gravatar via `avatarStore`), a bar relative to the top author, count and percentage. (2) **Commits by Day & Hour**: a 7 x 24 grid, one cell per weekday and hour, with a hover tooltip ("Mon 09:00 - 4 commits") and a five-step legend (Less/More).
- Scope: all refs (`--all`), merges excluded. No date range, no maxCommits limit, no settings, no click-through from a cell or author to the graph.
- Loading: shows a spinner until the first `statsData` message arrives. The view posts `getStats` on mount (`StatsView.svelte:28`). Each visit reloads the data.

### 2.2 Implementation (Git Graph+)

- **Git commands**
  - Contributors: `git shortlog -sne --all --no-merges` (`git-service.ts:2141`). Output is parsed with `/^\s*(\d+)\s+(.+?)\s+<(.+?)>$/`. Counts by name and email, respecting mailmap (shortlog's default).
  - Heatmap: `git log --all --format=%aI --no-merges` (`git-service.ts:2151`). Each ISO date is parsed by `binCommitTime` (`git-service.ts:40-56`), which takes the wall-clock digits from the ISO string and derives the weekday with `Date.UTC`. So bins are in the author's local time, not the viewer's.
  - No pagination. The whole history is read and parsed line by line in JS.
- **Message flow**: webview posts `{type:'getStats'}` (`message-bus.ts:92`) → `MainPanel.ts:1240` runs both git calls in `Promise.all` → posts `{type:'statsData', payload:{byAuthor, byWeekdayHour}}` (`message-bus.ts:152`) → `StatsView.svelte:21-26` stores the payload.
- **Rendering**: plain Svelte markup, CSS grid-like flex rows. The heatmap is a DOM grid of 168 `div`s. Cell color is `rgba(99,176,244, 0.15 + intensity*0.85)` over a grey empty cell, with `$derived` maps from `(weekday*24+hour)` to count (`StatsView.svelte:38-47`). No charting library. Author bar fill is a literal `#63b0f4`.
- **Dependencies**: webview `marked`, `shiki`, Svelte, Vite, Testing Library, `happy-dom`, Vitest (`webview-ui/package.json`); root `@vscode/codicons` (`package.json` `dependencies`). I did not check the licenses of these packages (npm metadata or `node_modules` not inspected).
- **Tests**
  - `src/git/__tests__/integration/search-stats.integration.test.ts:82-125` (author counts, weekday-hour bucket).
  - `src/git/__tests__/git-service.test.ts:922-942` (`binCommitTime` for timezones and invalid input).
  - `webview-ui/src/components/common/__tests__/StatsView.test.ts` (7 rows, 24 cells, 5 legend cells).
  - `webview-ui/src/__tests__/App.test.ts:445` (view-mode switch).
- **Performance limits**: none set. Cost is O(all commits) per request, and a full JS parse for each `getStats`. The engine path would be much cheaper (`stats.rs` walks with a `rev_walk` and does no per-line parsing).
- **i18n**: `en.ts:334-338` (`stats.contributors`, `stats.commitsByDayHour`, `stats.loading`, `stats.less`, `stats.more`), `en.ts:5` (`toolbar.stats`).

### 2.3 What Git Graph Libre has today

- **Engine (ready):** `author_stats` and `activity_heatmap` (`stats.rs`), which mirror `git shortlog -sne --all --no-merges` and `git log --all --format=%aI --no-merges`. Both count every worktree HEAD (`log::every_tip`, KB `500-w40`). The module header says it is ported from the CLI backend. The KB (`500-w40`, `170`) says the functions were inherited from `vscode-git-graph-rs`. Per KB `030-licensing/010-licensing/010-vscode-git-graph-rs-licensing-verdict.md`, `native/` is MIT, so `stats.rs` is usable. That record was not read in this pass.
- **Known gap, recorded in KB 230 line 50:** mailmap is not applied in `author_stats`. Git Graph+'s shortlog applies it by default. Decision TQ5.
- **GGL webview:** plain TypeScript in `src/webview/` (not Svelte). No `viewMode`, no stats tab, no stats message. I did not map the full toolbar in this pass.
- **Localisation:** `l10n/bundle.l10n.json` plus `bundle.l10n.{nl,pl,zh-cn,zh-tw}.json`, `src/l10n.ts`, `src/extension/webviewL10n.ts`, `scripts/check-l10n.js`.

## 3. Candidate (b): File History

### 3.1 User-facing behavior

- At `c6c2a9a` the context-menu entry is gone. The backend (`searchByFile`) is still reachable only by posting `searchByFile`, which nothing does.
- Intended behavior when it shipped (CHANGELOG line 674): "Find all commits affecting a specific file via context menu 'File History'". The result feeds `searchResults`, i.e. the normal search list.

### 3.2 Implementation

- `git-service.ts:1975-1988`: `git log --format=<NUL-separated fields> --all --max-count=100 -- <file>`. Default limit 100. It runs `assertSafePath` first and `parseLog` on the result, and also fetches remote names.
- No `--follow`, so renames end the history. The history covers every ref, not just the current branch.
- Concurrency: `MainPanel.ts:1191-1197` uses `searchSequence` to drop stale results.
- Tests: `search-stats.integration.test.ts:44-60`.

### 3.3 GGL

Nothing exists. GGL's graph and details code (not mapped) does not include a file-scoped log.

## 4. Candidate (c): VS Code Timeline and date scrubber

- Git Graph+ registers no Timeline provider and has no date scrubber or relative-time axis. The graph shows dates in the commit rows, but there is no time-axis control.
- To integrate a Timeline provider, GGL would use VS Code's Timeline provider API (the exact namespace and signature need checking against `@types/vscode` in the repo; I did not verify it). Such a provider depends on per-file history (candidate b).

## 5. Licensing and clean-room notes

- Git Graph+ is **Apache-2.0** (`package.json` line 11). The user allows reading it for research. Nothing was copied.
- **GGL clean-room rules bind any implementation** (KB `020-rules/010-mission` and `030-licensing/010-licensing/020-license-review-of-the-graph-and-stash-ui-slices.md`):
  - Reimplement from Git CLI docs, VS Code APIs and GGL's own patterns, not from Git Graph+ code.
  - Visual targets are fine, but do not match identifiers or magic constants. Derive constants from GGL's own geometry, and run an identifier census on the diff.
  - The 2026-09-09 review found exactly this kind of problem, so the same check should run on this slice.
- The KB has **no record of Git Graph+** (grep for `git-graph-plus` and "Git Graph+" in `docs/kb`, `README.md` and `NOTICE.md` returned nothing). So the Apache-2.0 status of Git Graph+ has no maintainer verdict yet. Decision TQ3.
- `stats.rs` is GGL's own code (MIT lineage via `native/`). Its header says it was ported from the CLI backend and inherited from `vscode-git-graph-rs`. Keep that provenance in the file.
- The Git Graph+ `src/git/git-graph-builder.ts` says "ported from SourceGit ... MIT". That file is out of scope here, but it would need a separate note if its graph code were used.
- Recommended output style: GGL KB records OKLCH colors and American English (branch policy). The Git Graph+ hard-coded blue and `rgba(…)` would be replaced with OKLCH tokens.

## 6. Slice plan (temporary IDs)

Assumes candidate (a) (Statistics). Sizes are rough: S = under 1 day, M = 1-3 days.

- **F3-01 Engine bridge.** Declare `author_stats` and `activity_heatmap` in `src/backend/engine/addon.ts`, add typed wrappers and a `getStats`-style message, and gate on engine availability. Tests: addon-typing test, engine-unavailable test. Deps: none. Size S.
- **F3-02 Statistics tab, webview.** Add `stats` to the view modes, a toolbar tab, the Ctrl+3 shortcut (if not already taken), a Contributors list and a 7 x 24 heatmap in plain TS. OKLCH colors. Goal: same information as Git Graph+, own visual design. Tests: DOM test for 7 x 24 cells and an empty state. Deps: F3-01. Size M.
- **F3-03 Offered-only-with-engine.** Hide the tab with a context key when the engine is unavailable (mirrors the diff tab's `diffTabAvailable` key, per KB 170). Tests: key false → no tab. Deps: F3-01. Size S.
- **F3-04 l10n.** Add keys to `l10n/bundle.l10n.json` and the four locale bundles; run `scripts/check-l10n.js`. Deps: F3-02. Size S.
- **F3-05 Mailmap parity (decision-dependent).** Apply mailmap in `author_stats` if TQ5 says so, with an engine test against `git shortlog`. Deps: F3-01. Size S-M.
- **F3-06 Date-range filter (only if TQ1 says "timeline" = scrubber).** Add `since`/`until` to the engine reads, and a range control to the tab. Deps: F3-02. Size M.
- **F3-07 File history (only if TQ1 says file history).** Engine path-scoped log (`--all`, optional `--follow`, limit), context-menu entry, results in the existing search list. Deps: none. Size M.
- **F3-08 VS Code Timeline provider (only if TQ1 says Timeline).** Register a provider over F3-07 data. Deps: F3-07. Size M.

## 7. Decisions for the maintainer

- **TQ1: Which feature does "timeline" mean?** Recommendation: the Statistics view (activity over time), because it is the only time-based view in Git Graph+ and GGL already has the planned tab and engine reads. Alternatives: a date-range scrubber over the same data (F3-06), per-file history (F3-07) or a VS Code Timeline provider (F3-08, which needs F3-07).
- **TQ2: No CLI fallback for stats.** KB 170 already records this exception (engine-only, tab hidden when unavailable). Confirm, since it means the tab does not work on the `git-cli` backend.
- **TQ3: Clean-room boundary for Git Graph+.** Git Graph+ is Apache-2.0 and is not in the KB at all. Confirm that GGL implements from docs and its own patterns only, and record a verdict in the KB before any slice starts.
- **TQ4: Scope of "all refs".** Git Graph+ counts `--all`, including the stash and worktree HEADs (GGL's engine already does this). Keep it, or narrow to branches?
- **TQ5: Mailmap.** Git Graph+ inherits mailmap from shortlog. GGL's `author_stats` does not apply it (KB 230 line 50). Apply it, to match Git's output?
- **TQ6: History size.** Git Graph+ has no cap and parses all commits in JS on every request. The engine walk is cheaper, but on very large repos (for example Linux) a cap, caching, or a loading state may still be needed. Choose a policy.
- **TQ7: Refresh.** Git Graph+ reloads stats on each visit. Should GGL refresh only on repo change, or on every tab open?

## 8. Files read (summary)

- Git Graph+ at `c6c2a9a`: `package.json`, `CHANGELOG.md` (lines 674, 793), `webview-ui/src/App.svelte`, `webview-ui/src/components/common/StatsView.svelte`, `webview-ui/src/components/layout/Toolbar.svelte`, `webview-ui/src/lib/i18n/en.ts`, `webview-ui/src/lib/stores/ui.svelte.ts`, `src/git/git-service.ts` (lines 40-56, 1975-1988, 2138-2165), `src/panels/MainPanel.ts` (lines 1191-1197, 1240-1251), `src/utils/message-bus.ts`, the test files named in 2.2, `webview-ui/package.json`. Git log for timing and file-history commits.
- GGL: `engine/native/core/src/stats.rs`, `engine/native/core/src/api.rs` (259-266), `engine/native/core/src/types.rs`, `src/backend/engine/addon.ts`, `docs/kb/README.md`, `docs/kb/010-mission/010-mission.md`, `docs/kb/030-licensing/010-licensing.md` and the clean-room review, the Phase 16 KB record `170-...`, `500-w40-...`, `230-upstream-engine-review-first-pass.md`.
- Not read: anything under `vscode-git-graph-rs/src`, `web`, or `illegal_forks`.
