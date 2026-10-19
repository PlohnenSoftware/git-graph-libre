---
summary: >-
  D13F · ready · TypeScript · ≤40 lines: clear the two SonarQube findings
  the wave gate found in D13's `src/webview/main.ts` (S6582 optional chain,
  S2234 argument order at the swap call). Comparison behavior and tests
  stay unchanged.
---

# D13F — Comparison Sonar follow-up

Status: claimed by Muse Code (general-purpose) sub-agent D13F on 2026-10-19 11:02
Needs: D13 (integrated); dispatch after D12 integrates (both touch `src/webview/main.ts`)
Decisions: — (a follow-up the integrator opened to bring the wave gate to `OK`, as with D41F, D42F and D43F)
Kind: TypeScript · Size budget: ≤ 40 changed lines outside tests
Source: the integration log's wave gate on `2026-10-19` (Sonar analysis `a86769fe-5852-4332-8281-a9aff7766380`)

## Goal

Fix the two findings in `src/webview/main.ts` without changing what the
comparison header, Swap or diff titles do.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D13's slice file and report (`230-d13-comparison-header-and-swap.md`)
- `src/webview/main.ts` around lines 6132–6134 and
  `tests/webview/commitDetailsView.test.ts`

## Facts (the wave gate, `2026-10-19`)

| Rule | Line | Severity | Finding |
| --- | --- | --- | --- |
| `typescript:S6582` | 6132 | minor | prefer an optional chain expression |
| `typescript:S2234` | 6134 | major | arguments `compareRef`/`baseRef` not in the function's parameter order |

The S2234 call is the Swap action: exchanging base and compare is the
point of the call. Fix it by making the exchange explicit in code (for
example named locals for the swapped values), never by suppressing the
rule, and verify against the function signature that the swap still
sends base and compare exchanged, exactly as D13's tests pin.

## Steps

1. Line 6132: use the optional chain Sonar asks for, same semantics.
2. Line 6134: restructure so the intentional exchange reads as one and
   S2234 no longer fires, with the sent request unchanged.
3. Change nothing else.

## Touch

`src/webview/main.ts`, `tests/webview/commitDetailsView.test.ts` (only
if a case is needed)

## Tests

All existing webview tests pass unchanged, the Swap cases included
(`pnpm exec vitest run --project webview tests/webview/commitDetailsView.test.ts`,
then the full webview project).

## Acceptance

- Strict Biome clean on touched files, typecheck green, webview tests green.
- The integrator's next Sonar scan shows neither finding.

## Report

_(not started)_
