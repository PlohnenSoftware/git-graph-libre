---
summary: >-
  F3-01: Typed, project-owned wrappers over the engine's existing `authorStats`
  and `activityHeatmap` exports, gated on engine availability, returning a typed
  unavailable result instead of throwing. No UI.
---

# F3-01 — Engine bridge

Status: done — awaiting integration

Needs: none

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (`020-rules/040-multi-agent-releases.md`); the
register (`050-ongoing-work/130-history-and-statistics.md`) for TQ1 to TQ7; the
research, "Git Graph+ features: research and slice plan" (Future work),
subsection "timeline" (`060-future-work/040-git-graph-plus-features-research-and-plan/030-timeline.md`),
sections 2.3 and 6; the engine surface (`050-ongoing-work/030-implementation-roadmap/010-phase-16-rust-engine-backend/170-the-engine-surface-what-is-wired-what-was-removed-what-is.md`),
"Planned: a Statistics tab"; and `src/backend/engine/reflog.ts` as the
pattern for an optional export with deps injected for tests.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never read or copy Git Graph+ code (TQ3). Tests ship with
behavior, and touch only temporary directories or fakes. Strict Biome on
touched files, no `var`, American English, OKLCH colors through `--ngg-*`
tokens with VS Code theme tokens first. No new telemetry events or
declarations. Do not bump versions (`EXPECTED_ENGINE_VERSION`, `engine/Cargo.toml`)
or edit CHANGELOG, README or notices; the integrator does. Report Sonar:
integrator. This slice edits no Rust and needs no addon rebuild.

## Touch

`src/backend/engine/addon.ts` (two optional members on `EngineAddon`, not in
the load shape check); new `src/backend/engine/stats.ts`; new
`src/backend/types/stats.types.ts`; `src/backend/types/index.ts` (re-export
only); new `tests/backend/engine/stats.test.ts`; the slice file's Status and
Report.

## Facts to confirm before writing (verified in the register's research)

- The Rust exports are `author_stats(path)` and `activity_heatmap(path)` in
  `engine/native/node/src/lib.rs` (lines 393 and 404). Both are `async`, take
  the repository path, and resolve to a JSON string. napi-rs renames
  snake_case functions to camelCase, as `remote_url` becomes `remoteUrl`, so
  the JavaScript names are `authorStats` and `activityHeatmap`. Confirm this
  against the built addon (`strings` on `engine/native/linux-x64/git-graph.node`
  after a build) and record the result in the Report.
- Payloads: an array of `{ name, email, commits }` (`GitAuthorStat`) and an
  array of non-zero `{ weekday, hour, count }` (`GitActivityCell`, weekday 0 is
  Sunday). Map them into project types; never expose the wire names.
- Today `addon.ts` declares neither member, so the typings are the first gap.

## Task and acceptance

- `addon.ts`: add optional `authorStats?(repoPath: string): Promise<string>`
  and `activityHeatmap?(repoPath: string): Promise<string>`, with a doc comment
  in the style of `loadReflog`. They are absent from the shape check, so a
  binary built without them still loads.
- `stats.ts`: two reads, `readAuthorStats(repo, deps?)` and
  `readActivityHeatmap(repo, deps?)`, each returning
  `{ state: "ok"; value } | { state: "unavailable"; reason }`. The reason is
  one of `"noAddon"` (no addon, or an addon without the export), `"backendCli"`
  (the `backend` setting is `git-cli`), `"notVerified"` (Git has not confirmed
  the repository; `isVerified` as in `reflog.ts`) or `"failed"` (the engine
  rejected, or the payload did not parse). Deps are injected the way
  `ReflogDeps` is: `backend`, `addonProvider`, `isVerified`.
- Never throw. An engine rejection becomes `"failed"` and is written to the
  operation log with `logBackendRoute`, as the reflog reader does.
- Validate the payload: an array; each author has string `name` and `email`
  and a non-negative integer `commits`; each cell has `weekday` 0 to 6, `hour`
  0 to 23 and a positive integer `count`. Any other shape is `"failed"`, with
  no partial value.
- Tests (fakes only, no real repository): an `ok` mapping of both reads; each
  of the four unavailable reasons; a rejecting addon; malformed JSON; an out
  of range weekday; an empty array, which is `ok` with an empty value; and a
  check that the addon's `authorStats` and `activityHeatmap` receive the path
  and are not called when the backend is `git-cli`.
- No UI, no message handler, no l10n. The tab is F3-02.

## Checks

- `pnpm exec biome check --config-path biome.strict.jsonc --error-on-warnings <each touched .ts file>`
- `pnpm run typecheck`
- `pnpm exec vitest run --project backend tests/backend/engine/stats.test.ts`
- Record each command and its counts in the Report.

## Report

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-23 02:06
- **Branch and commits:** `stats/F3-01`
  - `5a825e6c G docs(stats): claim engine bridge slice (F3-01)`
  - `146a3f53 G feat(stats): optional engine exports and project types for statistics (F3-01)`
  - `05e9525e G feat(stats): typed engine reads for author stats and activity (F3-01)`
  - `094053c0 G test(stats): cover the Statistics engine reads (F3-01)`
  - this report and the status line: the final commit on the branch
- **Export names (confirmed against the built addon):** `node -e "const a=require('./engine/native/linux-x64/git-graph.node'); console.log(typeof a.authorStats, typeof a.activityHeatmap)"` prints `function function`. The same run confirms `loadReflog`, `authors` as functions. The Rust names `author_stats` and `activity_heatmap` map to `authorStats` and `activityHeatmap`, as the facts section predicted.
- **Files changed (vs `a60d6358`):**
  - `src/backend/engine/addon.ts`: +15 (two optional members, not in the shape check)
  - `src/backend/engine/stats.ts`: +144 (new)
  - `src/backend/types/stats.types.ts`: +39 (new)
  - `src/backend/types/index.ts`: +1 (re-export)
  - `tests/backend/engine/stats.test.ts`: +281 (new)
  - `docs/kb/.../100-f3-01-engine-bridge.md`: status line and this report
  - Total: 481 insertions, 1 deletion (the status line)
- **Tests added or changed:** 26 new tests in `tests/backend/engine/stats.test.ts`, 0 before and 26 after. 0 skipped; the two real-addon cases ran against a `makeRepo` repository. Result: 26 passed.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the five touched `.ts` files: exit 0 after one import-order fix. Biome also prints an informational note that the config `$schema` (2.5.13) does not match the CLI (2.6.8). It is not a diagnostic and is not caused by this slice.
  - `pnpm run typecheck`: exit 0 (`tsc` over `src`, `src/webview` and `tests`).
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - `npx vitest run --project backend tests/backend/engine/stats.test.ts`: 26 passed.
  - Sonar: integrator
- **Acceptance:**
  - `addon.ts`: optional `authorStats?` and `activityHeatmap?`, with doc comments, absent from `isEngineAddon`. Met.
  - `stats.ts`: `readAuthorStats` and `readActivityHeatmap` return `ok` or `unavailable` with the four reasons (`noAddon`, `backendCli`, `notVerified`, `failed`), using the injected `backend`, `addonProvider` and `isVerified` deps. Met, and covered by tests.
  - Never throws: a rejection becomes `failed` and is logged with `logBackendRoute`. Met.
  - Validation: strict. Array shape, `name` and `email` strings, non-negative safe-integer `commits`, weekday 0 to 6, hour 0 to 23, positive integer `count`; no partial value. Met, with tests for each case.
  - Tests listed in the slice (ok mapping of both reads, the four reasons, rejecting addon, malformed JSON, out-of-range weekday, empty array as ok, and the no-call check on `git-cli`): all present. Met.
  - No UI, message handler or l10n; no telemetry, version bump, CHANGELOG, README or notices edits. Met.
- **Deviations from the slice:**
  - Any engine rejection is `failed`. `isEngineFallbackError` is not used, because these reads have no CLI route to decline into.
  - The slice's test list says "fakes only" and also names the real repository read. The real-addon cases from the task brief are included; they use a temporary `makeRepo` repository, not a fake, and skip cleanly when the addon is absent.
  - `stats.ts` names its unavailable branch `unavailable(...)` in code and logs it with `reason=` (for example `backend=unavailable reason=noAddon`). This is an implementation choice and does not change any type.
- **Open questions / follow-ups:** None for F3-01. Sonar is the integrator's. The engine payload field names come from the register's facts; the real-addon test confirms the mapping for one author and a single heatmap cell only, and the integrator should run the broader parity check when F3-02 wires the tab.
