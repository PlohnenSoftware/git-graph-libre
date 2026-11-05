---
summary: >-
  W26HF · wave A · ready · TypeScript · ~20 lines: clear the three SonarQube
  maintainability findings the gate on `3ba7cc3` found in W26H's
  `src/backend/queries/remoteTags.ts` (S7780 `String.raw`, S1528 the `Array`
  constructor, S9382 `await` in a loop). Behavior and tests stay unchanged.
---

# W26HF — Remote tag read Sonar follow-up

Status: integrated `8ff94dd` (`2026-11-05`)
Needs: W26H (integrated `d607144`)
Decisions: —
Kind: TypeScript · Size budget: ~20 changed lines outside tests
Source: the gate on `3ba7cc3` (`2026-11-05`, Sonar task
`a37bf460-39d5-4444-9269-67e25073a00f`, quality gate `OK` with 3 new
violations against 5 allowed)

## Facts

- `typescript:S7780`, `remoteTags.ts:80`: use `String.raw` to avoid
  escaping `\`. This is probably the Windows `System32\taskkill.exe` path.
- `typescript:S1528`, `remoteTags.ts:163`: use a literal or `Array.from()`
  instead of the `Array` constructor.
- `typescript:S9382`, `remoteTags.ts:168`: an unexpected `await` inside a
  loop. This is the concurrency-capped worker loop. Restructure it so the
  cap of 4 holds without `await` in a loop, for example workers that each
  take the next index, started with `Promise.all`. D66F did the same for
  the release gate script.

## Steps

1. Fix each finding by restructuring, not suppressing: no `NOSONAR`, no
   `biome-ignore`.
2. Keep behavior identical: the cap of 4, order-preserving results, abort,
   timeout and overflow. Every existing `remoteTags` test passes unchanged.

## Touch

`src/backend/queries/remoteTags.ts`, `tests/backend/queries/remoteTags.test.ts`
(only if a test must be added)

## Acceptance

The integrator's next scan shows none of the three findings, and every
`remoteTags` and handler test passes unchanged.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:30
- **Branch and commits:** `wt-1.10.0/W26HF`
  - `ad4c6b7 G docs(release): claim W26HF, remote tag read Sonar follow-up (W26HF)`
  - `09b4a2f G refactor(tags): write the taskkill path as a raw string (W26HF)` (S7780)
  - `405cb3b G refactor(tags): take remote reads from a shared index without awaiting in a loop (W26HF)` (S1528, S9382)
  - this report commit
- **Files changed:** `src/backend/queries/remoteTags.ts` (+19 −11 in total against `864b6c0` across the two source commits and the claim; `docs/kb/.../369-w26hf-remote-tag-read-sonar-follow-up.md` +1 −1 for the claim, plus this report). No test file changed.
- **Tests added or changed:** none. `pnpm run test` after the change: backend 1243 passed, 60 skipped (1303 total); webview 836 passed (836 total); no "Unhandled Errors". The backend count before the change was not measured separately on `864b6c0`.
- **Gates:** strict Biome on `src/backend/queries/remoteTags.ts` and `tests/backend/queries/remoteTags.test.ts` exit 0, no findings (the `biome.strict.jsonc` schema-version notice is a pre-existing tooling message); `pnpm run typecheck` exit 0; `pnpm run test` exit 0. Sonar: integrator
- **Acceptance:**
  - None of the three findings: not verified here, because Sonar is the integrator's scan. The code changes target S7780 (`String.raw` at the taskkill path), S1528 (`new Array` replaced by `[]` filled by index) and S9382 (no `await` in a loop; workers chain through `.then` and `Promise.all` starts them).
  - Every existing `remoteTags` and handler test passes unchanged: met, the full suite passes and no test file was touched.
  - Behavior unchanged: the taskkill path string is the same value (`%SystemRoot%\System32\taskkill.exe`, the taskkill argv test passes), the cap of 4 is kept by `Promise.all` over `min(limit, items)` workers, results are order-preserving by index, and a rejected read still rejects the map.
- **Deviations from the slice:** two source commits instead of one, to keep the two restructures separate. The first commit's message says its checks ran "on the branch after the next commit": the checks ran on the branch tip, not on that intermediate state alone. I did not amend it, because the tool hook blocked the amend as destructive.
- **Open questions / follow-ups:** the integrator's Sonar scan should confirm that S9382 is gone for the `.then` chain form, since no scan was run here.
