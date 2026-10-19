---
summary: >-
  D22F2 · done · oracle scripts and one TS line · ~60 lines (a guide): clear
  wave gate 6's remaining Sonar findings in the Phase 17 oracle generators
  (string patterns for `replaceAll`, shadowing, unused parameter, nested
  ternaries and similar) and D44's nested ternary in `diffTabPanel.ts`,
  without changing any corpus.
---

# D22F2 — Generator lint follow-up

Status: done — awaiting integration
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

- **Agent / date:** Claude Haiku D22F2, 2026-10-19 15:21 (claim); work and report 2026-10-19 (after 15:21)
- **Branch and commits:** `diff-1.9.0/d22f2` (base `b11efe0`)
  - `3f6631f G docs(release): claim D22F2 generator lint follow-up (D22F2)`
  - `5559b21 G fix(engine): string patterns in gen-line-sequence replaceAll (D22F2)`
  - `241323f G fix(engine): fetch myers oracle sources in parallel (D22F2)`
  - `60ffab7 G fix(engine): drop unused template parameter in gen-compute-moved-lines (D22F2)`
  - `ee7939b G fix(engine): slice with a negative end in gen-compute-moved-lines (D22F2)`
  - `71a2f06 G fix(engine): rename shadowing locals in gen-heuristic-sequence-optimizations (D22F2)`
  - `a0fbf62 G fix(engine): rename shadowing callback parameters in heuristic ops list (D22F2)`
  - `624249a G fix(engine): rename shadowing block local in gen-compute-moved-lines (D22F2)`
  - `81eb221 G fix(engine): move nested ternary into a helper in gen-compute-moved-lines (D22F2)`
  - `98adccc G refactor(diffTab): plain if/else for the line height in diffTabPanel (D22F2)`
  - `7f764cf G fix(engine): new Array in gen-heuristic-sequence-optimizations fill calls (D22F2)`
  - `711b8ee G fix(engine): escape raw U+2028 in gen-lines_slice_char_sequence literal (D22F2)`
  - this report commit and the final status commit follow (the report commit first, then `Status: done`).
- **Files changed (`git diff --numstat b11efe0 HEAD`):** `gen-line-sequence.mjs` +1/−1; `gen-myers.mjs` +11/−6; `gen-compute-moved-lines.mjs` +6/−5; `gen-heuristic-sequence-optimizations.mjs` +15/−15; `gen-lines_slice_char_sequence.mjs` +1/−1; `diffTabPanel.ts` +6/−2. Six code files, +40/−30 lines. Slice file: claim, report and status only.
- **Tests added or changed:** none. `tests/webview/diffTabPanel.test.ts`: 16 before, 16 after.
- **Gates:** biome (strict, `diffTabPanel.ts`) clean, exit 0; typecheck clean, exit 0; test backend not run (no backend file touched); webview `diffTabPanel.test.ts` 16/16; l10n n/a; kb:check exit 0 (run after `kb:index`); Rust arm n/a (no `.rs` change); Sonar: integrator. Biome does not process the oracle `.mjs` files (its config's include set excludes them: "No files were processed"), so no biome result exists for them.
- **Byte-for-byte checks (final tree, each `cmp` exit 0, no output):**
  - `node engine/native/diff/tests/oracle/gen-myers.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/myers-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-compute-moved-lines.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/compute-moved-lines-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-heuristic-sequence-optimizations.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/heuristic-sequence-optimizations-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-lines_slice_char_sequence.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/lines-slice-char-sequence-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-line-sequence.mjs` → "wrote 90 cases"; `git status --short` afterwards shows nothing, so the data file is unchanged.
- **Finding by finding:**
  - `S7781` ×5, `gen-line-sequence.mjs:113`: fixed (plain string patterns). Commit `5559b21`.
  - `S9382` ×2, `gen-myers.mjs:48,52`: fixed (`Promise.all` fetch, written in original order). Commit `241323f`.
  - `S1172`, `gen-compute-moved-lines.mjs:85`: fixed (dropped the unused second template parameter). Commit `60ffab7`.
  - `S7771`, `gen-compute-moved-lines.mjs:105`: fixed (`slice(0, -2)` for `slice(0, line.length - 2)`; the coordinator confirmed the message "Prefer negative index over length minus index for `slice`."). Commit `ee7939b`.
  - `S1117`, `gen-compute-moved-lines.mjs:112`: fixed (`block` local renamed `moved`). Commit `624249a`.
  - `S1117`, `gen-heuristic-sequence-optimizations.mjs:129,141`: fixed (local `out` renamed `edited`). Commit `71a2f06`.
  - `S1117`, `gen-heuristic-sequence-optimizations.mjs:254,255,256`: fixed (callback parameter `d` renamed `seqDiffs`). Commit `a0fbf62`.
  - `S3358`, `gen-compute-moved-lines.mjs:213`: fixed (suffix choice moved to helper `everySeventhSuffix`; random draw order unchanged). Commit `81eb221`.
  - `S7723` ×4, `gen-heuristic-sequence-optimizations.mjs:382,387`: fixed (`Array(n)` → `new Array(n)` at the four fill calls; message "Use `new Array()` instead of `Array()`." from the coordinator). Commit `7f764cf`.
  - `S1516`, `gen-lines_slice_char_sequence.mjs:84`: fixed (the one raw U+2028 inside the `' '` literal replaced with the escape `\u2028`; same string value; no U+2029 on that line; no other character changed; the diff is one line). Commit `711b8ee`. The coordinator's message: "Multiline support is limited to browsers supporting ES5 only."
  - `S3358`, `src/extension/diffTab/diffTabPanel.ts:118`: fixed (plain if/else, same three branches). Commit `98adccc`.
  - `charCodeAt`: untouched, per X13.
- **Deviations from the slice:** none. The earlier blocked status (S7723 message unknown, S1516 line mismatch) is resolved by the coordinator's exact messages; the S1516 fix is the escape the coordinator specified.
- **Open questions / follow-ups:** none. Sonar's own re-analysis is the integrator's to confirm.
