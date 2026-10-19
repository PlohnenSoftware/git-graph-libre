---
summary: >-
  D22L · ready · engine metadata · ≤10 lines: set the engine's declared
  license to `AGPL-3.0-or-later AND MIT` in the Cargo workspace and in
  `engine/package.json`, matching `NOTICE.md` and decision X10. The Rust
  arm applies.
---

# D22L — Engine workspace license field

Status: done — awaiting integration
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

## Report

- **Agent / date:** Claude Haiku D22L, 2026-10-19 14:46
- **Branch and commits:** `diff-1.9.0/d22l` — `2a7ed87 G chore(engine): declare the engine license as AGPL-3.0-or-later AND MIT (D22L)`; the report commit (`docs(release): report D22L done, awaiting integration (D22L)`) is the commit that adds this section
- **Files changed:** `engine/Cargo.toml` (+1 −1), `engine/package.json` (+1 −1), `engine/native/diff/Cargo.toml` (+1 −1), this slice file (Status line and Report only); `engine/Cargo.lock` unchanged; `NOTICE.md` and `engine/NOTICE.md` unchanged (see deviations)
- **Tests added or changed:** none. Engine test count after the change: 134 passed, 0 failed across all `cargo test` binaries and doc-tests (count before not recorded; no test was touched)
- **Gates:** biome exit 0 on `engine/package.json`, but Biome printed "These paths were provided but ignored" for that file, so it was not actually linted; typecheck not run (slice touches no TypeScript); test backend and webview not run (no TypeScript changed); l10n n/a; kb:check see the report commit's run; Rust arm: `engine:fmt`, `engine:lint`, `engine:check` and `engine:test` all exit 0; Sonar: integrator
- **Acceptance:** Rust arm passes: met. `cargo metadata --manifest-path engine/Cargo.toml --no-deps --format-version 1` reports (verbatim):
  ```
  git-graph-core AGPL-3.0-or-later AND MIT
  git-graph-node AGPL-3.0-or-later AND MIT
  git-graph-diff AGPL-3.0-or-later AND MIT
  ```
  Strict Biome clean on `engine/package.json`: exit 0, but the file is in Biome's ignore list, so this is weaker than the criterion intends (see open questions). `kb:check`: see below.
- **Deviations from the slice:** none in edits. Step 5 (NOTICE sentence) did not apply: neither `NOTICE.md` nor `engine/NOTICE.md` describes the workspace `license` field as an open inconsistency. Their only mentions of `license = "MIT"` describe the upstream `vscode-git-graph-rs` workspace.
- **Open questions / follow-ups:** (1) `engine/NOTICE.md` line 70 still reads "The engine is MIT licensed" and the root `NOTICE.md` describes the incorporated engine as MIT; both are accurate as provenance, but a maintainer may want to confirm they are not read as contradicting the new AGPL-3.0-or-later AND MIT field. Not changed, per the slice. (2) Biome ignores `engine/package.json`, so the strict Biome check on it is a no-op; the maintainer may want to check the ignore list.
