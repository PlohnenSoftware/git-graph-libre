---
summary: >-
  F4-02: Pure hotspot scoring model (`src/blameHotspot.ts`) assigning
  deterministic 10-step heat buckets (0 coldest through 9 hottest) to blame
  hunks using file-relative rank-quantile recency, calendar-age thresholds,
  and optional churn density, with unit tests for every edge case.
---

# F4-02 — Hotspot age-heat and churn scoring model

Status: done — awaiting integration

Needs: F4-01

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`070-history/240-blame-view.md`) for decisions (`BQ2`) and standing
rules; "Git Graph+ features and next-release additions: research and slice
plan" (Future work), subsection "Blame view" (`040-blame-view.md`), section
1.2.

Rules for every slice: implement from this project's own patterns; never copy
third-party code. Tests ship with behavior. Strict Biome on touched files, no
`var`, American English, no new telemetry events or declarations. Do not bump
versions or edit `CHANGELOG.md`, `README.md`, or `NOTICE.md`; the integrator
does. Report Sonar: integrator.

## Touch

New `src/blameHotspot.ts` (pure TypeScript module with zero DOM or `vscode`
dependencies so both extension/backend tests and the webview bundle can import
it cleanly); new `tests/backend/blameHotspot.test.ts`; this slice file's
Status and Report. Do not touch `src/backend/queries/blame.ts` or any webview
file.

## Task and acceptance

- **Constants & types:**
  - `BLAME_HEAT_BUCKETS = 10` (indices `0` = coldest/oldest through `9` =
    hottest/newest).
  - `BlameHeatLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9`.
  - `BlameHotspotMode = "age" | "calendar" | "churn" | "off"`.
  - `BlameHunkHeat = { level: BlameHeatLevel | null; uncommitted: boolean; commitHunkCount: number; commitLineCount: number }`
    (`level` is `null` when `mode === "off"` or the hunk is uncommitted).
- **Scoring modes (all pure, deterministic, never mutate inputs):**
  - **`age` (default — file-relative rank-quantile recency):**
    - Collect unique `authorTime` values across all **committed** (non-uncommitted)
      commits present in the file's hunks, sorted ascending (oldest first).
    - Map each commit's unique timestamp rank `r` in `[0, N - 1]` to
      `0..9` monotonically:
      - If `N === 1`, assign bucket `5` (mid-neutral heat so a brand-new
        single-commit file doesn't scream maximum red/orange across every line
        or look dead-cold; document this choice clearly).
      - If `N > 1`, `Math.round((r / (N - 1)) * (BLAME_HEAT_BUCKETS - 1))`,
        clamped to `0..9`.
    - Two commits with identical `authorTime` receive the exact same heat
      level.
    - Uncommitted hunks (`uncommitted === true`) are excluded from the rank
      pool and always return `{ level: null, uncommitted: true, ... }`.
  - **`calendar` (absolute age relative to an injected `nowSeconds`):**
    - Maps `age = Math.max(0, nowSeconds - authorTime)` into 10 fixed
      thresholds from hottest (`9`: `<= 1 day`) down to coldest (`0`: `> 2 years`)
      with clear intermediate steps (`2d`, `7d`, `14d`, `30d`, `90d`, `180d`,
      `365d`, `730d`). Future timestamps (`authorTime > nowSeconds`) clamp to
      bucket `9`.
  - **`churn` (hotspot density / commit concentration):**
    - Scores each committed hunk by combining recency rank and commit
      footprint / fragmentation across the file (e.g., how frequently a commit
      appears across scattered hunks or recent multi-hunk touches), normalized
      deterministically across `0..9` so high-churn areas stand out cleanly.
    - Pure and monotonic; uncommitted hunks still return `level: null`.
  - **`off`:** returns `level: null` for every hunk while still populating
    `uncommitted`, `commitHunkCount`, and `commitLineCount`.
- **Tests (`tests/backend/blameHotspot.test.ts`):**
  - Empty hunk list returns empty result.
  - Single-commit file returns deterministic middle bucket (`5`), not `NaN`.
  - Two commits return `0` (older) and `9` (newer).
  - Skewed timestamps (one 10-year-old license header + 9 commits within the
    past week) spread evenly across `0..9` in `age` mode (verifying why
    rank-quantile prevents recent-commit compression).
  - Equal timestamps across different commits produce equal heat levels.
  - Uncommitted hunks never skew committed ranks and always yield
    `level: null, uncommitted: true`.
  - `calendar` mode checks every boundary (`0s`, `1d`, `2d`, `7d`, `14d`,
    `30d`, `90d`, `180d`, `365d`, `730d`, `>730d`, future timestamp).
  - `churn` and `off` modes verified, plus input-immutability check.

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `npx vitest run --project backend tests/backend/blameHotspot.test.ts`,
and `node ./docs/kb/housekeeping.mjs --check`) and record each command and
result. Claim and changes are separate signed commits; never push.

## Report

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-23 12:03
- **Branch and commits:** `blame/F4-02`
  - `9326bd7b G docs(blame): claim F4-02 hotspot scoring model (F4-02)`
  - `5529aa91 G feat(blame): add the pure hotspot scoring model (F4-02)`
  - `2a330a0e G test(blame): cover the hotspot scoring model (F4-02)`
  - this report commit: `G docs(blame): report F4-02 ...` (see the integration handoff)
- **Files changed:** `src/blameHotspot.ts` (+224), `tests/backend/blameHotspot.test.ts` (+288), this slice file (status and report). 513 insertions, 1 deletion in total (`git diff --stat 7db1d290..HEAD`, before the report commit).
- **Tests added or changed:** 17 new tests in `tests/backend/blameHotspot.test.ts`, covering empty input, single commit (5, not NaN), two commits (0 and 9), skewed timestamps (0..9 spread), equal timestamps, uncommitted exclusion (including a working-tree time between committed times), missing commit, every calendar boundary through `730d` and `>730d`, the future clamp, churn (exact scores, determinism, monotonic recency, uncommitted exclusion), off mode, and immutability over all four modes with deep-frozen inputs. Count before: 0. Count after: 17.
- **Gates:**
  - `npx vitest run --project backend tests/backend/blameHotspot.test.ts`: 17 passed, exit 0.
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings src/blameHotspot.ts tests/backend/blameHotspot.test.ts`: exit 0, no diagnostics. The run also printed a config-version notice (`biome.strict.jsonc` names schema 2.5.13, the installed CLI is 2.6.8). It is pre-existing and was not edited.
  - `pnpm run typecheck` (src, src/webview and tests projects): exit 0.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Sonar: integrator.
- **Acceptance:**
  - Constants and types (`BLAME_HEAT_BUCKETS = 10`, `BlameHeatLevel`, `BlameHotspotMode`, `BlameHunkHeat` with the four named fields): met.
  - `age` rank-quantile, single timestamp to 5, equal timestamps to equal levels, uncommitted excluded from the rank pool: met, tested.
  - `calendar` with injected `nowSeconds`, the listed thresholds, future to 9: met, every boundary tested.
  - `churn` deterministic, documented, uncommitted null: met, tested (formula below).
  - `off` returns null levels and fills the uncommitted flag and footprint counts: met, tested.
  - Pure, no DOM, no `vscode`, never mutates inputs: met. The module imports only the type `GitBlameCommit` and `GitBlameHunk` from `@/backend/types`, which is erased at runtime. Immutability tested with frozen inputs.
  - Touch list respected: only the new module, the new test file, and this slice file. `src/backend/queries/blame.ts` and webview files untouched. No dependency added.
- **Deviations from the slice:**
  - **Churn formula chosen** (the slice left it open): for a committed hunk, `raw = ((rank + 1) / count) * hunksOfItsCommit`, where `rank` is the commit's rank among distinct committed timestamps and `count` is how many there are. The level is `round(9 * raw / largestRaw)`. Recency is the same rank as `age`, so the newest committed time has fraction 1 and the oldest has fraction `1/count`. Footprint is the number of hunks the commit owns in this file. Line counts are not used in the score (exposed as `commitLineCount` for the UI). The result is deterministic, monotonic in both recency and hunk count, and the file's hottest committed hunk is always 9. When all committed hunks share one timestamp, churn is proportional to hunk count alone.
  - A hunk whose commit is missing from the `commits` map is treated as uncommitted (`level: null`, `uncommitted: true`). The slice did not say this; the query guarantees the map holds every hunk's commit, so this only guards bad input.
  - `ageLevelForRank` and `calendarLevelForTime` are exported in addition to `scoreBlameHunks`, so the rule can be read by a test or by the UI. The slice's required export list did not forbid this.
  - `scoreBlameHunks(hunks, commits, mode, nowSeconds)` takes `nowSeconds` on every call; only `calendar` reads it. Callers in other modes pass any value.
  - The `feat` commit message says the tests "run with the test commit that follows", which is accurate (the tests landed in the next commit); the commit history is not amended, per the rules.
- **Open questions / follow-ups:**
  - The integrator should confirm the churn formula above is acceptable before F4-03 onward depends on the churn mode's exact levels. It is a single function (`churnLevels`) and a single test pins its values.
  - Biome config-version notice (`2.5.13` schema vs `2.6.8` CLI) is pre-existing in `biome.strict.jsonc`; the maintainer may want to align them.
