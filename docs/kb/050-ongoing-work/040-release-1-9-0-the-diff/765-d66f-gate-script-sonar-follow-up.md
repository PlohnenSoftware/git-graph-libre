---
summary: >-
  D66F · ready · script · ~60 lines: clear the six SonarQube findings D66's
  `scripts/release-verify-gate.mjs` brought in (cognitive complexity 22 in
  `runGate`, four `await`-in-loop, one promise chain where top-level `await`
  fits) by restructuring, not suppressing. Every gate decision and every
  test stays the same.
---

# D66F — Gate-script Sonar follow-up

Status: ready
Needs: D66
Decisions: —
Kind: script · Size budget: ~60 changed lines outside tests
Source: SonarQube analysis `fc119597-0cc6-468b-b3f7-3167514163ee`, gate
**ERROR** (`new_software_quality_high_issues` 1, `new_violations` 6)

## Findings, all in `scripts/release-verify-gate.mjs`

- `javascript:S3776` (line 218): `runGate` has cognitive complexity 22,
  above the 16 allowed.
- `javascript:S9382` (lines 227, 231, 242, 248): `await` inside a loop.
- `javascript:S7785` (line 351): a promise chain where top-level `await`
  fits.

## How (the orchestrator's choice: real restructuring, no suppression)

- **Paging:** `listJobs` reads page 1, takes `total_count`, then fetches the
  remaining pages together with `Promise.all`.
- **Retry lookup:** find each pending retry's run, and list its jobs, for
  all legs at once (`Promise.all` over the legs), in a helper.
- **Retry dispatch:** dispatch every requested retry at once with
  `Promise.allSettled`, recording each failure as today's `dispatchError`.
- **Polling:** the poll becomes a recursive async step (`tick` evaluates
  once, then either returns or sleeps and calls itself), with no
  `for (;;)`. Split it so every function stays at complexity ≤ 16.
- **CLI:** `await main(...)` at the top level inside the existing
  is-entry-point check, with the same error output and exit code 1.
- Behavior is unchanged: the same decisions, retry tokens, summary and exit
  codes. Every existing test passes untouched. Add a test only where the
  new parallel paths need one (paging across two pages; two retries at
  once, one of whose dispatch fails).

## Touch

`scripts/release-verify-gate.mjs`, `scripts/release-verify-gate.d.mts` (only
if an exported signature changes; avoid that),
`tests/backend/releaseVerifyGate.test.ts` (additions only)

## Acceptance

- None of the six patterns remains; `pnpm run test` counts; strict Biome on
  the test file; typecheck; `Sonar: integrator`.

## Report

_(not started)_
