---
summary: >-
  R03: Traversal correctness. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R03 — Traversal correctness

Status: claimed by Claude Sonnet on 2026-11-08 23:10

Needs: none

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/log.rs; new engine/native/core/src/log/*.rs; engine/native/core/tests/traversal_parity.rs; src/backend/engine/commits.ts; tests/backend/engine/commits.test.ts; tests/backend/engine/parity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Fix author-date page membership (including filters), topo initial seeding, first-parent path filtering and relevant author-pattern allocations. Read upstream permitted native patches 634ca6c and ff4aafe/f007528. Test against Git with divergent clocks, merges, equal dates, shallow clones, pagination and filtered histories. Benchmark larger history and record CPU/memory tradeoffs. Remove topo decline only when proven, updating relevant tests. Keep public helper used by search compatible. Can add modules under log/ to avoid complexity.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

Not started.
