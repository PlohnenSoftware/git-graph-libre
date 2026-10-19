---
summary: >-
  D14F · ready · TypeScript · ≤150 lines: clear the six SonarQube findings
  the second wave gate found in the D12/D14 comparison code (messageHandler
  complexity 32, two nested ternaries, two nested template literals, one
  optional chain). Behavior and tests stay unchanged.
---

# D14F — Working-tree comparison Sonar follow-up

Status: ready — dispatch after D15 integrates (shared `messageHandler.ts` and `main.ts`)
Needs: D14 (integrated), D15
Decisions: — (a follow-up the integrator opened to bring the wave gate to `OK`, as with D41F, D42F, D43F, D04AF and D13F)
Kind: TypeScript · Size budget: ≤ 150 changed lines outside tests
Source: the integration log's second wave gate on `2026-10-19` (Sonar analysis `2671be4c-0a5c-4621-bfdf-18f32f392fff`)

## Goal

Fix the six findings below without changing any comparison behavior.
D04AF's and D13F's findings are already closed; these six are what keeps
the gate at `ERROR` (1 high issue; 6 new violations against the limit 5).

## Read first

- [The agent protocol](010-agent-protocol.md)
- D14's and D12's reports (`240-d14-compare-with-the-working-tree.md`,
  `220-d12-compare-with-dialog.md`)
- `src/extension/messageHandler.ts` around lines 97–121,
  `src/backend/queries/commitComparison.ts` line 37,
  `src/webview/main.ts` line 3885 (line numbers from the scan's tree;
  find the code by content after D15 lands)

## Facts (the wave gate, `2026-10-19`)

| Rule | File:line | Severity | Finding |
| --- | --- | --- | --- |
| `typescript:S3776` | `src/extension/messageHandler.ts:97` | critical (the gate's high issue) | Cognitive Complexity 32, 16 allowed |
| `typescript:S3358` | `src/extension/messageHandler.ts:109` | major | nested ternary |
| `typescript:S4624` | `src/extension/messageHandler.ts:121` | major | nested template literal (×2) |
| `typescript:S3358` | `src/backend/queries/commitComparison.ts:37` | major | nested ternary |
| `typescript:S6582` | `src/webview/main.ts:3885` | minor | prefer an optional chain |

## Steps

1. `messageHandler.ts`: extract small helpers from the flagged function
   (the diff-title/viewDiff working-tree logic D14 added is the natural
   seam) until complexity is at most 16; the nested ternary and template
   literals go with the same restructure. Titles, URIs and the
   deleted-file behavior stay byte-identical — D14's `messageHandler`
   tests pin them.
2. `commitComparison.ts:37`: replace the nested ternary with a plain
   statement; the `*`/`-R` argument construction stays identical.
3. `main.ts:3885`: the optional chain, same semantics.
4. Change nothing else; no suppressions anywhere.

## Touch

`src/extension/messageHandler.ts`, `src/backend/queries/commitComparison.ts`,
`src/webview/main.ts`; their test files only if a case is needed for an
uncovered branch

## Tests

Full `pnpm run test` green unchanged (backend and webview), with counts
in the report.

## Acceptance

- Strict Biome clean on touched files, typecheck green, full tests green.
- The integrator's next Sonar scan shows none of the six findings and
  the gate returns to `OK`.

## Report

_(not started)_
