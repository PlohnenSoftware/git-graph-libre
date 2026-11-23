---
summary: >-
  The history and statistics work, started `2026-11-23` from the "timeline"
  research and not in release 1.11.0: slices F3-01 to F3-08 for a Statistics
  view (engine bridge, tab, engine-only availability, l10n, mailmap parity,
  date range) and the later File History and VS Code Timeline options.
  Decisions TQ1 to TQ7, answered by the maintainer on `2026-11-23`, the agent
  choice, the slice table and the integration log.
---

# History and statistics view (`2026-11-23`)

Status: started `2026-11-23`, not in release 1.11.0. Nothing here is integrated
yet.

Maintainer, `2026-11-23`: "we can go with reflog+blame this release but please
start work on interactive rebase and history; it may not end up shipped; start
with simple tasks Haiku can handle". The maintainer calls this work "history".
The research (Future work) calls it "timeline". Both names mean this register.
Multi-agent releases (Rules) applies.

Integration branch: `gg-plus/next`, local and unpushed, based on `main`. It is
rebased onto `main` after release 1.11.0. Slice branches: `stats/F3-NN`.
Worktrees: `/tmp/ggl-stats-f3-NN`. The design is "Git Graph+ features: research
and slice plan" (Future work), subsection "timeline" (`030-timeline.md`); where
a slice file here differs from that note, the slice file wins.

## Decisions

Each decision below was the research's recommendation. The maintainer answered
all seven on `2026-11-23`, as recorded under each one. F3-01 ships no UI and
ran first.

- **TQ1: what "timeline" means.** **Answer (`2026-11-23`): both, in order: the
  Statistics view first, then file history (F3-07, then F3-08).** Options as
  researched: candidate (a), the Statistics view (contributors and activity
  over time). It is the only time-ordered view in Git Graph+, and GGL already
  plans this tab and has the engine reads. Candidate (b), File History
  (F3-07), is also taken, after the Statistics view. A VS Code Timeline
  provider (F3-08) needs F3-07 first.
- **TQ2: engine only.** **Answer (`2026-11-23`): confirmed.** The Statistics
  tab reads the engine only, and is hidden when the engine is unavailable (the
  KB 170 exception). It does not work on the `git-cli` backend.
- **TQ3: clean-room boundary for Git Graph+ (Apache-2.0).** **Answer
  (`2026-11-23`): clean room, per the standing Git Graph+ licensing verdict**
  (decision G0 answered yes; the verdict is being written as a Licensing
  section). Options as researched: implement from Git's documentation and this
  project's patterns only. No slice reads Git Graph+ code while implementing
  it.
- **TQ4: scope of "all refs".** **Answer (`2026-11-23`): all refs, including
  the stash and the other worktrees' HEADs.** Keep `--all`, as the engine
  already does.
- **TQ5: mailmap.** **Answer (`2026-11-23`): apply `.mailmap`, to match
  `git shortlog -sne`** (F3-05). Options as researched: apply mailmap in
  `author_stats`. Until F3-05 lands, the table can differ from shortlog on
  repositories with a `.mailmap`.
- **TQ6: history size.** **Answer (`2026-11-23`): no hard cap, but a loading
  state and a result cache per ref set.** Options as researched: keep the
  engine walk, and measure on a large repository before adding a cap, caching
  or a loading state.
- **TQ7: refresh.** **Answer (`2026-11-23`): refresh on repository change, not
  on every tab open.** Options as researched: reload on each tab open, as Git
  Graph+ does, and refresh when the repository changes.

## Slices

| ID | Work | Needs | Model | Status |
| --- | --- | --- | --- | --- |
| F3-01 | Engine bridge: typed wrappers for `authorStats` and `activityHeatmap` | — | Claude Haiku | integrated `4ebc50c5` |
| F3-02 | Statistics tab, webview (contributors and 7 x 24 heatmap) | F3-01 (TQ1, TQ2 answered) | Muse Code, Haiku fallback | integrated `8991c7eb` |
| F3-03 | Engine-only availability (tab hidden without the engine) | F3-01, F3-02 | Haiku | ready |
| F3-04 | l10n for the Statistics tab in all five bundles | F3-02 | Claude Haiku | ready |
| F3-05 | Mailmap parity in `author_stats` (decision TQ5) | F3-01 (TQ5 answered) | Muse Code | integrated `d094045d` |
| F3-06 | Date-range filter (only if TQ1 picks the scrubber reading) | F3-02, TQ1 | Muse Code | not selected |
| F3-07 | File History: engine path-scoped log (TQ1 answered: taken) | F3-02 (TQ1 answered) | Muse Code | ready |
| F3-08 | VS Code Timeline provider over F3-07 (only if TQ1 picks Timeline) | F3-07 (TQ1 answered: taken) | Muse Code | waiting on F3-07 |

F3-05 to F3-08 depend on decisions and are decision-dependent as the research
marks them. TQ1 selected File History (F3-07) and the Timeline provider
(F3-08), so both are scheduled after the Statistics view; F3-06 (the scrubber
reading) was not selected and stays unscheduled.

Slice files: `130-history-and-statistics/`, one per slice (`100-f3-01-...`
to `170-f3-08-...`).

## Agent choice

Maintainer, `2026-11-23`: Claude Haiku for simple slices, and headless Muse
Code (`muse exec --yolo "<prompt>"`, run inside the slice worktree) for complex
ones. Escalate one step on failure (Haiku to Muse Code). Each dispatch records
its agent and model in the slice's report and in the integration log.

## Integration acceptance

Each slice is reviewed, rebased onto `gg-plus/next`, fast-forwarded and gated:
strict Biome on touched files, typecheck, the full test suite, `l10n:check`
when user-visible text changed, `kb:check` when the knowledge base changed, and
the Rust arm plus an addon rebuild when `engine/**` changed. At the end, for
the release that ships this work: `pnpm run package`, coverage, SonarQube with
an explicit gate poll (`OK` required), `kb:index`, `kb:check` and `kb:graph`;
the README feature list and CHANGELOG entries; a headless render of the tab in
both themes. Nothing is pushed.

## Integration log

- `2026-11-23`: register and slice files written from the research.
- `2026-11-23`: F3-01 (Claude Haiku) integrated into `gg-plus/next` at
  `4ebc50c5` by fast-forward: optional `authorStats` / `activityHeatmap` members
  on `EngineAddon` (names confirmed on the built addon), project types in
  `src/backend/types/stats.types.ts`, and `src/backend/engine/stats.ts`
  reads that validate the payload and answer a typed unavailable reason
  (`backendCli`, `notVerified`, `noAddon`, `failed`) instead of throwing;
  26 tests. Gates in its worktree: strict Biome clean, typecheck clean,
  backend suite 1,569 passed (60 skipped, as in every linked worktree), KB
  check clean. Follow-up from the report: a broader author/heatmap parity
  check belongs with F3-02.
- `2026-11-23`: maintainer answered TQ1–TQ7 (as above); `gg-plus/next` rebased
  onto `main`; F3-02 and F3-05 dispatched to Muse Code.
- `2026-11-23`: F3-02 (Muse Code) integrated into `gg-plus/next` at `8991c7eb`: the
  Statistics tab (`src/extension/statsTab/`, `src/webview/statsTab/`,
  `src/statsTabTypes.ts`, bundle `statsTab.min`), the `showStatistics`
  command and graph toolbar button, contributors with bars and shares, the
  7 × 24 heatmap with a legend, four unavailable states, and an engine
  parity test against Git. Strings translated in all five languages
  (maintainer: agents translate), so F3-04 shrinks to a review. Renders:
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F3-02/stats-tab-dark.png` and
  `stats-tab-light.png`. Telemetry hook point recorded in its report for
  T1. Gates on `8991c7eb`: strict Biome on 35 files, typecheck, `l10n:check`, KB
  check, backend 1,678 passed (60 skipped) and webview 1,152 passed.
  F3-03, F3-04 and F3-07 (file history) are ready.
- `2026-11-23`: F3-05 (Muse Code) integrated into `gg-plus/next` at `d094045d`:
  `author_stats` applies the mailmap from every source Git reads (the
  working tree's `.mailmap`, `mailmap.blob`, `mailmap.file`), matching
  `git shortlog -sne --all --no-merges` exactly (17 new engine tests; 0
  mismatches on this repository, 20 authors, about 37 ms). Engine bumped to
  **1.0.33** on `gg-plus/next` only (`main` and release 1.11.0 stay on
  1.0.32). Follow-up for the maintainer: whether the graph's own mailmap
  decline in `load_commits` and the `authors` filter should share this code.
  Gates: Rust arm (fmt, clippy, check, test) clean; addon rebuilt
  (`engineVersion` 1.0.33); strict Biome, typecheck, KB check; backend 1,679
  passed (60 skipped) and webview 1,152 passed.
