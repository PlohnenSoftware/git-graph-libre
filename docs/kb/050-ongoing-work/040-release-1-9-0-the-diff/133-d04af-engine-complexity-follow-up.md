---
summary: >-
  D04AF · ready · Rust · ≤60 lines: clear the one SonarQube finding the wave
  gate found in D04a's `engine/native/core/src/diff.rs` (S3776, cognitive
  complexity 17 against 16 allowed) with a behavior-preserving refactor.
  Counts, statuses and tests stay exactly as D04a left them.
---

# D04AF — Engine complexity follow-up

Status: integrated 8746acc
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

- **Agent / date:** Muse Code, 2026-10-19 10:55 Europe/Warsaw (claimed 10:53). Dispatched as general-purpose on the inherited runtime model — this runtime exposes no Haiku/Sonnet/Opus selector (easy-tier slice); the integrator records that constraint.
- **Branch and commits:** `diff-1.9.0/d04af` — `832db4a G refactor(engine): extract modification_kind from classify (D04AF)`; plus this report commit
- **Files changed:** `engine/native/core/src/diff.rs` +19/−11 (30 changed lines outside tests, inside the ≤60 budget), plus this slice file's status/report. Extracted `modification_kind(entry_mode, previous_entry_mode)` holding D04a's type-change check (`is_link`/`is_commit` comparison, verbatim) and the `TypeChanged`/`Modified` choice, with its explanatory comment moved to the helper's doc; `classify`'s `Modification` arm now calls it. No other file touched; no test needed changing.
- **Tests added or changed:** none. D04a's Git-parity tests pass unchanged: Rust `type_changes_list_and_count_as_git_does` (all six directed transitions) and `lists_a_type_change_as_git_does` green; backend `parity.test.ts` (29) and `details.test.ts` (15) green against the rebuilt addon. Rust totals unchanged at 123 passed (incl. 1 doc test).
- **Gates:** biome n/a (no TS/JSON touched); typecheck n/a (no TS touched); test backend focused 44/44 (`parity.test.ts` 29, `details.test.ts` 15, against the rebuilt addon), webview n/a; l10n n/a (no user-visible text); kb:check pass (run with this report); Rust arm pass (`engine:fmt`, `engine:lint`, `engine:check`, `engine:test` 123 passed incl. 1 doc test); `engine:build` + `engine:smoke` OK (engineVersion `1.0.26`, unchanged); Sonar: integrator
- **Acceptance:** Rust arm and the checks above green, with numbers — met (above). The integrator's next Sonar scan shows no `S3776` in `diff.rs` — for the integrator to confirm; by construction `classify` loses the moved nested `if` and `||` sequence (the only branch the finding's count added over the limit, 17 against 16), while the extracted helper is a single top-level `if` over one `||`, so both functions sit below the limit. No exact new score is claimed here, since no Sonar scan was run in this worktree.
- **Deviations from the slice:** none. No engine version bump, per step 2: behavior is byte-for-byte the same classification and counts (moved verbatim, proven by the unchanged parity tests), so TypeScript relies on no behavior an older binary lacks and the Phase 16 bump rule does not trigger; `engine:smoke` still reports `1.0.26`.
- **Open questions / follow-ups:** none. Fresh coverage and the confirming Sonar scan are the integrator's wave gate.
