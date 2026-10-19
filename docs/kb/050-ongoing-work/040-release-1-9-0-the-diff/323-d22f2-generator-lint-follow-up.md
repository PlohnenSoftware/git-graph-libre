---
summary: >-
  D22F2 · ready · oracle scripts and one TS line · ~60 lines (a guide): clear
  wave gate 6's remaining Sonar findings in the Phase 17 oracle generators
  (string patterns for `replaceAll`, shadowing, unused parameter, nested
  ternaries and similar) and D44's nested ternary in `diffTabPanel.ts`,
  without changing any corpus.
---

# D22F2 — Generator lint follow-up

Status: claimed by Claude Haiku D22F2 on 2026-10-19 15:21
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
- **Files changed:** `gen-line-sequence.mjs` +1/−1; `gen-myers.mjs` +11/−6; `gen-compute-moved-lines.mjs` +6/−5; `gen-heuristic-sequence-optimizations.mjs` +13/−13; `diffTabPanel.ts` +6/−2 (5 files, +37/−27 in code). Slice file: claim and report only.
- **Tests added or changed:** none. `tests/webview/diffTabPanel.test.ts`: 16 before, 16 after.
- **Gates:** biome (strict, `diffTabPanel.ts`) clean, exit 0; typecheck clean, exit 0; test backend not run; webview `diffTabPanel.test.ts` 16/16; l10n n/a; kb:check: see final status commit; Rust arm n/a (no `.rs` change); Sonar: integrator. Biome does not process the oracle `.mjs` files (the config's include set excludes them: "No files were processed"), so no biome result exists for them.
- **Byte-for-byte checks (final tree, all exit 0, no output from cmp):**
  - `node engine/native/diff/tests/oracle/gen-myers.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/myers-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-compute-moved-lines.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/compute-moved-lines-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-heuristic-sequence-optimizations.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/heuristic-sequence-optimizations-oracle.txt` → OK
  - `node engine/native/diff/tests/oracle/gen-lines_slice_char_sequence.mjs 2>/dev/null | cmp - engine/native/diff/tests/data/lines-slice-char-sequence-oracle.txt` → OK (script not changed)
  - `node engine/native/diff/tests/oracle/gen-line-sequence.mjs` → "wrote 90 cases"; `git status --short` afterwards shows nothing (the data file is unchanged).
- **Finding by finding:**
  - `S7781` ×5, `gen-line-sequence.mjs:113`: fixed (plain string patterns). Commit `5559b21`.
  - `S9382` ×2, `gen-myers.mjs:48,52`: fixed (`Promise.all` fetch, written in original order). Commit `241323f`.
  - `S1172`, `gen-compute-moved-lines.mjs:85`: fixed (dropped the unused second parameter of the template). Commit `60ffab7`.
  - `S7771`, `gen-compute-moved-lines.mjs:105`: fixed (`slice(0, -2)` in place of `slice(0, line.length - 2)`, same result for the guarded branch). The exact Sonar message is not in the repo, so this follows the slice's "follow the suggestion" with the semantics checked by hand. Commit `ee7939b`.
  - `S1117`, `gen-compute-moved-lines.mjs:112`: fixed (`block` local renamed `moved`). Commit `624249a`.
  - `S1117`, `gen-heuristic-sequence-optimizations.mjs:129,141`: fixed (local `out` renamed `edited`). Commit `71a2f06`.
  - `S1117`, `gen-heuristic-sequence-optimizations.mjs:254,255,256`: fixed (callback parameter `d` renamed `seqDiffs`). Commit `a0fbf62`.
  - `S3358`, `gen-compute-moved-lines.mjs:213`: fixed (the suffix choice moved to a helper `everySeventhSuffix`; the random draw order is unchanged). Commit `81eb221`.
  - `S7723` ×4, `gen-heuristic-sequence-optimizations.mjs:382,387`: NOT fixed. The rule's message isn't in the repo and I can't verify the suggested form offline, so I did not guess (protocol section 8). Lines are `Array(rand(5)).fill(l)` (382, twice), `Array(rand(3)).fill(l)` (382) and `Array(k).fill(l)` (387).
  - `S1516`, `gen-lines_slice_char_sequence.mjs:84`: NOT fixed. Facts mismatch: line 84 is a single-line array literal of raw invisible characters (U+00A0, U+3000, U+FEFF, U+200B, typed as raw characters; U+0085 and `\r` are escapes), not a multi-line string. The only multi-line string is at line 52, which is a different construct. The slice's fix (an array joined with `\n`) does not apply. Escaping those characters would be output-neutral, but it would be a fix the slice does not describe, so I stopped.
  - `S3358`, `src/extension/diffTab/diffTabPanel.ts:118`: fixed (plain if/else, same three branches). Commit `98adccc`.
  - `charCodeAt`: untouched, per X13.
- **Deviations from the slice:** S7723 and S1516 not fixed (see above). The slice's Touch list was respected; no other file changed.
- **Open questions / follow-ups:** (1) S7723 needs its exact Sonar message, or the maintainer's choice of the suggested form. (2) S1516 finding does not match line 84; the maintainer should confirm which construct Sonar flagged (the file's line numbers may have moved since the analysis `897d7ba0`). (3) The `S7771` message should be confirmed against the Sonar analysis, since I could not read it offline.
