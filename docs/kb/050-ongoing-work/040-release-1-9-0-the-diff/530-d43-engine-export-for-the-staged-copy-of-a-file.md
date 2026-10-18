---
summary: >-
  D43 · wave D · ready · Rust + TypeScript · ≤150 lines: export the
  engine's existing `index_file` as `load_index_file`, an optional addon
  function, and add `readStagedFile`, which reads a file's staged copy
  from the engine or from `git show :<path>`, with a parity test. The
  Source Control button needs it.
---

# D43 — Engine export for the staged copy of a file

Status: claimed by Muse Code sub-agent D43 on 2026-10-19 01:36
Needs: —
Decisions: —
Kind: Rust and TypeScript, the Rust arm applies · Size budget: ≤ 150 changed lines outside tests
Source: Phase 17, "A GGL Diff tab, measured" ("Reading the index side in the engine needs a new export")

## Goal

The GGL Diff tab compares a changed file's staged copy with the file on
disk, and `HEAD` with the staged copy. Reading the staged copy in process
needs one more engine export.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `engine/native/core/src/blob.rs`: `commit_file`, `index_file`,
  `is_binary`
- `engine/native/node/src/lib.rs`: `load_commit_file`
- `src/backend/engine/addon.ts`: the `EngineAddon` type and the shape
  check
- `src/diffDocProvider.ts`: `readFromEngine` and `readFromCli`, the
  pattern to copy
- Phase 16's "Author Date through the engine" record, for the engine
  version rule

## Facts (checked `2026-10-19`)

- `blob::index_file(repo, file_path)` already exists in the core crate,
  with the same text/binary contract as `commit_file`, but no `#[napi]`
  function exports it.
- `addon.ts` declares `loadCommitFile(repoPath, hash, file)` (about line
  96). The shape check (about lines 397–417) requires each listed
  function, so a newly required one would make older binaries fail to
  load.

## Steps

1. In `engine/native/node/src/lib.rs`, add `load_index_file(path: String,
   file: String) -> Result<String>`, which mirrors `load_commit_file` and
   encodes the `CommitFile`.
2. In `addon.ts`, add `loadIndexFile?(repoPath: string, file: string):
   Promise<string>`. It is **optional** in the type and stays out of the
   required shape check. So no engine version bump: the TypeScript side
   checks that the function exists before calling it.
3. Create `src/backend/engine/stagedFile.ts`, exporting
   `readStagedFile(repo, path, deps)`. It returns `{ text: string } |
   { binary: true } | { missing: true }`.
   - **Engine:** used when the addon has `loadIndexFile`, the backend
     setting allows the engine and the repository is verified, the same
     conditions `readFromEngine` checks. Parse the payload strictly.
   - **CLI otherwise:** `git show :<path>` through `runGitCommand`, label
     `stagedFile.show`. A NUL byte in the first 8,000 bytes means binary,
     as `is_binary` decides; a path not in the index means `missing`.
   - **Logging:** `logBackendRoute("loadIndexFile", …)` with
     `backend=engine`, or the CLI reason, as D01 does.

## Touch

`engine/native/node/src/lib.rs`, `engine/native/core/src/blob.rs` (tests
only), `src/backend/engine/addon.ts`, `src/backend/engine/stagedFile.ts`
(new), `tests/backend/engine/stagedFile.test.ts` (new),
`tests/backend/engine/parity.test.ts` (one new case)

## Tests

- **Rust:** `index_file` on a staged change, a binary file and a missing
  path, if no such test exists yet.
- **`stagedFile.test.ts`:**
  - a fake addon without `loadIndexFile` goes to the CLI;
  - the `git-cli` backend goes to the CLI;
  - a malformed engine payload goes to the CLI;
  - the route log lines.
- **`parity.test.ts`:** with `makeRepo()`, a staged modification, a newly
  staged file, a path not in the index and a staged binary file. The
  engine and the CLI agree on each.

## Acceptance

- Gates pass, the Rust arm included. `pnpm run engine:build` and
  `pnpm run engine:smoke` succeed, and the engine version is unchanged.

## Report

_(not started)_
