---
summary: >-
  D41F · approved 2026-10-19 · ready: preserve row-model behavior while
  fixing two Sonar complexity findings and the last-element access.
---

# D41F — Row-model Sonar follow-up

Status: integrated 060a00b
Needs: D41 (integrated)
Decisions: separate follow-up approved by the maintainer 2026-10-19
Kind: TypeScript · Size budget: ≤100 changed lines outside tests

## Read first

Agent protocol, D41 brief/report, src/webview/diffTab/rowModel.ts and
its tests, and the integration log's 2026-10-19 wave findings.

## Steps and Touch

Refactor segmentsForLine (complexity 18) and pushUnchangedRun (20) into
cohesive helpers in the same module, meeting the existing limit 16. Use
.at() for last-element access, preserving definedness. Preserve every
public type, UTF-16/highlight/collapse behavior, row identity and WeakMap
contract. No suppressions, weakened tests or quality-rule changes.

Touch: `src/webview/diffTab/rowModel.ts`,
`tests/webview/diffTab/rowModel.test.ts`, this Status/Report, and a
follow-up entry in D41's Report.

## Acceptance

All 27 existing row-model tests pass unchanged. Add a behavioral case only
for an uncovered risk. Protocol gates pass; integrator fresh coverage and
Sonar run at integration, with all three D41 findings closed. Report
unrelated findings accurately.

## Report

- **Agent / date:** Claude Code (Opus 5.5) sub-agent D41F, 2026-10-19 02:25
- **Branch and commits:** `diff-1.9.0/d41f` — `2433ebe G refactor(diff-tab): split the row model's segment and collapse helpers (D41F)`; this report and D41's follow-up line in a second signed docs commit on the same branch
- **Files changed:** `src/webview/diffTab/rowModel.ts` (+49 −29, 78 changed lines, within the ≤100 budget), `tests/webview/diffTab/rowModel.test.ts` (+33 −0), this slice file (status and report), D41's slice file (one follow-up line in its report)
- **Tests added or changed:** added one case to `rowModel.test.ts`, "merges overlapping, touching and unsorted inner changes on one line"; none of the 27 existing cases changed (the diff removes no test line). Row-model tests 27 → 28; webview 644 → 645; backend 887 before and after
- **Gates:** biome strict clean on the 2 touched `.ts` files (`Checked 2 files`, no warnings); typecheck green (all three projects); test backend 856 passed / 31 skipped of 887 (the skips are the engine `skipIf` tests: no addon is built in this worktree, and no backend file changed), webview 645/645; focused `tests/webview/diffTab` 44/44 (row model 28, D42's view 12, `diffTabCss` 4); l10n n/a (no user-visible text); kb:check green; Rust arm n/a; Sonar: integrator
- **Acceptance:**
  - All 27 existing row-model tests pass unchanged: met (28/28 with the new case; `git diff` of the test file only adds lines).
  - A behavioral case only for an uncovered risk: met. Coverage of `rowModel.ts` from its own tests showed the merge loop's body (old lines 53–55, where the `.at()` change lands) never ran, since no test had two inner changes on one line. The new case covers it, plus spans on another line, empty spans and duplicates. It passed against the old code before the refactor; line coverage of the module went from 96.93% to 100%.
  - The three D41 findings: closed in the code, to be confirmed by the integrator's Sonar run. `segmentsForLine` now calls `spanOnLine` (one inner change clipped to one line, UTF-16 columns unchanged) and `mergeIntervals` (sort, then merge overlapping or touching intervals). `pushUnchangedRun` takes its counts from `visibleEdges`, the ported `UnchangedRegion.fromDiffs` rule as a pure function: same thresholds, same `hideUnchanged` and `length > 0` guards, same NaN behavior. `mergeIntervals` reads `merged.at(-1)` and checks it is defined, in place of `merged[merged.length - 1]`.
  - Public types, row identity and the collapsed-row `WeakMap` contract: unchanged (`buildRows`, `expandCollapsed`, `pushCollapsed` and the map were not edited); D42's view tests pass.
  - How complexity was estimated: SonarQube was not run here (integrator). I scored each function with a scratch script, not committed, that follows the S3776 implementation in the SonarJS analyzer cached by the local scanner (`sonarjs-1.0.0.tgz` inside `~/.sonar/cache/…/sonar-javascript-plugin.jar`) and parses with the repository's own `@babel/parser`. The rules it applies: +1 plus nesting for `if`, loops, `switch`, `catch` and ternaries; +1 for `else if`, `else` and labeled jumps; logical sequences count only for `&&`, never `||` or `??`. Each function is scored on its own body. On the old code it reproduces Sonar's 18 and 20 exactly. New scores: `spanOnLine` 4, `mergeIntervals` 5, `segmentsForLine` 8, `visibleEdges` 5, `pushUnchangedRun` 3. The module's maximum is 9, in the untouched `expandCollapsed`. Even if `||` were counted, nothing would exceed 6.
- **Deviations from the slice:** none.
- **Open questions / follow-ups (unrelated findings, left untouched):**
  - D42's `src/webview/diffTab/view.ts:165` has the same last-element pattern, `changes[changes.length - 1]`. It was integrated after the last Sonar scan, so the next scan will probably report it. It is outside this slice's *Touch*.
  - `rowModel.test.ts` uses `rows[rows.length - 1]` in three existing cases (now lines 281, 357 and 391). The last scan did not report them, and they stay as they are because this slice keeps the existing tests unchanged.
