---
summary: >-
  S2: the second release-gate SonarQube scan on `main` (`2026-11-23`, after
  S1; gate ERROR with 9 new issues, new-code coverage 90.1 %, no hotspots):
  S2a eight mechanical fixes in the finished Reflog tab code, S2b one
  cognitive-complexity refactor in `src/webview/blameTab/view.ts` after
  F4-05 and F4-06 land.
---

# S2 — SonarQube new-code fixes (second scan)

Status: S2a claimed by Claude Haiku on 2026-11-23 13:39 · S2b waiting (F4-05, F4-06)

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

## Report

Not started.
