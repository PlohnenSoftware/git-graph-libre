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

Status: S1a done — awaiting integration · S1b done — awaiting integration · S1c waiting (F1-06, F1-07)

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

## Report (S1a)

- **Agent / date:** Claude Haiku 5.5 (claude-haiku-5-5), 2026-11-23 12:52 (claim) to 2026-11-23 (report)
- **Branch and commits:** `rel-1.11.0/S1a`:
  - `a0fe344d` G fix(sonar): build the worktree row with one template literal (S3512)
  - `d2200992` G refactor(reflog): rename identifiers that shadowed outer names (S1117)
  - `50c46ab6` G fix(sonar): read the code point with codePointAt in hasControlCharacter (S7758)
  - `9ad55373` G fix(sonar): replace the nested ternary in applyData with plain statements (S3358)
  - `1d9f5254` G fix(sonar): use an optional chain and drop a needless assertion in groupHunks (S6582, S4325)
  - `2ff6fc3e` G refactor(reflog): add hasControlCharacter beside the string helpers (zam_suppression_comments)
  - `fc218f8b` G fix(sonar): replace the control-character regexes and drop their suppressions (zam_suppression_comments)
  - `863c12cc` G docs(kb): claim slice S1a (S1a)
  - this commit: the S1a status line and this report
- **Files changed:** `src/backend/engine/reflog.ts` +2/−4; `src/backend/queries/blame.ts` +2/−3; `src/backend/queries/reflog.ts` +2/−3; `src/backend/utils/string.ts` +9; `src/extension/messageHandler.ts` +1/−1; `src/extension/reflogTab/reflogData.ts` +3/−3; `src/reflogTabTypes.ts` +1/−1; `src/webview/reflogTab/rowModel.ts` +6/−8; `src/webview/reflogTab/view.ts` +12/−12 (one line reflowed by the formatter); `src/webview/worktreeList.ts` +1/−13; `tests/backend/utils/string.test.ts` +13/−3 (import order from Biome, one test added). Total 52 insertions, 49 deletions across the code commits.
- **Tests added or changed:** one test added, `finds C0 control characters and DEL, and nothing else` in `tests/backend/utils/string.test.ts` (pins the helper that replaces the two regexes). Count in that file: 3 before, 4 after. No existing test changed. Full suite after: backend 1580 passed, 60 skipped; webview 1210 passed. Before counts were not recorded.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 11 touched files: pass, no errors (the CLI printed a schema-version notice, 2.5.13 config vs 2.6.8 CLI; it did not affect the result).
  - `pnpm run typecheck`: pass (exit 0).
  - `npx vitest run --project backend tests/backend/queries/reflog.test.ts tests/backend/queries/blame.test.ts tests/backend/engine`: 22 files, 559 passed.
  - `npx vitest run --project webview tests/webview/reflogTab tests/webview/worktreeList.test.ts tests/webview/messageHandler.test.ts tests/webview/reflogTabPanel.test.ts`: 10 files, 180 passed.
  - `pnpm run test`: exit 0; backend 118 files, 1580 passed, 60 skipped (the expected linked-worktree skips); webview 92 files, 1210 passed.
  - `node ./docs/kb/housekeeping.mjs --check`: exit 0.
  - Sonar: integrator
- **Acceptance:**
  - S3512 `worktreeList.ts:276`: met. Concatenation replaced by one template literal; the same pieces in the same order; worktree list tests pass.
  - S1117 `view.ts:46,63,87`: met. Parameter renamed to `refOption` in `selectedOption`, `headerRefText` and `refLabel`, with every use in those scopes updated. Module-level `option` untouched.
  - S1117 `reflogData.ts:267`: met. Inner `shown` renamed to `onlyReflogShown` (three uses).
  - S1117 `messageHandler.ts:615`: met. Inner `repo` renamed to `repoPath`. The identical line at `:590` is in another scope and was not flagged, so it is unchanged.
  - S7758 `reflogTabTypes.ts:169`: met. `codePointAt(0) ?? 0`. The loop already iterates code points, and the below-0x20 / 0x7f check gives the same result for astral characters (neither matches).
  - S6582 `blame.ts:246`: met. `last?.commitHash === blamed.commitHash`; TypeScript still narrows `last` for the later fields (typecheck passes).
  - S4325 `blame.ts:259`: met. `as BlamedLine` removed; typecheck passes.
  - S3358 `rowModel.ts:145`: met. Nested ternary replaced by a `nextRows` variable set in two plain `if` statements; the three branches are unchanged.
  - zam_suppression_comments `engine/reflog.ts` (~101) and `queries/reflog.ts` (~37): met. Both regexes and their biome-ignore comments removed; both call `hasControlCharacter` from `src/backend/utils/string.ts`. No suppression comment added.
  - Not touched, per the slice: `parseBlamePorcelain`, `loadBlame`, `view.ts` `~390`.
- **Deviations from the slice:**
  - The claim was committed after the fixes instead of before them (`863c12cc`), against the protocol's claim-first order. It is recorded in that commit's body.
  - `hasControlCharacter` also remains as a private copy in `src/backend/queries/blame.ts`. I left it there to avoid a textual conflict with S1b, which refactors that file. The new helper in `string.ts` is therefore a second copy until the two are merged after S1b lands.
  - `src/reflogTabTypes.ts` (webview side) keeps its own `hasControlCharacter`, since the backend utility is not imported into the webview bundle.
- **Open questions / follow-ups:**
  - Once S1b is integrated, the blame.ts copy of `hasControlCharacter` could import the `string.ts` helper; that is a separate small follow-up, not done here.
  - The Sonar scan is not run by this agent (`Sonar: integrator`).
## Report (S1b)
- **Agent / date:** Gemini 4 Argon (`agy`), 2026-11-23 12:55
- **Branch and commits:** `rel-1.11.0/S1b`
  - `f3419ccb G docs(kb): claim slice S1b (S1b)`
  - `aab76ea9 G refactor(blame): reduce cognitive complexity of parseBlamePorcelain and loadBlame (S1b)`
- **Files changed:**
  - `src/backend/queries/blame.ts` (+158/−93)
  - `docs/kb/050-ongoing-work/140-release-1-11-0-looking-back/120-s1-sonar-fixes.md` (+26/−2)
- **Tests added or changed:** None (behavior-preserving refactor; `tests/backend/queries/blame.test.ts` unchanged at 41/41 passing; full suite 1,579 backend passed + 60 skipped in linked worktree, 1,210 webview passed before and after)
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings src/backend/queries/blame.ts`: clean (0 errors, 0 warnings)
  - `pnpm run typecheck`: clean
  - `npx vitest run --project backend tests/backend/queries/blame.test.ts`: 1 file, 41 passed
  - `pnpm run test`: backend 118 files, 1,579 passed (60 skipped in worktree); webview 92 files, 1,210 passed
  - `node ./docs/kb/housekeeping.mjs --check`: clean
  - `parseBlamePorcelain` cognitive complexity ≤ 15 (Sonar S3776): met — estimated cognitive complexity reduced from **32** to **7** by extracting `stripTrailingCr` (complexity 1), `finishPendingLine` (complexity 2), `applyMetadataLine` (complexity 6), and `parseRecordLine` (complexity 3).
  - `loadBlame` cognitive complexity ≤ 15 (Sonar S3776): met — estimated cognitive complexity reduced from **21** to **8** by extracting `prepareBlameRequest` (complexity 6), `resolveBlameTarget` (complexity 4), `runBlamePrecheck` (complexity 2), and `executeBlameCommand` (complexity 1).
  - Behavior and existing tests unchanged, S1a lines in `groupHunks` (`src/backend/queries/blame.ts:246,259`) untouched: met — `tests/backend/queries/blame.test.ts` passes 41/41 without modification and `groupHunks` was not touched.
- **Deviations from the slice:** none
- **Open questions / follow-ups:** none
