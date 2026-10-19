---
summary: >-
  D22F3 · ready · TypeScript + scripts · guide ≤80 lines: clear the eight
  SonarQube findings the final wave gate found (six in 22f's whole-flow
  oracle generator, two unnecessary assertions in 22j's seam). Behavior,
  corpora and tests stay identical; the generator must still reproduce
  its data byte for byte.
---

# D22F3 — Final Sonar follow-up

Status: ready
Needs: 22f, 22j (integrated)
Decisions: X13 (fix the generators' valid findings)
Kind: TypeScript + scripts · Size guide: ~80 changed lines outside tests
Source: the integration log's final wave gate on `2026-10-19` (Sonar analysis `8e0fe631-46ac-44dd-bcca-1e33f76a07c7`)

## Goal

Bring the quality gate back to `OK`: 8 new violations against the limit
5, no high issues. Fix all eight without changing behavior.

## Facts (the final wave gate, `2026-10-19`)

| Rule | File:line | Severity | Finding |
| --- | --- | --- | --- |
| `typescript:S4325` | `src/backend/engine/diffTexts.ts:305` | minor | unnecessary assertion |
| `typescript:S4325` | `src/backend/engine/diffTexts.ts:306` | minor | unnecessary assertion |
| `javascript:S7771` | `engine/native/diff/tests/oracle/gen-default-lines-diff-computer.mjs:109` | minor | prefer negative index in `slice` |
| `javascript:S1117` | `…/gen-default-lines-diff-computer.mjs:116` | major | `block` shadows the declaration on line 135 |
| `javascript:S7780` | `…/gen-default-lines-diff-computer.mjs:202` | minor | `String.raw` for backslash literals (×2) |
| `javascript:S7778` | `…/gen-default-lines-diff-computer.mjs:209` | minor | multiple `push()` calls |
| `javascript:S7778` | `…/gen-default-lines-diff-computer.mjs:216` | minor | multiple `push()` calls |

## Steps

1. `diffTexts.ts`: remove the two unnecessary assertions; the seam's
   types and null-answers stay identical (its 80 tests pin them).
2. The generator: apply the six fixes in the style D22F/D22F2 set for
   the other generators (renames for shadowing, `String.raw`, single
   `push` with several arguments, negative slice index). Then rerun it
   and prove its output is byte-identical to the committed
   `default-lines-diff-computer-oracle.txt` (`cmp`), exactly as every
   generator fix before this one.
3. Change nothing else; no suppressions.

## Touch

`src/backend/engine/diffTexts.ts`,
`engine/native/diff/tests/oracle/gen-default-lines-diff-computer.mjs`;
their test files only if a case is needed

## Acceptance

- Strict Biome clean, typecheck green, `diffTexts` and differential
  suites green, the generator's `cmp` byte-identical (command and
  result in the report).
- The integrator's rescan shows none of the eight findings and the
  gate returns to `OK`.

## Report

_(not started)_
