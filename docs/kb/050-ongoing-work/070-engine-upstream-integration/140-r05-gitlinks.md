---
summary: >-
  R05: Gitlink content. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R05 — Gitlink content

Status: ready

Needs: R02

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/blob.rs; engine/native/core/tests/gitlink_content.rs; src/extension/diffTab/engineSource.ts; tests/webview/diffTab/engineSource.test.ts; src/backend/engine/stagedFile.ts; tests/backend/engine/parity.test.ts

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Adapt native f007528 gitlink content for revisions/index. Align CLI diff-display route with synthetic Subproject commit hash text. Verify real temporary gitlinks and missing-object submodule commits. Preserve ordinary blob and binary behavior.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

Not started.
