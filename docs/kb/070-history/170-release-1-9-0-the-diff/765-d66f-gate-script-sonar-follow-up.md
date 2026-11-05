---
summary: >-
  D66F · integrated · script · ~60 lines: clear the six SonarQube findings D66's
  `scripts/release-verify-gate.mjs` brought in (cognitive complexity 22 in
  `runGate`, four `await`-in-loop, one promise chain where top-level `await`
  fits) by restructuring, not suppressing. Every gate decision and every
  test stays the same.
---

# D66F — Gate-script Sonar follow-up

Status: integrated 8c41805
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

- **Agent / date:** Claude Sonnet 5.5, 2026-10-20 12:30
- **Branch and commits:** `diff-1.9.0/d66f`
  - `b932835 G docs(release): claim D66F (D66F)`
  - `c13cd52 G refactor(scripts): poll the gate without await in loops (D66F)`
  - `2f8f5b7 G test(scripts): cover the gate's parallel paths (D66F)`
- **Files changed:** `scripts/release-verify-gate.mjs` (+60/−31), `scripts/release-verify-gate.d.mts` (+4), `tests/backend/releaseVerifyGate.test.ts` (+42/−1 net of the import line), this slice file.
- **Tests added or changed:** two added (a two-page job listing through `githubApi` with a stubbed `fetch`; two simultaneous retries, one dispatch failing); the existing 31 untouched; file 31 → 33.
- **Gates:** biome strict clean on the test file (the `.mjs` is outside Biome's allowlist); typecheck clean; test backend 1144/1204 (60 skipped), webview 791/791; `plan` smoke with a temp `GITHUB_OUTPUT` wrote 10 legs, and an unknown command prints `::error::Usage…` and exits 1; kb:check run after the report; Rust arm n/a; Sonar: integrator
- **Acceptance:** met by construction, to be confirmed by the integrator's Sonar. S3776: `runGate` is now a thin wrapper around `tick`, with `lookUpRetry`, `listRetryJobs`, `dispatchRetries` split out. S9382 x4: job paging is `listAllJobs` (page 1 then `Promise.all`), retry lookup is `listRetryJobs` (`Promise.all`), dispatch is `dispatchRetries` (`Promise.allSettled`), the poll is recursive `tick` (no `for (;;)`). S7785: `await main(...)` in a try/catch at the entry-point check, same `::error::` text and exit 1.
- **Deviations from the slice:** `githubApi` is now exported, with a declaration in the `.d.mts`, so the paging could be tested; no existing signature changed.
- **Open questions / follow-ups:** none.
