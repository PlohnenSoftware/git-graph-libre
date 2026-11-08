---
summary: >-
  R02: Bounded reads. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R02 — Bounded reads

Status: ready

Needs: none

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/blob.rs; engine/native/core/src/api.rs; engine/native/core/src/lib.rs; new engine/native/core/src/file_read.rs; engine/native/core/tests/bounded_reads.rs; src/extension/diffTab/engineSource.ts; tests/webview/diffTab/engineSource.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Enforce 64 MiB maximum before blob allocation and during working-file reads, including growing files; shared cohesive helpers. Align error/tooLarge handling rather than falling back into unbounded allocation or silently treating oversized files as missing. Fix library facade path and strict UTF-8 behavior while touching it. Do not claim lexical checks prevent symlink escapes. Source: 634ca6c native blob/api; do not modify gitlink behavior yet.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

Not started.
