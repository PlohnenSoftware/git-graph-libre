---
summary: >-
  D65F · ready · script · ~25 lines: clear the three SonarQube findings
  D65's `scripts/list-coauthor-agents.mjs` brought in, two of which turned
  the project-wide reliability and security conditions red: a super-linear
  regex (S8786), a `git` spawned through `PATH` (S4036) and a shadowed
  variable (S1117). The script reads the log on stdin; its output is unchanged.
---

# D65F — Agents-script Sonar follow-up

Status: done — awaiting integration
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

- **Agent / date:** claude-haiku-5-5 (D65F slice agent), 2026-10-20 18:44
- **Branch and commits:** `diff-1.9.0/d65f` —
  - `eaa92a0 G docs(release): claim D65F for the agents-script Sonar follow-up (D65F)`
  - `d1223d1 G fix(scripts): read the log on stdin and parse trailers without a regex (D65F)`
  - `59cb04a G test(scripts): cover the stdin trailer parser for contributors:agents (D65F)`
  - this report commit (signed; its hash is the branch HEAD)
- **Files changed:** `scripts/list-coauthor-agents.mjs` (+24/−16), `package.json` (+1/−1), `tests/backend/listCoauthorAgents.test.ts` (new, +30/−0), slice file Status line and Report. Total for `0657437..HEAD` before the report commit: 4 files, +56/−18 per `git diff --stat`.
- **Tests added or changed:** `tests/backend/listCoauthorAgents.test.ts`, 2 tests (trailer counting with address stripping, case, spaces, CRLF, bare address skipped; non-trailer lines ignored). Backend before: 1109 passed, 60 skipped (1169), derived as the after-count minus the 2 new tests; after: 1111 passed, 60 skipped (1171). Webview: 790 before and after.
- **Gates:**
  - biome: script clean and test file clean under `biome.strict.jsonc --error-on-warnings`. Caveat: the config's `files.includes` does not cover `scripts/*.mjs`, so Biome reports "No files were processed" for the script path itself. I checked the same bytes through a temporary `.js` copy in `scripts/`, which I deleted afterwards. I did not edit the Biome config.
  - typecheck: pass.
  - test: backend 1111/1171 passed (60 skipped); webview 790/790.
  - l10n: n/a (no user-visible text).
  - kb:check: pass.
  - Rust arm: n/a.
  - Sonar: integrator.
- **Acceptance:**
  - Same rows before and after: met, with one caveat. `pnpm run contributors:agents` differs by one row, `Claude Haiku 5.5` 29 → 30, because my own claim commit `eaa92a0` carries a `Co-Authored-By: Claude Haiku 5.5` trailer and the "before" capture was taken at `0657437`. The script change itself is output-neutral: the old script (`git show 0657437:scripts/list-coauthor-agents.mjs`) and the new one give identical output on the HEAD log, and the new script gives output identical to the before capture on the `0657437` log.
  - Parser cases: met, covered by the new test (`Name <addr>`, lower-case key, no address, extra spaces, CRLF, address-only line skipped). The address-only case is a deliberate change: the old regex could print `<addr>` as a name; the new parser skips it.
  - S8786 (no regex), S4036 (no spawn; stdin plus the `package.json` pipe), S1117 (inner map renamed to `tally`): met by code inspection; the Sonar re-scan is the integrator's.
- **Before output** (`pnpm run contributors:agents`, at `0657437`, 16 lines; address-free by construction):
  ```
     155  Claude Sonnet 5.5
     137  Muse Code
      85  Claude Opus 5.5
      80  Claude Opus 5 (1M context)
      29  Claude Haiku 5.5
      18  Codex
      16  Muse Code powered by Meta Muse Spark
       5  ZCode
       4  neophack
       3  Kilo
       3  Muse Code D21 (muse-wonder-full-1.0)
       3  Muse Spark
       2  Claude Sonnet 5
       2  Muse Code D42F (muse-wonder-full-1.0)
       2  zamkorus
       1  Copilot
  ```
- **After output** (same command at `eaa92a0`): identical except `30  Claude Haiku 5.5` (see the caveat under Acceptance). `diff` of the two files shows only that line.
- **Deviations from the slice:** the slice's *Touch* list said a test is welcome only if the parser is exported. I did not export it; the test runs the script on stdin with `spawnSync` instead, which covers the stdin contract end to end. The Acceptance note on the Biome run is a deviation in method, not in result (see Gates).
- **Open questions / follow-ups:** the slice file's front-matter `summary` still says `ready`; I left it, since changing it would need `pnpm run kb:index` and the protocol only lists the Status line and Report as mine. The integrator may want to refresh it. The Biome include gap for `scripts/*.mjs` predates this slice; a maintainer decision would be needed to add it, since `biome*.jsonc` is outside my Touch list.
