---
summary: >-
  D01 · wave A · ready · TypeScript · ≤120 lines: write a `[route] …
  backend=engine` line, with a file count, whenever the engine serves file
  text, commit details or a comparison. Today only fallbacks to the CLI are
  logged, so an engine-served diff leaves no trace. Covers the diff-read
  part of issue #31.
---

# D01 — Log engine hits for diff reads

Status: done — awaiting integration
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

- **Agent / date:** Muse Code sub-agent D01, 2026-10-19 00:07
- **Branch and commits:** `diff-1.9.0/d01` — `19a4ddd G feat(diff): log engine hits for diff reads (D01)`; this report follows in its own signed commit on the same branch. The branch is based on the prepared integration base `3aea3ca`; `git log --format='%h %G? %s' the-diff..HEAD` lists exactly these commits (see the follow-up about the integration branch below).
- **Files changed:** `src/diffDocProvider.ts` (+2/−1), `src/backend/engine/index.ts` (+5/−0), `tests/backend/diffDocProvider.test.ts` (+42/−0), `tests/backend/engine/reader.test.ts` (+115/−0), and this slice file (status and report). Outside tests, `src/` changed 7 insertions / 1 deletion (8 lines), within the ≤120 budget.
- **Tests added or changed:** 6 new tests, none changed. In `tests/backend/diffDocProvider.test.ts`: "logs one engine route line when the engine serves file text" and "logs no engine route line on the git-cli preference". In `tests/backend/engine/reader.test.ts`: "logs an engine route line with the file count on a details success", "logs only the CLI route when a merge is rerouted", "logs the stash marker on an engine-served stash details read" and "logs an engine route line with the file count on a comparison success". All use the existing fake addons and `setOperationLog`. Count: 89 → 95 tests in the two touched test files; backend total 849 → 855 (849 is the baseline on `3aea3ca`).
- **Gates:** biome strict (`npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the 4 touched .ts files) clean; typecheck (`pnpm run typecheck`) green; test (`pnpm run test`, after `pnpm run engine:build` so the real-engine tests ran instead of skipping — build artifacts are ignored and no `engine/**` source changed) backend 855/855, webview 589/589; l10n n/a (no user-visible or l10n text changed; operation-log lines are not localized anywhere); kb:check (`pnpm run kb:check`) green; Rust arm n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:** All gates from the protocol pass — met, with the numbers above. The new tests fail on the unmodified code and pass after — met: with the tests added and `src/` untouched, the two touched test files ran 4 failed / 91 passed (95 total), the failures being exactly the four positive log-line cases; the two negative cases (git-cli preference, rerouted merge) passed both before and after, as they must. After the `src/` changes the same two files run 95/95. `git diff --stat` shows only the files under *Touch* — met against `3aea3ca`: the 4 *Touch* files plus this slice file's status and report, which the protocol always allows. Step by step, the tests assert: one `operation=loadCommitFile backend=engine` line for engine-served file text and none on the `git-cli` preference; `operation=commitDetails backend=engine files=1` (and no ` stash=1`) on a plain details success; `operation=commitDetails backend=engine files=1 stash=1` on a stash; `operation=commitComparison backend=engine files=1` on a comparison success; and a rerouted merge logging `operation=commitDetails backend=cli reason=mergeCommit` with no `backend=engine` line.
- **Deviations from the slice:** One line beyond the *Steps*: in `src/diffDocProvider.ts` the imported names on the existing `./backend/engine/addon` import line are sorted (`type EngineAddon` before `loadEngineAddon`). Strict Biome check reports that `organizeImports` error on the clean base too — verified by stashing this slice's change to that file and re-running the same command, which reported the identical single error — and the knowledge base requires fixing existing Biome issues in touched files, so the touched file passes the strict gate. No behavior change.
- **Open questions / follow-ups:** The local `the-diff` branch advanced during this session to `9d9094f` (the D11 integration, 3 commits on top of `3aea3ca`). This branch was deliberately left on its prepared base `3aea3ca` for the integrator to rebase; `the-diff..HEAD` still lists exactly this slice's commits. Nothing else.
