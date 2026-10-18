---
summary: >-
  D11 · wave B · ready · TypeScript · ≤180 lines: a read-only `resolveRef`
  request turning a SHA, branch, tag or expression like `HEAD~2` into a
  commit hash, or a clear error. It's the backend for issue #26's "Compare
  with…", and can't be turned into a Git option or into a non-commit object.
---

# D11 — Resolve a ref for comparison

Status: ready
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

_(not started)_
