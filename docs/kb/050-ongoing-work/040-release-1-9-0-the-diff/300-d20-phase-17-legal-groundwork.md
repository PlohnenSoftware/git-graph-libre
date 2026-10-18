---
summary: >-
  D20 · wave C · gated on X5 and Phase 17's D1/D3 · docs and config · ≤150
  lines: Phase 17 slice 17.0. Record the port's licensing verdict, add
  Microsoft's MIT notices to `LICENSE.mit`, `NOTICE.md` and
  `engine/NOTICE.md`, and pin `@vscode/diff` as an exact devDependency. No
  code.
---

# D20 — Phase 17 legal groundwork

Status: waiting on decisions
Needs: —
Decisions: X5, Phase 17 D1 and D3
Kind: docs, notices, `package.json` · Size budget: ≤ 150 changed lines
Source: Phase 17 under Future work, its "Legal plan"

## Steps

Do items 1–8 of Phase 17's "Legal plan", with these limits:

- Write only the notices and the verdict. The crate doesn't exist yet, so
  leave out Rust file headers and fixtures.
- Add the devDependency by editing `package.json` by hand
  (`"@vscode/diff": "<exact version from D3>"`), then run `pnpm install`.
  Don't run `pnpm add`.
- Write the licensing verdict as a new dated file under
  `docs/kb/030-licensing/010-licensing/`, with `always_read: true`.

## Touch

`LICENSE.mit`, `NOTICE.md`, `engine/NOTICE.md`, `package.json`,
`pnpm-lock.yaml`, `docs/kb/030-licensing/010-licensing/` (one new file)

## Acceptance

- Gates and `kb:check` pass.
- `vsce ls` on a packaged build lists `LICENSE.mit` and `NOTICE.md`, and no
  `node_modules/@vscode/diff`. Paste the relevant lines into the report.

## Report

_(not started)_
