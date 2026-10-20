---
summary: >-
  D62F · ready · TypeScript · ~10 lines: clear the one SonarQube finding wave
  O's gate found in D62's `src/backend/engine/index.ts` (S4624, a nested
  template literal in `rerouteToCli`'s `[route]` line). The line's text and
  every test stay exactly as D62 left them.
---

# D62F — Route-line Sonar follow-up

Status: ready
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

_(not started)_
