---
summary: >-
  D21 · wave C · needs D20 · TS tests · ≤250 lines: Phase 17 slice 17.1.
  Vendor VS Code's 58 diff fixtures and add a Vitest suite running
  `@vscode/diff`'s TypeScript and WebAssembly backends against them. It
  records every difference, including the still-unverified claim that the
  two backends agree.
---

# D21 — Phase 17 oracle suite

Status: waiting on D20
Needs: D20
Decisions: —
Kind: TypeScript tests and vendored fixtures · Size budget: ≤ 250 changed lines, not counting the fixtures
Source: Phase 17, "Test strategy" and slice 17.1

## Steps

1. Copy `src/vs/editor/test/node/diffing/fixtures/` from `microsoft/vscode`
   at the commit recorded in D20 into `tests/fixtures/vscode-diff/`. Add a
   README there naming the source path, the commit and the MIT license, as
   in D20's notices.
2. Create `tests/backend/vscodeDiffOracles.test.ts`.
   - For each fixture, run both package backends with
     `computeMoves: false` and `ignoreTrimWhitespace` true when the folder
     name contains `trimws`.
   - Convert each result to VS Code's fixture format (`[2,3)` line ranges,
     `[2,1 -> 2,5]` character ranges), and compare it with
     `advanced.expected.diff.json`, ignoring moves.
3. Known differences go in a documented allowlist in the test file, never
   by loosening the comparison: moves always; anything else found must be
   listed in the report.

## Touch

`tests/fixtures/vscode-diff/**` (new), `tests/backend/vscodeDiffOracles.test.ts` (new)

## Acceptance

- Gates pass.
- The report gives the number of fixtures where TypeScript = WebAssembly =
  expected, with each exception named.

## Report

_(not started)_
