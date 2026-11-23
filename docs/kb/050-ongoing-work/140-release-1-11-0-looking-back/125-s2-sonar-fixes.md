---
summary: >-
  S2: the second release-gate SonarQube scan on `main` (`2026-11-23`, after
  S1; gate ERROR with 9 new issues, new-code coverage 90.1 %, no hotspots):
  S2a eight mechanical fixes in the finished Reflog tab code, S2b one
  cognitive-complexity refactor in `src/webview/blameTab/view.ts` after
  F4-05 and F4-06 land.
---

# S2 — SonarQube new-code fixes (second scan)

Status: S2a done — awaiting integration · S2b waiting (F4-05, F4-06)

Needs: —

Agent: S2a Claude Haiku; S2b later

## The findings (analysis `2026-11-23T12:38:17Z`, version 1.10.0)

Gate ERROR: `new_software_quality_high_issues` 1 > 0, `new_violations` 9 > 5,
`software_quality_reliability_issues` 1 > 0. OK: new coverage 90.1 %,
duplication 0.18 %, no security issues, no hotspots to review.

| Rule | Where | What | Part |
| --- | --- | --- | --- |
| S3358 | `src/extension/reflogTab/reflogTabPanel.ts:378` | nested ternary → statement | S2a |
| S1117 | `src/webview/reflogTab/dialogs.ts:225` | `input` shadows line 238 — rename | S2a |
| S3512 | `src/webview/reflogTab/dialogs.ts:255` | concatenation → template literal | S2a |
| S1117 | `src/webview/reflogTab/dialogs.ts:271,272` | `nameInput`, `typeSelect` shadow lines 290, 292 — rename | S2a |
| S3512 | `src/webview/reflogTab/dialogs.ts:405` | concatenation → template literal | S2a |
| S6582 | `src/extension/reflogTab/lostCommitsController.ts:149` | optional chain | S2a |
| S7758 | `src/extension/reflogTab/reflogData.ts:53` | `charCodeAt` → `codePointAt` (reliability); or reuse `hasControlCharacter` from `src/backend/utils/string.ts` if that is what it checks | S2a |
| S3776 | `src/webview/blameTab/view.ts:461` (21) | cognitive complexity → ≤ 15, after F4-05/F4-06 | S2b |

## Touch

The files in the table and their existing tests (behavior unchanged); this
file's Status and Report.

## Report (S2a)

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-23 13:39
- **Branch and commits:** `rel-1.11.0/S2a`
  - `53dffb93` G docs(kb): claim S2a, the Reflog Sonar fixes (S2)
  - `47159c97` G refactor(reflog): read includeReflog with plain statements, not a nested ternary (S2a)
  - `c6ce9377` G refactor(reflog): use optional chaining in the recovery-source guard (S2a)
  - `324c7770` G fix(reflog): read the branch-name character by code point, not UTF-16 unit (S2a)
  - `6f55ade9` G refactor(reflog): rename dialog-callback inputs that shadowed outer names (S2a)
  - `25db3317` G refactor(reflog): build the add-tag and reset dialog markup as template literals (S2a)
- **Files changed (`git diff --stat 3b5d7e82..HEAD`):** `reflogTabPanel.ts` 10 lines (+8/−2 in the diff, ternary to if/else); `lostCommitsController.ts` 2 lines (1/1); `reflogData.ts` 2 lines (1/1); `webview/reflogTab/dialogs.ts` 32 lines (mostly deletions, two concatenations joined into template literals, three renamed names); this slice file, status and report only. Total 5 files, 19 insertions, 29 deletions.
- **Tests added or changed:** none. Test count unchanged: full `pnpm run test` shows 1592 passed, 60 skipped (extension project, 119 files) and 1297 passed (webview project, 94 files).
- **Gates:**
  - strict Biome (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`) on the four touched source files: clean, no fixes applied.
  - `pnpm run typecheck`: exit 0.
  - `npx vitest run --project webview tests/webview/reflogTab tests/webview/reflogTabPanel.test.ts`: 8 files, 133 tests pass.
  - `pnpm run test`: exit 0 (both projects; skips are the expected linked-worktree backend skips).
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Sonar: integrator
- **Acceptance:** each table row fixed:
  - S3358 `reflogTabPanel.ts` readDisplay: met. Nested ternary replaced by `let` and if/else; the override still wins, and `config.includeReflog()` is still read only when no override is set.
  - S1117 `dialogs.ts`: met. Inner `input` (create-branch callback) renamed `branchNameInput`; inner `nameInput` and `typeSelect` (add-tag callback) renamed `tagNameInput` and `tagTypeSelect`; all uses in those callbacks updated; outer declarations untouched.
  - S3512 `dialogs.ts` (lines ~255 and ~405): met. Both `+` concatenations are single template literals with the same pieces in the same order.
  - S6582 `lostCommitsController.ts:149`: met. `last === null || last.repo !== repo` became `last?.repo !== repo`. Equivalent because `repo` is a non-empty string at that point (the `repo === ""` case already returned).
  - S7758 `reflogData.ts:53`: met with a deviation (see below). `charCodeAt(0)` replaced by `codePointAt(0) ?? 0`.
- **Deviations from the slice:**
  - S7758: the check in `isValidRecoveryBranchName` rejects space (0x20), C0 controls and DEL, while `hasControlCharacter` rejects only controls and DEL. It is not a plain control-character check, so swapping in `hasControlCharacter` would change behavior (spaces would be accepted). The slice's fallback (`codePointAt(0) ?? 0`) was used. For astral characters the old call returned a high surrogate and the new one the full code point; both are above 0x20 and not 0x7F, so results are the same.
  - Commit `25db3317`'s body names `openAddTagDialog` and `openResetDialog`. The real functions are `openCreateTagDialog` (line ~242) and `openResetBranchDialog` (line ~380). The code change is correct; only that message is inaccurate, and it cannot be amended under the agent rules.
- **Open questions / follow-ups:** none for S2a. S2b (`blameTab/view.ts`, S3776) is untouched and still waits for F4-05 and F4-06.
