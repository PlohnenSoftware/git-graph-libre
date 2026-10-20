---
summary: >-
  D66 · ready · CI · ~300 lines: the release stalled because GitHub had no
  macOS arm64 runner, twice. Redesign `publish.yml` and `verify-vsix.yml`:
  a gate job publishes when at most two of the ten verify legs never got a
  runner, each retried automatically once in a one-leg run; any leg that ran
  and failed fails the release; manual triggers can build or publish an
  existing tag and skip named legs. Maintainer request, `2026-10-20`.
---

# D66 — A release gate that tolerates runner shortages

Status: done — awaiting integration
Needs: —
Decisions: the maintainer, `2026-10-20`. "2 of 10 runs can be not runned and
it will still pass to publish after timeout but more will need rerun; make
sure that if any runner fails, not times out, it gets failed"; "add manual
skip triggers for our later convenience"; "one auto retry for timed out
runners". The orchestrator settled the rules below.
Kind: CI workflows + a tested Node script + docs · Size budget: ~300 changed lines outside tests
Source: the `v1.9.0` release run `39461675485`, whose macOS arm64 leg twice
ended "The job was not acquired by Runner of type hosted even after multiple
attempts", so "Release and publish" was skipped

## Facts (checked `2026-10-20` on that run, through the jobs API)

- A leg that never got a runner: `status: completed`, `conclusion:
  cancelled`, `runner_id: 0`, `runner_name: ""`, `steps: []`, and
  `started_at` equal to `created_at`. GitHub gave up about 15 minutes after
  it was queued.
- A leg that ran: a non-zero `runner_id`, a runner name, and steps (Windows
  x64 had 9).
- `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs?filter=latest` lists
  the latest attempt of every job, with jobs reused from a previous attempt.
- GitHub cannot re-run one job while its run is still in progress. A
  `workflow_dispatch` started with `GITHUB_TOKEN` does create a new run;
  most other events started with it do not.
- `actions/download-artifact` can read another run's artifact given
  `run-id` and `github-token` (needs `actions: read`).
- `publish.yml` publishes only on a tag push (`if: github.event_name ==
  'push'`), and `release` needs `[package, verify]`, so one leg without a
  runner blocks everything.
- The tag-push run uses the workflow file at the tagged commit.

## Rules

A **leg** is one platform of the verify matrix. Its outcome is one of:

- **passed**: it ran and succeeded;
- **failed**: it ran (a non-zero `runner_id` or any step) and did not
  succeed, *including* exceeding its own `timeout-minutes`. That fails the
  release at once;
- **not run**: it never got a runner (`runner_id` 0 and no steps, whatever
  conclusion GitHub gave), or it is still queued when the queue timeout
  expires (`VERIFY_QUEUE_TIMEOUT_MINUTES`, default 30, from when the leg
  was created);
- **skipped**: named in the manual `skip_legs` input, so never scheduled.
  It doesn't count toward the limit.

Each not-run leg is retried **once, automatically**, in a separate one-leg
run of `verify-vsix.yml` (`workflow_dispatch`, with that leg and this run's
id for the artifact). The retry's outcome replaces the leg's, with the same
rules; a retry that again gets no runner leaves the leg not run.

**Decision:** any failed leg fails the gate. More than `max_not_run`
not-run legs (default **2**) also fail it; the message says to use "Re-run
failed jobs". Otherwise the gate passes, and publishing proceeds. The gate
writes a job summary table: every leg, its outcome, its retry and the
links.

## Steps

1. **One leg list.** Move the ten legs, exactly as they are today, from
   `verify-vsix.yml`'s inline matrix into `.github/verify-vsix-legs.json`.
2. **`verify-vsix.yml`** takes a `legs` input (a JSON array of leg objects)
   and an optional `artifact_run_id`, under both `workflow_call` and
   `workflow_dispatch`. It sets `run-name` from an optional `retry_token`
   input, so the gate can find its own retry run. Its matrix is
   `fromJSON(inputs.legs)`, with `fail-fast: false` and the 10-minute leg
   timeout unchanged. With `artifact_run_id` set, it downloads the VSIX from
   that run.
3. **`publish.yml`:**
   - `workflow_dispatch` inputs: `tag` (an existing tag to build; required
     when publishing), `publish` (boolean, default `false`, so a manual run
     stays a dry run unless asked), `skip_legs` (comma-separated leg names,
     default empty; an unknown name fails the run) and `max_not_run`
     (default `2`).
   - A `plan` job reads the leg list, applies `skip_legs` and outputs the
     legs to run.
   - Every job checks out `inputs.tag` when one is given, else the pushed
     ref.
   - `verify` runs `verify-vsix.yml` with the planned legs.
   - A `verify-gate` job needs `plan` and `package`, **not** `verify`, and
     applies the Rules by polling the jobs API every ~30 s. Its
     permissions are `actions: write` and `contents: read`; its
     `timeout-minutes` covers the queue timeout, the retry and the leg
     timeout.
   - `release` needs `[package, verify-gate]` and runs when the gate passed
     and either the event is a tag push or `publish` is true. On a manual
     publish it checks that `tag` equals `v` plus `package.json`'s version
     at that tag. It creates or updates the GitHub release for that tag and
     publishes with `--skip-duplicate` as today.
4. **The logic in a script.** `scripts/release-verify-gate.mjs` exports a
   pure function from the jobs-API payload, the expected leg names, the
   skips, the current time and the limits to each leg's outcome and the
   decision. The workflow step loops: fetch, decide, retry when needed,
   repeat.
5. **Docs:** update the header comments of both workflows, and the
   knowledge base record "Verifying the packaged VSIX on every platform"
   under Phase 16. Add how to use the manual inputs, and the rule that a tag
   push uses the tagged commit's workflow, so a fix to these workflows
   reaches a tag that already exists only through a manual run from `main`
   with `tag` set.

## Touch

`.github/workflows/publish.yml`, `.github/workflows/verify-vsix.yml`,
`.github/verify-vsix-legs.json` (new), `scripts/release-verify-gate.mjs`
(new), `tests/backend/releaseVerifyGate.test.ts` (new),
`docs/kb/050-ongoing-work/030-implementation-roadmap/010-phase-16-rust-engine-backend/270-verifying-the-packaged-vsix-on-every-platform.md`

## Tests

The gate function, on job payloads shaped like the facts above:

- all passed → pass;
- one leg ran and failed → fail at once, whatever else is queued;
- a leg that ran past its timeout → failed;
- one or two never-acquired legs → retry requested, then pass when the
  retries pass or again get no runner;
- three not-run legs after retries → fail, with the re-run message;
- a leg still queued before the timeout → wait; after it → not run;
- skipped legs don't count;
- a retry that runs and fails → fail;
- an unknown `skip_legs` name → error;
- jobs reused from a previous attempt (`filter=latest`) are read correctly.

## Acceptance

- `pnpm run test` counts with the new suite; strict Biome on the new test
  file; typecheck.
- Both workflows parse as YAML. Every `${{ }}` context the agent uses is
  checked against GitHub's documented availability for that key (for
  example `matrix` cannot be used in a job-level `if`). List each one in the
  report.
- Not testable locally: a real run on GitHub. The report says so, and gives
  the exact `gh workflow run` command for a dry run and for publishing
  `v1.9.0`.
- `Sonar: integrator`.

## Report

- **Agent / date:** Claude Sonnet 5.5, 2026-10-20
- **Branch and commits:** `diff-1.9.0/d66`
  - `2cfc2f1 G docs(release): claim D66`
  - `645be88 G ci(release): list the ten verify legs in one JSON file`
  - `de9aa6c G feat(release): add the verify gate decision script and its tests`
  - `a04e7dc G ci(release): verify-vsix takes its legs and an artifact run as inputs`
  - `94d8dbf G ci(release): native-build can build a named tag`
  - `bcd632a G ci(release): gate the release on a tolerant verify gate, add manual inputs`
  - `75a3410 G docs(release): record the tolerant release gate in the VSIX verification section`
- **Files changed:** `.github/verify-vsix-legs.json` +32; `.github/workflows/publish.yml` +165/−; `.github/workflows/verify-vsix.yml` +92/−; `.github/workflows/native-build.yml` +9; `scripts/release-verify-gate.mjs` +355; `scripts/release-verify-gate.d.mts` +79; `tests/backend/releaseVerifyGate.test.ts` +423; the Phase 16 VSIX record +53/−; `docs/kb/README.md` (generated index) ±1
- **Tests added or changed:** `tests/backend/releaseVerifyGate.test.ts`, 31 tests (backend 1111 passed before, 1142 after)
- **Gates:** strict Biome clean on the new test file; typecheck clean; test backend 1142 passed, 60 skipped (pre-existing) / 1202, webview 791/791; l10n n/a; kb:check ok; Rust arm n/a; Sonar: integrator
- **Acceptance:** all three workflows and the leg JSON parse (PyYAML, `json`); the new suite passes; the contexts used were checked against GitHub's documented availability (listed in the hand-back); a real run on GitHub is not testable locally; `gh workflow run` commands are in the Phase 16 VSIX record.
- **Deviations from the slice:** (1) `native-build.yml` edited (an optional `ref` input) and (2) `scripts/release-verify-gate.d.mts` added, both outside Touch: the first so a manual publish of an existing tag builds that tag's engine, the second so the TypeScript suite can import the `.mjs` (same arrangement as `verify-vsix.d.mts`). (3) `plan` and `verify-gate` check out the run's own commit, not `tag`, because the script and leg list do not exist in older tags such as `v1.9.0`. (4) `native` needs `plan` so a bad input fails before the build. (5) The polling loop lives in the script's `runGate` (injected API, tested), not in workflow shell.
- **Open questions / follow-ups:** a leg queued past the timeout is counted, not cancelled, so it may still run later; the run can show red (`verify`) while the gate and release are green; `VERIFY_QUEUE_TIMEOUT_MINUTES` is read from a repository variable (`vars`), default 30.
