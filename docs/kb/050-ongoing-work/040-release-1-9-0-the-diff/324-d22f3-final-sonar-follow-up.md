---
summary: >-
  D22F3 · ready · TypeScript + scripts · guide ≤80 lines: clear the eight
  SonarQube findings the final wave gate found (six in 22f's whole-flow
  oracle generator, two unnecessary assertions in 22j's seam). Behavior,
  corpora and tests stay identical; the generator must still reproduce
  its data byte for byte.
---

# D22F3 — Final Sonar follow-up

Status: done — awaiting integration
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

- **Agent / date:** Muse Code (general-purpose, inherited runtime model; no named-model selector — easy-tier slice, for the integrator to record), 2026-10-19 18:15 Europe/Warsaw (claimed 18:12)
- **Branch and commits:** `diff-1.9.0/d22f3` (base `55b7e16`)
  - `2a93d6e G docs(release): claim D22F3 final Sonar follow-up (D22F3)`
  - `aef1bc8 G fix(engine): drop unnecessary assertions in diffTexts payload parse (D22F3)`
  - `999effa G fix(engine): slice with a negative end in gen-default-lines-diff-computer (D22F3)`
  - `36eb9f1 G fix(engine): rename shadowing block local in gen-default-lines-diff-computer (D22F3)`
  - `684fe76 G fix(engine): String.raw backslash literals in gen-default-lines-diff-computer (D22F3)`
  - `dbc0f57 G fix(engine): single push in gen-default-lines-diff-computer run loop (D22F3)`
  - `d32e8e9 G fix(engine): single push in gen-default-lines-diff-computer affix loop (D22F3)`
  - this report commit and the final status commit follow (the report commit first, then `Status: done`).
- **Files changed (`git diff --numstat 55b7e16 HEAD`, before this report):** `src/backend/engine/diffTexts.ts` +2/−2; `engine/native/diff/tests/oracle/gen-default-lines-diff-computer.mjs` +12/−8. Two code files, +14/−10 lines. Slice file: claim, report and status only. No suppressions, nothing else touched.
- **Tests added or changed:** none. `tests/backend/engine/diffTexts.test.ts`: 80 before, 80 after; `tests/backend/vscodeDiffDifferential.test.ts`: 61 before, 61 after.
- **Gates:** biome (strict, `diffTexts.ts`) clean, exit 0 (Biome processes no oracle `.mjs` files — "No files were processed", as D22F2 recorded); typecheck clean, exit 0; test backend `diffTexts.test.ts` 80/80 and `vscodeDiffDifferential.test.ts` 61/61 (141 passed, 0 skipped, after `pnpm run engine:build` and `PATH="$HOME/.cargo/bin:$PATH" pnpm run diff:wasm`, both exit 0, so the native and wasm arms both ran); webview not run (no webview file touched); l10n n/a; kb:check exit 0; Rust arm n/a (no `.rs` change; the engine and wasm builds above compiled the Rust); Sonar: integrator.
- **Byte-for-byte check (final tree):** `node engine/native/diff/tests/oracle/gen-default-lines-diff-computer.mjs 2>/tmp/d22f3-gen.stderr | cmp - engine/native/diff/tests/data/default-lines-diff-computer-oracle.txt` → `cmp` exit 0, no output; the generator's stderr said `648 cases, 1 THROW`; `git status` clean afterwards. The same check on the untouched base also gave `cmp` exit 0, so the corpus bytes did not move.
- **Finding by finding:**
  - `S4325` ×2, `src/backend/engine/diffTexts.ts:305,306`: fixed (assertions removed; the `every()` type guards above already narrow `changes`/`moves`). Commit `aef1bc8`.
  - `S7771`, `gen-default-lines-diff-computer.mjs:109`: fixed (`slice(0, -2)` for `slice(0, line.length - 2)`; the `length > 3` guard keeps the result identical). Commit `999effa`.
  - `S1117`, `gen-default-lines-diff-computer.mjs:116`: fixed (`moveBlock`'s local `block`, which shadowed the outer `block()` helper on line 134, renamed `moved`, as D22F2 did). Commit `36eb9f1`.
  - `S7780` ×2, `gen-default-lines-diff-computer.mjs:202`: fixed (`String.raw` for the two backslash literals; same string values). Commit `684fe76`.
  - `S7778`, `gen-default-lines-diff-computer.mjs:209`: fixed (one `push` with both arguments; arguments evaluate in the same left-to-right order). Commit `dbc0f57`.
  - `S7778`, `gen-default-lines-diff-computer.mjs:216`: fixed (one `push` with both arguments, same order). Commit `d32e8e9`.
- **Acceptance:** strict Biome clean — met; typecheck green — met; `diffTexts` and differential suites green — met (141/141, 0 skipped); the generator's `cmp` byte-identical with command and result — met (above); the integrator's rescan showing none of the eight findings and the gate back to `OK` — the integrator's to confirm.
- **Deviations from the slice:** none.
- **Open questions / follow-ups:** none. Sonar's own re-analysis is the integrator's to confirm.
