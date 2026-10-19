---
summary: >-
  D41F · approved 2026-10-19 · ready: preserve row-model behavior while
  fixing two Sonar complexity findings and the last-element access.
---

# D41F — Row-model Sonar follow-up

Status: ready
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
Sonar precede signed commit, with all three D41 findings closed. Report
unrelated findings accurately.

## Report

_(not started)_
