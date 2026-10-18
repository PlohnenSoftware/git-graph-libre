---
summary: >-
  D01 · wave A · ready · TypeScript · ≤120 lines: write a `[route] …
  backend=engine` line, with a file count, whenever the engine serves file
  text, commit details or a comparison. Today only fallbacks to the CLI are
  logged, so an engine-served diff leaves no trace. Covers the diff-read
  part of issue #31.
---

# D01 — Log engine hits for diff reads

Status: ready
Needs: —
Decisions: —
Kind: TypeScript · Size budget: ≤ 120 changed lines outside tests
Source: [issue #31](https://github.com/PlohnenSoftware/git-graph-libre/issues/31) (result and decline-cause log entries, diff reads only); the "Diff parity against real history" record under Phase 16

## Goal

Make every diff-related read say in the log which backend answered it. The
CLI fallbacks already do (`backend=cli reason=…`); the engine's successes
say nothing.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `src/backend/utils/operationLog.ts`: `logBackendRoute`, `setOperationLog`
- `src/diffDocProvider.ts`: `readFromEngine`
- `src/backend/engine/index.ts`: `readCommitDetails`, `readCommitComparison`,
  `rerouteToCli`, `noteEngineThrow`
- `tests/backend/diffDocProvider.test.ts` (around the `setOperationLog` use)
  and `tests/backend/engine/reader.test.ts`

## Facts (checked `2026-10-18`; the lines may have moved)

- `logBackendRoute(operation, reason)` writes
  `[route] <context> operation=<operation> <reason>` (`operationLog.ts`,
  about line 34).
- Fallbacks already log: `readFromEngine`'s `viaCli(reason)`, `rerouteToCli`,
  `noteEngineThrow`.
- These successes are silent:
  - `readFromEngine` returning `file.contents`;
  - `readCommitDetails` and `readCommitComparison`, where they set
    `engineServedRead = true` and return.

## Steps

1. In `readFromEngine`, just before returning the contents, call
   `logBackendRoute("loadCommitFile", "backend=engine")`.
2. In `readCommitDetails`, at the success return, call
   `logBackendRoute("commitDetails", \`backend=engine files=${fileChanges.length}\`)`.
   On the stash branch, add ` stash=1`.
3. In `readCommitComparison`, at the success return, call
   `logBackendRoute("commitComparison", \`backend=engine files=${fileChanges.length}\`)`.
4. Change nothing else. The token `backend=engine` mirrors the existing
   `backend=cli` exactly.

## Touch

`src/diffDocProvider.ts`, `src/backend/engine/index.ts`,
`tests/backend/diffDocProvider.test.ts`, `tests/backend/engine/reader.test.ts`

## Tests

- `DiffDocProvider` with a fake addon that returns text: the log has one
  line containing `operation=loadCommitFile backend=engine`. With the
  `git-cli` preference, there's no such line.
- Reader with a fake addon: a commit-details success logs
  `operation=commitDetails backend=engine files=<n>`. A stash logs
  ` stash=1` too. A comparison success logs
  `operation=commitComparison backend=engine files=<n>`. A rerouted merge
  still logs only `backend=cli reason=mergeCommit`.

## Acceptance

- All gates from the protocol pass. The new tests fail on the unmodified
  code and pass after.
- `git diff --stat` shows only the files under *Touch*.

## Report

_(not started)_
