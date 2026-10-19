---
summary: >-
  D43F · approved 2026-10-19 · ready: make the staged-file child-process
  rejection explicitly an Error, preserving behavior, to close Sonar S6671.
---

# D43F — Staged-file Error follow-up

Status: ready
Needs: D43 (integrated)
Decisions: separate follow-up approved by the maintainer 2026-10-19
Kind: TypeScript · Size budget: ≤30 changed lines outside tests

## Read first

Agent protocol, D43 brief/report, src/backend/engine/stagedFile.ts and
its tests/parity case; integration log's 2026-10-19 wave findings.

## Steps and Touch

Make showIndexFile's child-process rejection explicitly an Error without
changing CLI arguments, bytes, binary/missing behavior or logs. Its
callback already declares an Error subtype; do not claim an observed
string rejection. Use the smallest sound check or normalization.
Do not suppress S6671, weaken tests or change quality rules.

Touch: `src/backend/engine/stagedFile.ts`,
`tests/backend/engine/stagedFile.test.ts`, this Status/Report, and a
follow-up entry in D43's Report.

## Acceptance

Existing staged-file/parity tests pass unchanged; add a behavioral case
only if needed. Protocol gates pass with a matching addon. Integrator
fresh coverage and Sonar precede signed commit; S6671 is closed. Report
unrelated findings accurately.

## Report

_(not started)_
