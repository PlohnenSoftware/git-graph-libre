---
summary: >-
  The history and statistics work, started `2026-11-23` from the "timeline"
  research and not in release 1.11.0: slices F3-01 to F3-08 for a Statistics
  view (engine bridge, tab, engine-only availability, l10n, mailmap parity,
  date range) and the later File History and VS Code Timeline options.
  Decisions TQ1 to TQ7 with provisional defaults, the agent choice, the slice
  table and the integration log.
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

Each decision below is the research's recommendation, marked as a provisional
default. The maintainer confirms each one before any slice that ships UI
(F3-02 onward) is dispatched. F3-01 ships no UI and may run first.

- **TQ1: what "timeline" means.** Provisional default: candidate (a), the
  Statistics view (contributors and activity over time). It is the only
  time-ordered view in Git Graph+, and GGL already plans this tab and has the
  engine reads. Candidate (b), File History (F3-07), stays in the table as a
  later option the maintainer may pick instead. A VS Code Timeline provider
  (F3-08) needs F3-07 first.
- **TQ2: engine only.** Provisional default: the Statistics tab reads the
  engine only, and is not offered when the engine is unavailable (the KB 170
  exception). It does not work on the `git-cli` backend. Confirm before F3-02.
- **TQ3: clean-room boundary for Git Graph+ (Apache-2.0).** Provisional
  default: implement from Git's documentation and this project's patterns
  only. No slice reads Git Graph+ code while implementing it. The KB has no
  verdict on Git Graph+ yet; the maintainer records one before any slice that
  takes ideas beyond the research starts.
- **TQ4: scope of "all refs".** Provisional default: keep `--all`, as the
  engine already does, including the stash and the other worktrees' HEADs.
- **TQ5: mailmap.** Provisional default: apply mailmap in `author_stats`, to
  match `git shortlog` (F3-05). Until then the table can differ from shortlog
  on repositories with a `.mailmap`.
- **TQ6: history size.** Provisional default: no cap for the first release of
  the tab. Keep the engine walk, and measure on a large repository before
  adding a cap, caching or a loading state.
- **TQ7: refresh.** Provisional default: reload on each tab open, as Git Graph+
  does, and refresh when the repository changes.

## Slices

| ID | Work | Needs | Model | Status |
| --- | --- | --- | --- | --- |
| F3-01 | Engine bridge: typed wrappers for `authorStats` and `activityHeatmap` | — | Claude Haiku | integrated `4ebc50c5` |
| F3-02 | Statistics tab, webview (contributors and 7 x 24 heatmap) | F3-01, TQ1, TQ2 confirmed | Muse Code, Haiku fallback | waiting |
| F3-03 | Engine-only availability (tab hidden without the engine) | F3-01, F3-02 | Haiku | waiting |
| F3-04 | l10n for the Statistics tab in all five bundles | F3-02 | Claude Haiku | waiting |
| F3-05 | Mailmap parity in `author_stats` (decision TQ5) | F3-01, TQ5 confirmed | Muse Code | waiting |
| F3-06 | Date-range filter (only if TQ1 picks the scrubber reading) | F3-02, TQ1 | Muse Code | waiting |
| F3-07 | File History: engine path-scoped log (only if TQ1 picks File History) | TQ1 | Muse Code | waiting |
| F3-08 | VS Code Timeline provider over F3-07 (only if TQ1 picks Timeline) | F3-07, TQ1 | Muse Code | waiting |

F3-05 to F3-08 depend on decisions and are decision-dependent as the research
marks them. F3-06 to F3-08 exist only when TQ1 selects them.

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
