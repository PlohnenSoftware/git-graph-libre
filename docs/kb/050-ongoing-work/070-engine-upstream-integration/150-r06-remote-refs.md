---
summary: >-
  R06: Remote-ref classification. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R06 — Remote-ref classification

Status: ready

Needs: R01

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/refs.rs; engine/native/core/src/graph.rs; engine/native/core/tests/remote_ref_parity.rs; tests/backend/engine/parity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Remove Gerrit-specific /changes/ hiding and /tags/ reclassification so all refs/remotes entries remain remote branches like CLI. Cover literal branch segments changes and tags, real annotated tag targets, symbolic HEAD and hidden remote behavior. Avoid per-ref prefix formatting and double annotation maps where useful. Own implementation against Git; never import Gerrit source.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

Not started.
