---
summary: >-
  D43 · wave D · ready · Rust + TypeScript · ≤150 lines: export the
  engine's existing `index_file` as `load_index_file`, an optional addon
  function, and add `readStagedFile`, which reads a file's staged copy
  from the engine or from `git show :<path>`, with a parity test. The
  Source Control button needs it.
---

# D43 — Engine export for the staged copy of a file

Status: integrated 14ac021
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

- **Agent / date:** Muse Code sub-agent D43, 2026-10-19 01:40
- **Branch and commits:** `diff-1.9.0/d43` — `2310f3c G feat(engine): export load_index_file from the addon (D43)`; `81a1d11 G feat(engine): read the staged copy through readStagedFile (D43)`; plus the signed report commit carrying this section.
- **Files changed:** `engine/native/node/src/lib.rs` +11; `src/backend/engine/addon.ts` +7; `src/backend/engine/stagedFile.ts` (new) +128; `engine/native/core/tests/config_and_blob.rs` +50; `tests/backend/engine/stagedFile.test.ts` (new) +186; `tests/backend/engine/parity.test.ts` +73; this slice file (claim, status, report). Outside tests: 146 changed lines, within the ≤150 budget.
- **Tests added or changed:** Rust: `reads_the_staged_copy_from_the_index` (staged modification beside a later unstaged edit, newly staged file), `reports_a_staged_binary_file_as_binary`, `a_path_outside_the_index_is_not_found` — Rust arm 119 → 122 passed. TypeScript: `stagedFile.test.ts`, 9 tests (engine text/binary; CLI for no `loadIndexFile`, the `git-cli` backend, unverified, malformed and inconsistent payloads, engine throw; CLI text/binary/missing; route log lines asserted in each), and one `parity.test.ts` case agreeing engine and CLI on a staged modification, a newly staged file, a staged binary file and a path outside the index, with the addon called directly so a binary without the export fails there — backend 873 → 883.
- **Gates:** biome strict clean on the 4 touched TS files; typecheck clean; test backend 883/883, webview 591/591 (rebuilt addon, engine halves ran); l10n n/a (no user-visible text); kb:check clean; Rust arm clean (`engine:fmt`, `engine:lint`, `engine:check`, `engine:test` 122 passed, 0 failed); `engine:build` and `engine:smoke` OK (reports 1.0.25); Sonar: integrator.
- **Acceptance:** "Gates pass, the Rust arm included" — met, numbers above. "`pnpm run engine:build` and `pnpm run engine:smoke` succeed" — met. "The engine version is unchanged" — met: `EXPECTED_ENGINE_VERSION`, the Cargo workspace version and `engine/package.json` all stay at 1.0.25. That is safe by the Phase 16 rule (bump only when TS relies on behavior an older binary silently lacks): `loadIndexFile` is optional in the type and absent from the required shape check, and the seam calls it only after a `typeof === "function"` check, so an older binary loads and the read goes to `git show :<path>` instead of silently answering wrongly.
- **Deviations from the slice:** The Rust `index_file` tests live in the existing integration suite `engine/native/core/tests/config_and_blob.rs` (sharing its `TestRepo` fixtures) instead of new unit tests inside `blob.rs`; no `blob.rs` change was needed since `index_file` already existed. On the CLI path, output that is not valid UTF-8 also reads as binary, matching the engine's `commit_file`/`index_file` contract so the two backends agree; the slice names the NUL sniff, which is checked first.
- **Open questions / follow-ups:** none. `readStagedFile(repo, path, deps)` takes the resolved git binary in `deps.gitPath`, ready for D45 to wire.

- **D43F follow-up (`2026-10-19`):** explicit `Error` check at child-process rejection; existing staged-file/parity tests unchanged and passing (backend 887/887, webview 623/623). Integrator coverage and Sonar run at the wave gate; see D43F report.
