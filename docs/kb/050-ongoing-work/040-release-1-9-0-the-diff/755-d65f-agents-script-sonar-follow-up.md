---
summary: >-
  D65F · ready · script · ~25 lines: clear the three SonarQube findings
  D65's `scripts/list-coauthor-agents.mjs` brought in, two of which turned
  the project-wide reliability and security conditions red: a super-linear
  regex (S8786), a `git` spawned through `PATH` (S4036) and a shadowed
  variable (S1117). The script reads the log on stdin; its output is unchanged.
---

# D65F — Agents-script Sonar follow-up

Status: ready
Needs: D65
Decisions: — (the orchestrator's fix for S4036, below)
Kind: script + manifest · Size budget: ~25 changed lines outside tests
Source: SonarQube analysis `6bda4ff2-8bf1-40b9-94d7-fecb90d4cf0b`, gate
**ERROR** (`software_quality_reliability_issues` 1, `software_quality_security_issues` 1)

## Goal

`scripts/list-coauthor-agents.mjs` prints exactly what it prints today, with
none of these findings:

- `javascript:S8786` (line 9): `TRAILER` can backtrack super-linearly.
  Parse the line without that regex: compare the `co-authored-by:` prefix
  case-insensitively, take the rest, cut it at the first `<` if there is
  one, and trim.
- `javascript:S4036` (line 12): `execFileSync("git", …)` resolves `git`
  through `PATH`. Don't spawn anything. The script reads the log from
  standard input, and the `contributors:agents` script in `package.json`
  becomes `git log --format=%B%x00 | node scripts/list-coauthor-agents.mjs`.
  This repository's other scripts spawn only `process.execPath`.
- `javascript:S1117` (line 19): the inner `counts` shadows the outer one;
  rename one.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `scripts/list-coauthor-agents.mjs`, and the `contributors:agents` entry in
  `package.json`

## Touch

`scripts/list-coauthor-agents.mjs`, `package.json` (that one script line), and a
new small test under `tests/backend/` if you export the parser for it

## Acceptance

- `pnpm run contributors:agents` prints the same rows as before the change.
  Paste both outputs in the report; they must be identical.
- The parser handles `Co-Authored-By: Name <addr>`, `co-authored-by: Name`
  (no address) and extra spaces, and never prints an address. A test is
  welcome if you export it.
- Strict Biome clean on the script, typecheck, `pnpm run test` counts,
  `Sonar: integrator`.

## Report

_(not started)_
