---
summary: >-
  D04AF · ready · Rust · ≤60 lines: clear the one SonarQube finding the wave
  gate found in D04a's `engine/native/core/src/diff.rs` (S3776, cognitive
  complexity 17 against 16 allowed) with a behavior-preserving refactor.
  Counts, statuses and tests stay exactly as D04a left them.
---

# D04AF — Engine complexity follow-up

Status: ready
Needs: D04a (integrated)
Decisions: — (a follow-up the integrator opened to bring the wave gate to `OK`, as with D41F, D42F and D43F)
Kind: Rust · Size budget: ≤ 60 changed lines outside tests
Source: the integration log's wave gate on `2026-10-19` (Sonar analysis `a86769fe-5852-4332-8281-a9aff7766380`)

## Goal

Bring the quality gate back toward `OK` by fixing the one high-severity
finding in `engine/native/core/src/diff.rs`, without changing any diff,
status or count behavior.

## Read first

- [The agent protocol](010-agent-protocol.md)
- D04a's slice file and report (`132-d04a-type-change-transport-and-counts.md`)
- `engine/native/core/src/diff.rs` around line 446 and its tests
  (`engine/native/core/tests/git_parity.rs`, `graph_and_diff.rs`)

## Facts (the wave gate, `2026-10-19`)

| Rule | Line | Severity | Finding |
| --- | --- | --- | --- |
| `rust:S3776` | 446 | critical (counts as the gate's one high issue) | Cognitive Complexity 17, 16 allowed |

## Steps

1. Extract a small helper from the function at line 446 (or otherwise
   restructure one branch) so its cognitive complexity is at most 16,
   keeping every classification and count identical — D04a's six-transition
   Git parity tests are the proof and must pass unchanged.
2. Change nothing else. No engine version bump: behavior is unchanged, so
   record that reasoning in the report; if you conclude a bump is required
   by the Phase 16 rule (TS relying on behavior an older binary lacks),
   say so and stop instead of bumping on your own.

## Touch

`engine/native/core/src/diff.rs`, Rust tests only if a case is needed for
an uncovered branch

## Tests

Rust arm green (`engine:fmt`, `engine:lint`, `engine:check`,
`engine:test`), `engine:build` + `engine:smoke`, and the backend engine
parity tests green against the rebuilt addon.

## Acceptance

- Rust arm and the checks above green, with numbers in the report.
- The integrator's next Sonar scan shows no `S3776` in `diff.rs`.

## Report

_(not started)_
