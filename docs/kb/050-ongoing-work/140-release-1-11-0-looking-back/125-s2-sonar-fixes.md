---
summary: >-
  S2: the second release-gate SonarQube scan on `main` (`2026-11-23`, after
  S1; gate ERROR with 9 new issues, new-code coverage 90.1 %, no hotspots):
  S2a eight mechanical fixes in the finished Reflog tab code, S2b one
  cognitive-complexity refactor in `src/webview/blameTab/view.ts` after
  F4-05 and F4-06 land.
---

# S2 — SonarQube new-code fixes (second scan)

Status: S2a integrated `5773e36c` · S2b integrated `5fa0147f`

Needs: —

Agent: S2a Claude Haiku; S2b Claude Haiku

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

## The findings for S2b (third scan, `2026-11-23`, main `3fa23e5e`, version 1.10.0)

The second scan's `view.ts:461` complexity finding is gone after F4-05 and
F4-06 reshaped that code. Gate ERROR: `new_software_quality_high_issues`
1 > 0, `new_violations` 6 > 5. OK: new coverage 89.7 %, duplication 0.16 %,
reliability and security 0, no hotspots to review.

| Rule | Where | What |
| --- | --- | --- |
| S1117 | `src/extension/blameTab/blameTabPanel.ts:475` | `opener` shadows line 486 — rename |
| S3776 | `src/extension/blameTab/blameTabPanel.ts:509` | cognitive complexity 19 → ≤ 15: extract helpers, behavior unchanged |
| S1117 | `src/webview/blameTab/view.ts:612` | `btn` shadows line 630 — rename |
| S6582 | `src/webview/blameTab/view.ts:1044` | optional chain |
| S7764 | `src/webview/blameTab/view.ts:1105` | `globalThis` instead of `window` |
| S6582 | `src/webview/blameTab/view.ts:1106` | optional chain |

Line numbers are from `3fa23e5e`; find each by its content if lines moved.

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

## Report (S2b)

- **Agent / date:** Claude Haiku 5.5 (`claude-haiku-5-5`), 2026-11-23 17:49
- **Branch and commits:** `rel-1.11.0/S2b` (base `256b0f96`)
  - `fbe833af` G docs(kb): claim slice S2b, the Blame Sonar fixes (S2b)
  - `c9d8855a` G refactor(blame): rename shadowed rewind button, use optional chains, globalThis (S2b)
  - `caba133a` G refactor(blame): rename the revision opener that shadowed the file opener (S2b)
  - `7d97f723` G refactor(blame): extract the navigator-changed reload from handleMessage (S2b)
  - this report commit (the one that sets `Status: done — awaiting integration`; it is the branch head, see `git log`)
- **Files changed (`git diff --stat 256b0f96..HEAD`, before this report commit):** `src/extension/blameTab/blameTabPanel.ts` 32 lines (+17/−11 net in the diff, plus the rename); `src/webview/blameTab/view.ts` 26 lines (+13/−13); this slice file, status and report only. Total 3 files, 33 insertions, 27 deletions.
- **Tests added or changed:** none. Test counts after the change, `pnpm run test`: extension project 1594 passed, 60 skipped (120 files); webview project 1341 passed (95 files). The skips are the expected linked-worktree backend skips. I did not measure the counts on `256b0f96` alone, so there is no before-count to compare; no test file was touched.
- **Gates:**
  - strict Biome (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`) on `view.ts` exit 0 and on `blameTabPanel.ts` exit 0 (final state).
  - `pnpm run typecheck`: exit 0 (after the view.ts edits and again after the panel edits).
  - `npx vitest run --project webview tests/webview/blameTab tests/webview/blameTabPanel.test.ts`: 10 files, 139 tests pass (run after the view.ts edits and again after the panel edits).
  - `npx vitest run --project backend tests/backend/blameHotspot.test.ts tests/backend/queries/blame.test.ts`: 2 files, 58 tests pass.
  - `pnpm run test`: exit 0 (both projects; counts above).
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - `pnpm run l10n:check`: not run; no user-visible string changed.
  - Visual renders: not applicable; no styling or layout changed.
  - Signatures: `git log --format='%h %G? %s' 256b0f96..HEAD`, all `G` (checked after the four commits above).
  - Sonar: integrator
- **Acceptance:** each table row:
  - S1117 `blameTabPanel.ts` (the `opener` shadowing): met. The revision-branch const is now `revisionOpener`; the file-opener const is unchanged.
  - S3776 `blameTabPanel.ts` `handleMessage`: met by reasoning, not by a tool run. The helpers are `reloadWhenChanged` (setOptions, ignoreCommit, clearIgnoredCommit) and `syncAndReloadWhenChanged` (rewind, navigate). The nested ifs left the switch, so my manual cognitive count is about 9 (switch 1, ready 3, blameHead 2, blameLatest 3), against 19 before. I did not run a complexity tool; Sonar is the integrator's check.
  - S1117 `view.ts` (`btn` shadowing): met. The button built in the rewind branch is `rewindBtn`, and its return value follows it. The boundary button `btn` is unchanged.
  - S6582 `view.ts` ~line 1044 (`contextFor`): met. `lastState === null || lastState.labels === null` became `lastState?.labels == null`. The same return happens when `lastState` is null or its labels are null; `labels` is typed `BlameLabels | null`. Typecheck confirms the narrowing for the next line.
  - S7764 `view.ts` ~line 1105: met. `window.addEventListener` is now `globalThis.addEventListener` for the keydown listener.
  - S6582 `view.ts` ~line 1106: met. `lastState === null || lastState.blameState !== "lines"` became `lastState?.blameState !== "lines"`. A null state gives `undefined !== "lines"`, which is true, so the early return is the same.
- **Deviations from the slice:**
  - Outside the Touch list: none. The edits are in the two Blame files; the slice file has the status and report.
  - The first panel commit (`caba133a`) has a body line that says the strict Biome check ran "after the helper commit". At the time that commit was made, Biome had passed on the full file with both edits, not on the commit's own state. The message is inaccurate on this point. It cannot be amended under the agent rules, so the integrator should know.
  - The `view.ts` change is one commit, not one per finding, because the four small edits share one file and one check. Nothing else is different from the slice.
  - `==` is used once (`lastState?.labels == null`). The strict Biome config passed it. It is the only non-strict equality in the change, so a reviewer may want `=== null || === undefined` instead.
- **Open questions / follow-ups:** none. Sonar re-scan is the integrator's. The new-code count after integration should show S1117, S6582, S7764 and S3776 as gone for these two files.
