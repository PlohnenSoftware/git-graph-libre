---
summary: >-
  D42F · ready · TypeScript · ≤40 lines: clear the four SonarQube findings
  the wave gate found in D42's `src/webview/diffTab/view.ts`: two `.dataset`
  reads (high), a nested ternary and a last-element access. The view's
  behavior and tests stay unchanged.
---

# D42F — View Sonar follow-up

Status: ready
Needs: D42 (integrated)
Decisions: — (a follow-up the integrator opened to bring the wave gate to `OK`, as with D41F and D43F)
Kind: TypeScript · Size budget: ≤ 40 changed lines outside tests
Source: the integration log's wave gate on `2026-10-19` (Sonar analysis `6717d946-4c8f-4566-94a5-adc43fbe66e0`)

## Goal

Bring the quality gate back to `OK` by fixing the four findings in
`src/webview/diffTab/view.ts`, without changing what the view does.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D42's slice file and report (`520-d42-the-diff-view.md`)
- `src/webview/diffTab/view.ts` and `tests/webview/diffTab/view.test.ts`

## Facts (the wave gate, `2026-10-19`)

| Rule | Line | Severity | Finding |
| --- | --- | --- | --- |
| `typescript:S7761` | 177 | high | `button?.getAttribute("data-expand")`: prefer `.dataset` |
| `typescript:S7761` | 180 | high | `button?.getAttribute("data-region")`: prefer `.dataset` |
| `typescript:S3358` | 64 | medium | nested ternary for the sign text (`+`, `−` or empty) |
| `typescript:S7755` | 165 | low | `changes[changes.length - 1]`: prefer `.at(-1)` |

## Steps

1. Lines 175–180: read the attributes through `dataset` (`dataset.expand`,
   `dataset.region`). `closest()` returns an `Element`, which has no
   `dataset`, so narrow the result to `HTMLElement` first (for example
   `instanceof HTMLElement`).
2. Line 64: replace the nested ternary with a plain statement or a small
   helper that returns the sign for a cell.
3. Line 165: use `changes.at(-1)`. It is `number | undefined`, and the
   early return above guarantees the list isn't empty; keep `target` a
   `number` without a non-null assertion, for example by falling back to
   the current row.
4. Change nothing else.

## Touch

`src/webview/diffTab/view.ts`, `tests/webview/diffTab/view.test.ts` (only
if a case is needed for an uncovered branch)

## Tests

All existing view tests pass unchanged
(`pnpm exec vitest run --project webview tests/webview/diffTab`).

## Acceptance

- Strict Biome clean on the touched file, typecheck green, the diffTab
  tests green.
- The integrator's next Sonar scan shows none of the four findings.

## Report

_(not started)_
