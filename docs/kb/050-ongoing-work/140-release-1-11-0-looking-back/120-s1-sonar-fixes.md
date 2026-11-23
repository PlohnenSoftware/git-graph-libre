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

Status: S1a claimed by Claude Haiku 5.5 on 2026-11-23 12:52 · S1b ready · S1c waiting (F1-06, F1-07)

Needs: —

Agent: S1a Claude Haiku; S1b Gemini 4 Argon (`agy`); S1c later

Read first: `AGENTS.md`; Multi-agent releases (Rules); the release section;
Current Architecture (Reference), its SonarQube bullets (the `Zam` profile,
`zam_suppression_comments`); `biome.strict.jsonc`.

## The findings (early scan, analysis `2026-11-23T11:46:34Z`, version 1.10.0)

Gate ERROR: `new_software_quality_high_issues` 3 > 0, `new_violations` 15 > 5,
`software_quality_reliability_issues` 1 > 0.

| Rule | Where | What | Part |
| --- | --- | --- | --- |
| S3512 | `src/webview/worktreeList.ts:276` | string concatenation → template literal | S1a |
| S1117 ×3 | `src/webview/reflogTab/view.ts:46,63,87` | `option` shadows the outer `option` (line 107) — rename | S1a |
| S1117 | `src/extension/reflogTab/reflogData.ts:267` | `shown` shadows line 277 — rename | S1a |
| S1117 | `src/extension/messageHandler.ts:615` | `repo` shadows line 601 — rename | S1a |
| S7758 | `src/reflogTabTypes.ts:169` | `charCodeAt` → `codePointAt` (reliability) | S1a |
| S6582 | `src/backend/queries/blame.ts:246` | optional chain | S1a |
| S4325 | `src/backend/queries/blame.ts:259` | needless type assertion | S1a |
| S3358 | `src/webview/reflogTab/rowModel.ts:145` | nested ternary → statement | S1a |
| zam_suppression_comments | `src/backend/engine/reflog.ts:101`, `src/backend/queries/reflog.ts:37` | a `biome-ignore noControlCharactersInRegex` on a control-character regex: replace the regex with a code-point check (as `hasControlCharacter` in `blame.ts` does) and drop the comment | S1a |
| S3776 | `src/backend/queries/blame.ts:283` (`parseBlamePorcelain`, 32) and `:565` (`loadBlame`, 21) | cognitive complexity → ≤ 15 by extracting cohesive helpers; behavior and tests unchanged | S1b |
| S3776 | `src/webview/reflogTab/view.ts:390` (35) | same, after F1-06/F1-07 land (they edit this file) | S1c |

## Touch

The files in the table, their existing tests (behavior unchanged; add a test
only where a replaced regex needs pinning), this file's Status and Report.

## Report

Not started.
