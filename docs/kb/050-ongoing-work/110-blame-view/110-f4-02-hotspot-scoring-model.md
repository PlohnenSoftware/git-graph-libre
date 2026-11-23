---
summary: >-
  F4-02: Pure hotspot scoring model (`src/blameHotspot.ts`) assigning
  deterministic 10-step heat buckets (0 coldest through 9 hottest) to blame
  hunks using file-relative rank-quantile recency, calendar-age thresholds,
  and optional churn density, with unit tests for every edge case.
---

# F4-02 — Hotspot age-heat and churn scoring model

Status: ready

Needs: F4-01

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for decisions (`BQ2`) and standing
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

Not started.
