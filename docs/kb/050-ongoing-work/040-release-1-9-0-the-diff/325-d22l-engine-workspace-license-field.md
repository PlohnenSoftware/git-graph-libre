---
summary: >-
  D22L · ready · engine metadata · ≤10 lines: set the engine's declared
  license to `AGPL-3.0-or-later AND MIT` in the Cargo workspace and in
  `engine/package.json`, matching `NOTICE.md` and decision X10. The Rust
  arm applies.
---

# D22L — Engine workspace license field

Status: ready
Needs: —
Decisions: X10 (a); Phase 17 D1 and D2
Kind: engine metadata (Cargo and npm) · Size budget: ≤ 10 changed lines
Source: Phase 17's legal plan, item 6; 22a's report

## Goal

The engine's declared license matches what `NOTICE.md` says: the inherited
MIT engine plus this project's AGPL-3.0-or-later changes.

## Facts (checked `2026-10-19`)

- `engine/Cargo.toml` `[workspace.package]` has `license = "MIT"`.
  `engine/native/core` and `engine/native/node` inherit it
  (`license.workspace = true`).
- `engine/package.json` has `"license": "MIT"`.
- The new `engine/native/diff` crate (22a) already declares
  `AGPL-3.0-or-later AND MIT` on its own.
- Decision D2: the crates are internal and never published, so this is
  metadata only.

## Steps

1. `engine/Cargo.toml`: `license = "AGPL-3.0-or-later AND MIT"`.
2. `engine/package.json`: `"license": "AGPL-3.0-or-later AND MIT"`.
3. If 22a is integrated, the diff crate may switch to
   `license.workspace = true`; otherwise leave it.
4. If `engine/NOTICE.md` or `NOTICE.md` describes the old field as an open
   inconsistency, update that sentence to say it is settled (X10).

## Touch

`engine/Cargo.toml`, `engine/package.json`, `engine/native/diff/Cargo.toml`
(step 3 only), `engine/Cargo.lock` (only if Cargo rewrites it),
`engine/NOTICE.md` and `NOTICE.md` (step 4 only)

## Acceptance

- The Rust arm passes: `pnpm run engine:fmt`, `engine:lint`,
  `engine:check`, `engine:test`.
- `cargo metadata --manifest-path engine/Cargo.toml --no-deps
  --format-version 1` reports the new license for every engine crate.
  Paste the three values into the report.
- Strict Biome clean on `engine/package.json`; `kb:check` green.

## Report

_(not started)_
