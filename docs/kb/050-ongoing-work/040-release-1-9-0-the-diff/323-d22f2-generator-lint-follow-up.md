---
summary: >-
  D22F2 · ready · oracle scripts and one TS line · ~60 lines (a guide): clear
  wave gate 6's remaining Sonar findings in the Phase 17 oracle generators
  (string patterns for `replaceAll`, shadowing, unused parameter, nested
  ternaries and similar) and D44's nested ternary in `diffTabPanel.ts`,
  without changing any corpus.
---

# D22F2 — Generator lint follow-up

Status: ready
Needs: 22e, 22g, D22F (integrated)
Decisions: X13
Kind: JavaScript oracle scripts and one TypeScript line · Size: ~60 changed lines (a guide, not a limit)
Source: wave gate 6 (Sonar analysis `897d7ba0-67e1-4e00-b487-ec3565549169`)

## Goal

The new-violations count drops to the gate's limit by fixing the findings
below, while every oracle generator still reproduces its committed corpus
byte for byte.

## Findings (the generators are under `engine/native/diff/tests/oracle/`)

| Rule | Where | Fix |
| --- | --- | --- |
| `S7781` ×5 | `gen-line-sequence.mjs:113` | `replaceAll` with plain string patterns instead of one-character regexes (`.replaceAll('\\', …)`, `';'`, `'|'`, `'\t'`, `'\n'`) |
| `S9382` ×2 | `gen-myers.mjs:48,52` | fetch the files in parallel: `await Promise.all(FILES.map(…))`, then write them in the original order |
| `S1172` | `gen-compute-moved-lines.mjs:85` | remove or use the unused parameter |
| `S7771` | `gen-compute-moved-lines.mjs:105` | follow the rule's suggestion |
| `S1117` | `gen-compute-moved-lines.mjs:112`; `gen-heuristic-sequence-optimizations.mjs:129,141,254,255,256` | rename the variable that shadows an outer one |
| `S3358` | `gen-compute-moved-lines.mjs:213` | replace the nested ternary with an `if`/`else` or a small helper |
| `S7723` ×4 | `gen-heuristic-sequence-optimizations.mjs:382,387` | follow the rule's suggestion |
| `S1516` | `gen-lines_slice_char_sequence.mjs:84` | build the multi-line string another way (an array joined with `\n`) |
| `S3358` | `src/extension/diffTab/diffTabPanel.ts:118` | replace the nested ternary with plain statements |

Leave `charCodeAt` alone everywhere: those findings are marked false
positive (X13).

## Steps

1. Fix each finding as the table says. Look up a rule's exact message with
   the line in front of you; if a suggestion would change behavior, stop
   and report.
2. After each generator change, prove the corpus is unchanged. For a
   generator that prints to stdout:
   `node <gen> | cmp - engine/native/diff/tests/data/<name>.txt`. For one
   that writes its own file (`gen-line-sequence.mjs`,
   `gen-dynamic-programming-diffing.mjs`), run it and check that
   `git status` stays clean.
3. For `diffTabPanel.ts`: strict Biome, typecheck, and
   `pnpm exec vitest run --project webview tests/webview/diffTabPanel.test.ts`.

## Touch

The generators named above, `src/extension/diffTab/diffTabPanel.ts`, and
this slice file's status and report.

## Acceptance

- Every touched generator reproduces its corpus byte for byte (paste each
  check).
- The `diffTabPanel` checks pass; the Rust arm is unaffected (no `.rs`
  change).

## Report

_(not started)_
