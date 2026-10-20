---
summary: >-
  D62F · integrated · TypeScript · ~10 lines: clear the one SonarQube finding wave
  O's gate found in D62's `src/backend/engine/index.ts` (S4624, a nested
  template literal in `rerouteToCli`'s `[route]` line). The line's text and
  every test stay exactly as D62 left them.
---

# D62F — Route-line Sonar follow-up

Status: integrated eb282e4
Needs: D62
Decisions: —
Kind: TypeScript · Size budget: ~10 changed lines outside tests
Source: wave O's gate, SonarQube analysis `bc8e1d0c-197e-4358-ad82-be461a71600c`

## Goal

`rerouteToCli` in `src/backend/engine/index.ts` (about line 251) builds the
`[route]` line with a template literal nested inside another
(`typescript:S4624`). Build the optional ` cause=…` part separately, so the
written line is byte for byte the same.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `src/backend/engine/index.ts`: `rerouteToCli`
- The tests asserting `[route] … reason=… cause=…` lines (find them with
  graphify), which must pass unchanged

## Touch

`src/backend/engine/index.ts` (`rerouteToCli` only)

## Acceptance

- No nested template literal left in `rerouteToCli`; the `[route]` lines
  with and without a cause are unchanged, and every existing test passes
  untouched.
- Strict Biome clean on the file, typecheck, `pnpm run test` counts,
  `Sonar: integrator`.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-10-20 17:55
- **Branch and commits:** `diff-1.9.0/d62f` — `6c6fb0c G docs(release): claim slice D62F (D62F)`; `5556592 G refactor(engine): build the route cause without a nested template (D62F)`; report commit (this section and the Status line)
- **Files changed:** `src/backend/engine/index.ts` (+2 −4); slice file (Status and Report only)
- **Tests added or changed:** none. Backend 1089 passed, 60 skipped, of 1149 (90 files); webview 770 of 770 (63 files). Unchanged by this slice.
- **Gates:** biome clean (strict, `--error-on-warnings`, the touched file); typecheck clean; test backend 1089 passed / 1149 (60 skipped, pre-existing), webview 770 / 770; l10n n/a; kb:check clean; Rust arm n/a; Sonar: integrator
- **Acceptance:** no nested template literal left in `rerouteToCli`: met (the cause part is its own `causePart` constant; the route line is one template). `[route]` line identical with and without a cause: met by construction (same expression moved into a constant; no test asserts it separately). Existing tests pass untouched: met.
- **Deviations from the slice:** none
- **Open questions / follow-ups:** none
