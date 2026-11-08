---
summary: >-
  R04: Encoding and subjects. Engine review integration slice; focused checks precede
  integrator review and the combined gate.
---

# R04 — Encoding and subjects

Status: claimed by Claude Sonnet on 2026-11-08 23:32

Needs: R03

Read first: Engine upstream integration overview, Multi-agent releases,
November 8 follow-up in Upstream engine review, Phase 16 invariants/non-goals.

## Touch

engine/native/core/src/text.rs; engine/native/core/src/lib.rs; engine/native/core/src/log.rs; engine/native/core/src/details.rs; engine/native/core/src/search.rs; engine/native/core/src/stash.rs; engine/native/core/src/stats.rs; engine/native/core/src/tag.rs; engine/native/core/Cargo.toml; engine/Cargo.lock; engine/native/core/tests/encoding_parity.rs

Own slice report/status and new focused test fixtures are allowed. The
integrator owns shared provenance, changelog and version bumps.

## Task and acceptance

Adapt ff4aafe permitted text logic across wired metadata consumers; audit actual module filenames before dispatch. ISO-8859-1 names/messages, leading blanks and multiline subjects match Git UTF-8 output. Exact encoding_rs 0.8.44 permitted. Unsupported encodings decline safely. No mojibake or partial successful metadata.

Run focused Rust tests, fmt and clippy for changed Rust; for TS run strict
Biome and relevant tests/typecheck. Rebuild before native TS parity tests.
Document exact commands, results, adoption provenance and limitations. Claim
and changes use signed commits; never push. Report Sonar: integrator.

## Report

Not started.
