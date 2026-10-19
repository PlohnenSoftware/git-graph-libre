---
summary: >-
  D43F · approved 2026-10-19 · ready: make the staged-file child-process
  rejection explicitly an Error, preserving behavior, to close Sonar S6671.
---

# D43F — Staged-file Error follow-up

Status: done — awaiting integration
Needs: D43 (integrated)
Decisions: separate follow-up approved by the maintainer 2026-10-19
Kind: TypeScript · Size budget: ≤30 changed lines outside tests

## Read first

Agent protocol, D43 brief/report, src/backend/engine/stagedFile.ts and
its tests/parity case; integration log's 2026-10-19 wave findings.

## Steps and Touch

Make showIndexFile's child-process rejection explicitly an Error without
changing CLI arguments, bytes, binary/missing behavior or logs. Its
callback already declares an Error subtype; do not claim an observed
string rejection. Use the smallest sound check or normalization.
Do not suppress S6671, weaken tests or change quality rules.

Touch: `src/backend/engine/stagedFile.ts`,
`tests/backend/engine/stagedFile.test.ts`, this Status/Report, and a
follow-up entry in D43's Report.

## Acceptance

Existing staged-file/parity tests pass unchanged; add a behavioral case
only if needed. Protocol gates pass with a matching addon. Integrator
fresh coverage and Sonar run at integration; S6671 is closed. Report
unrelated findings accurately.

## Report

- **Agent / date:** Codex sub-agent D43F, 2026-10-19 02:07.
- **Branch and commits:** `diff-1.9.0/d43f` — `8dce59c G fix(engine): make staged-file rejection explicitly Error (D43F)`, already merged into `the-diff` by `24582b8`; plus the signed report commit carrying this section. Codex stopped on its quota with the report uncommitted; the integrator (Claude Code) committed it on `2026-10-19` (`kb:check` green). No push.
- **Files changed:** `src/backend/engine/stagedFile.ts` +1/−1; this status/report; one follow-up entry in D43's Report. Tests unchanged.
- **Tests added or changed:** none needed; existing staged-file suite remains 9 cases, staged-file parity 1 case, all unchanged.
- **Gates:** strict Biome clean (1 source file); `pnpm run package` green (typecheck and full lint, 296 files).
  `pnpm run test`: backend 887/887, webview 623/623, no skips. `pnpm run kb:check` green; `git diff --check` clean.
  l10n n/a (no user text changed); Rust arm n/a (no engine source changed); Sonar: integrator, pending.
- **Acceptance:** existing staged-file and parity tests pass unchanged, including text bytes, binary, missing paths and routing/log assertions.
  `instanceof Error` makes the callback's existing Error subtype explicit at rejection; CLI arguments and successful bytes stay unchanged.
  This addresses the reported S6671 form; server-side closure and fresh coverage are unverified until the integrator gate.
- **Deviations from the slice:** none. No claim of an observed string rejection; no suppression or gate changes.
- **Open questions / follow-ups:** integrator coverage/Sonar, then signed commit and signature verification.
  Locked install passed; copied the ignored addon from D10 after equality checks on all 46 tracked engine source/config files.
  `pnpm run engine:smoke` passed at unchanged version 1.0.25. No commit, tag or push performed.
