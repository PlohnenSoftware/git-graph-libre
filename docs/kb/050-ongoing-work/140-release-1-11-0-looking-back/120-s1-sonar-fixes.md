---
summary: >-
  S1: fix the SonarQube new-code findings of the early release-gate scan on
  `main` (`2026-11-23`, 15 issues, gate ERROR): S1a the twelve mechanical
  ones (shadowing, `codePointAt`, optional chain, needless assertion, nested
  ternary, concatenation, two suppression comments replaced by code), S1b
  the two cognitive-complexity refactors in `src/backend/queries/blame.ts`,
  S1c the one in `src/webview/reflogTab/view.ts` after F1-06 and F1-07.
---

# S1 — SonarQube new-code fixes (early scan)

Status: S1a integrated `e342ce2c` · S1b integrated `0cfaa6c5` · S1c done — awaiting integration

## Report (S1c)

- **Agent / date:** Haiku 5.5 (`claude-haiku-5-5`), 2026-11-23 13:36. The claim was made by Gemini 4 Neon (agy) at 13:27; its cut-off edit to `view.ts` was discarded and the file redone from `HEAD`.
- **Branch and commits:** `rel-1.11.0/S1c`
  - `2047fbde` G refactor(reflog): split the render and table functions below Sonar's complexity limit (S1c)
  - `bc3fc2ce` G refactor(blame): use the shared hasControlCharacter in place of the private copy (S1c)
  - the commit that records this report and the status follows these two.
- **Files changed:** `src/webview/reflogTab/view.ts` (+237/−147 after Biome formatting), `src/backend/queries/blame.ts` (+1/−8). Both from `git diff --stat fab98762 HEAD`: 238 insertions, 155 deletions in total.
- **Tests added or changed:** none. Reflog webview suite 133 before and after; blame and string suites 45 passing (41 blame tests at the claim, plus the string tests).
- **Gates:**
  - `npx vitest run --project webview tests/webview/reflogTab tests/webview/reflogTabPanel.test.ts`: 8 files, 133 passed
  - `pnpm run typecheck`: exit 0
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on view.ts and blame.ts: exit 0
  - `npx vitest run --project backend tests/backend/queries/blame.test.ts tests/backend/utils/string.test.ts`: 2 files, 45 passed
  - `pnpm run test`: exit 0. Backend 119 files, 1592 passed, 60 skipped (the linked-worktree skips). Webview 94 files, 1297 passed.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0
  - Sonar: integrator
- **Complexity (Sonar way, nesting counted by hand, not by the scanner):** `render` 35 -> 4, `table` 20 -> 1. The new helpers: `attachColumnResizing` 12 (nested handlers counted into it), `focusSnapshot` 5, `restoreFocus` 5, `bodyBlocks` 4, `dragHandleColumn` 3, `rowsBlocks` 2, `columnHeaderCell` 2, `carryUnsentSearch` 2, `searchCapNotes` 2. Unchanged: `refLabel` 10, `controls` 8. The method reproduced the original `render` at 35, so the numbers are comparable.
- **Acceptance:** every function in `view.ts` is at most 15 by this count: met (estimate, to be confirmed by the integrator's Sonar scan). Behavior identical: met (all reflog tests pass without any assertion edited).
- **Deviations from the slice:** the cut-off edit was restored with `git restore` as the slice allowed and redone. The file was also run through `biome format --write`, which only reflowed lines. Temporary files: one backup written to the worktree's parent directory was deleted at once; test logs went to `/tmp/claude-1000/`.
- **Open questions / follow-ups:**
  - The installed Biome (2.6.8) warns that the strict config's `$schema` names 2.5.13. The check still exits 0 and lint is active, but the schema version should be aligned.
  - The `refactor(blame)` commit body names its rule as Sonar new-code duplication. No Sonar scan ran in this slice, so that label is a generalization, not a reported finding.
