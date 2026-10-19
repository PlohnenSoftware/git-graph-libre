---
summary: >-
  D20 · wave C · gated on X5 and Phase 17's D1/D3 · docs and config · ≤150
  lines: Phase 17 slice 17.0. Record the port's licensing verdict, add
  Microsoft's MIT notices to `LICENSE.mit`, `NOTICE.md` and
  `engine/NOTICE.md`, and pin `@vscode/diff` as an exact devDependency. No
  code.
---

# D20 — Phase 17 legal groundwork

Status: done — awaiting integration
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
- D40 may already have added a Microsoft Corporation section to
  `LICENSE.mit` for the diff editor styles. If so, add this port to that
  section, and don't write a second one.
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

- **Agent / date:** Codex D20, 2026-10-19 02:04; reassigned with maintainer approval, preserving and refining prior edits.
- **Branch and commits:** `diff-1.9.0/d20` — `bceb8cc G chore(license): Phase 17 legal groundwork and the @vscode/diff pin (D20)`, plus the signed report commit carrying this section. Codex stopped on its quota with the work uncommitted; the integrator (Claude Code) committed it on `2026-10-19` after rerunning focused checks (`pnpm install --frozen-lockfile`, the installed version, strict Biome on `package.json`, `kb:check`), per the multi-agent gate policy. No push.
- **Files changed (+/−):** `LICENSE.mit` +5/−2; `NOTICE.md` +17/−0; `engine/NOTICE.md` +39/−0; `package.json` +1/−1; `pnpm-lock.yaml` +5/−5; new licensing verdict +45/−0; this report/status +13/−2; integrator-generated `docs/kb/README.md` +5/−3. Total: 143 changed lines, including the index.
- **Tests added or changed:** none (legal/config only); unchanged totals, backend 887/887 in 82 files and webview 623/623 in 56 files, zero failures/skips. Temporary global Git config and `GIT_CONFIG_NOSYSTEM=1` isolated the run.
- **Gates:** strict Biome 1 file clean; typecheck pass; package pass (lint 296 files); full tests pass; l10n 100% (615 bundle keys, 114 manifest keys, all four translations); kb:check pass; Rust arm n/a (no Rust changed); matching ignored addon smoke 1.0.25 pass after all 44 tracked engine files except NOTICE matched the integration checkout; Sonar: integrator.
- **Acceptance:** local gates pass. After `pnpm run package`, `pnpm exec vsce ls --no-dependencies` lists 37 files, including the exact lines below; `node_modules/@vscode/diff` and `engine/NOTICE.md` each have 0 matches.
```text
LICENSE.mit
NOTICE.md
```
- **Deviations from the slice:** integrator regenerated the required KB index outside agent Touch. Initial tests detected its stale state (855 passed, 1 failed, 31 skipped); index refresh and matching addon resolved all of these. No other scope change.
- **Open questions / follow-ups:** integrator pre-commit coverage/Sonar and signed commit remain; D21 adds fixtures/oracles, then D22 adds source headers and resolves engine license metadata. pnpm reported existing deprecated-subdependency/peer warnings; only the exact oracle package changed. Official Microsoft source/license, 58 fixture directories and the exact npm tarball license were verified without inspecting wasm.
