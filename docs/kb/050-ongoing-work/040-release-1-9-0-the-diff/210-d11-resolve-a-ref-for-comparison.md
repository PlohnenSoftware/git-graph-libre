---
summary: >-
  D11 · wave B · ready · TypeScript · ≤180 lines: a read-only `resolveRef`
  request turning a SHA, branch, tag or expression like `HEAD~2` into a
  commit hash, or a clear error. It's the backend for issue #26's "Compare
  with…", and can't be turned into a Git option or into a non-commit object.
---

# D11 — Resolve a ref for comparison

Status: integrated 02fdca9
Needs: —
Decisions: —
Kind: TypeScript (backend and message contract) · Size budget: ≤ 180 changed lines outside tests
Source: [issue #26](https://github.com/PlohnenSoftware/git-graph-libre/issues/26) ("Compare with … Commit SHA / Tag / Branch")

## Goal

The webview can ask "what commit does this text name?" safely, before
starting a comparison.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `src/extension/messageHandler.ts`: how `tagDetails` is registered with
  `bridge.onMessage` and answers with `bridge.post`
- `src/types.ts`: request and response message types (search `"tagDetails"`)
- `src/backend/utils/gitRunner.ts`: `runGitRaw`
- `src/backend/queries/tagDetails.ts`: a small read query with a
  `QueryResult` shape to copy

## Steps

1. Create `src/backend/queries/resolveRef.ts`, exporting
   `resolveRef(git, { repo, ref, recordGitCommand })` that returns
   `{ hash: string | null; error: GitQueryError | null }`.
   - **Validate first, without running Git:** trim the text. Reject it when
     empty, when it starts with `-`, or when it contains whitespace, control
     characters or `:`. The `:` blocks `<rev>:<path>` object names. Return a
     validation error, never an exception.
   - **Then run** `git rev-parse --verify --quiet <ref>^{commit}` through
     `runGitRaw` with label `resolveRef`. It prints the full hash, or exits
     non-zero, which is reported as "not a commit".
2. Add the message pair `resolveRef` (`{ repo, ref, requestId }` to
   `{ requestId, hash, error }`) to the types, and register the handler in
   `messageHandler.ts` next to `tagDetails`. Echo `requestId` so late
   replies can be ignored.
3. Don't wire the engine for this read: one Git process per dialog
   submission is fine. Note that in the report.

## Touch

`src/backend/queries/resolveRef.ts` (new), `src/types.ts`,
`src/extension/messageHandler.ts`, `tests/backend/queries/resolveRef.test.ts`
(new), `tests/webview/messageHandler.test.ts` (registration only)

## Tests (real repository, from `makeRepo()`)

- These resolve to the right full hash: a branch, a lightweight tag, an
  annotated tag (which peels to its commit), a full SHA, a 7-character SHA,
  `HEAD~1`.
- These return an error and run no Git: an empty string, `-x`, `--all`,
  `a b`, `HEAD:file`.
- These return a "not a commit" error: an unknown name, and a tree
  (`HEAD^{tree}`).

## Acceptance

Gates pass. The validation tests prove no Git process ran: assert the
command recorder saw nothing.

## Report

- **Agent / date:** Muse Code sub-agent D11, 2026-10-19 00:01
- **Branch and commits:** `diff-1.9.0/d11` — `158de06 G feat(compare): resolve a ref for comparison (D11)`; this report follows in its own signed commit on the same branch.
- **Files changed:** `src/backend/queries/resolveRef.ts` (new, +66/−0), `src/extension/messageHandler.ts` (+13/−0), `src/types.ts` (+16/−0), `tests/backend/queries/resolveRef.test.ts` (new, +149/−0), `tests/webview/messageHandler.test.ts` (+17/−0), and this slice file (status and report). Outside tests: 95 changed lines, within the ≤180 budget.
- **Tests added or changed:** 13 new backend tests in `tests/backend/queries/resolveRef.test.ts` (real repositories from `makeRepo()` in temp directories: branch, lightweight tag, annotated tag peeling, full SHA, 7-character SHA, `HEAD~1` and trimming; validation rejections for empty, `-x`, `--all`, `a b`, `HEAD:file` and a control character; unknown name and `HEAD^{tree}` as not a commit), plus 1 registration test in `tests/webview/messageHandler.test.ts` ("routes resolveRef queries and echoes the request id"). After: backend 862 tests (833 passed, 29 skipped), webview 590 tests (590 passed).
- **Gates:** biome strict (`npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the 5 touched .ts files) clean; typecheck (`pnpm run typecheck`) green; test (`pnpm run test`) backend 833/862 (29 skipped), webview 590/590; l10n n/a (no l10n or webview-visible text changed; backend error strings follow the `tagDetails` pattern); kb:check (`pnpm run kb:check`) green; Rust arm n/a (no `engine/**` change); Sonar: integrator
- **Acceptance:** Gates pass — met, with the numbers above. Validation proves no Git process ran — met: every validation test passes a `recordGitCommand` recorder and asserts it saw nothing (`expect(records).toEqual([])`). Resolves branch, lightweight tag, annotated tag (peeled to its commit), full SHA, 7-character SHA and `HEAD~1` to the right full hash — met by the named backend tests. Empty, `-x`, `--all`, `a b` and `HEAD:file` return an error and run no Git — met by the validation tests (a control-character case is also covered). Unknown name and tree (`HEAD^{tree}`) return a "not a commit" error — met; both map to `'<ref>' is not a commit.` (an unknown ref under `--quiet` comes back from simple-git as empty stdout rather than a thrown error, and that empty result is reported the same way). The `resolveRef` message pair echoes `requestId` — met by the webview registration test asserting `{ command: "resolveRef", requestId: 99, hash, error: null }`.
- **Deviations from the slice:** The message pair is added as standalone `RequestResolveRef`/`ResponseResolveRef` types in `src/types.ts` (the file on the *Touch* list) rather than as an entry in `QueryPayloads` in `src/backend/types/queries.types.ts`, which is outside *Touch*; the handler works through the `RequestMessage`/`ResponseMessage` unions and typecheck passes. The engine is deliberately not wired for this read (step 3): one Git process per dialog submission is fine.
- **Open questions / follow-ups:** none. The dialog that consumes this request is D12.
