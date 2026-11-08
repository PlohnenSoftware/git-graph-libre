---
summary: >-
  R01: Ref failures. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R01 — Ref failures

Status: claimed by Claude Haiku on 2026-11-08 23:10

Needs: none

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/graph.rs; engine/native/core/tests/ref_errors.rs

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Replace swallowed read_refs errors at both graph entry points; retain benign unborn/no-stash behavior. Add temporary corrupt-ref regression tests comparing failure with Git. Do not promise CLI fallback for genuine engine errors. Source: f007528 native graph hunks.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

Not started.
