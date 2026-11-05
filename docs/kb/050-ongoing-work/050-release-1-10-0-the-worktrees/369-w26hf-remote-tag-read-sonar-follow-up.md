---
summary: >-
  W26HF · wave A · ready · TypeScript · ~20 lines: clear the three SonarQube
  maintainability findings the gate on `3ba7cc3` found in W26H's
  `src/backend/queries/remoteTags.ts` (S7780 `String.raw`, S1528 the `Array`
  constructor, S9382 `await` in a loop). Behavior and tests stay unchanged.
---

# W26HF — Remote tag read Sonar follow-up

Status: claimed by Claude Haiku 5.5 on 2026-11-05 18:30
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

Not started.
