---
summary: >-
  D04a · ready · TS and Rust · at most 250 changed lines outside tests:
  admit T in history and engine payloads, count six type transitions like
  Git, and bump the engine version.
---

# D04a — Type-change transport and counts

Status: ready
Needs: —
Decisions: X2 (b); revised D04 scope approved 2026-10-19
Kind: TypeScript and Rust · Size budget: ≤250 changed lines outside tests

## Read first

Agent protocol, maintainer decisions, D04 umbrella, D05 report;
`src/backend/queries/{commitDetails,commitComparison,stashDetails,diffFileChanges}.ts`,
`src/backend/types/git.types.ts`, `src/backend/engine/{details,addon}.ts`,
`engine/native/core/src/{diff,types,status}.rs` and their tests; Phase 16's
engine-version rule in Author Date through the engine.

## Steps

1. Add T to GitFileChangeType and a serde T TypeChanged variant to Rust
   GitFileStatus. Do not add typeChanged.
2. Admit AMDRT in commit details (first-parent merges included), comparisons
   and tracked stash history. Parse T as one non-rename entry, preserving
   NUL parsing, paths, order and counts.
3. Both strict engine parsers retain T through mapEngineFileChange;
   preserve U-to-A/untracked mapping and unknown-kind rejection.
4. Rust classify emits TypeChanged among regular file, symlink and gitlink.
   Executable-only changes stay M; directories stay excluded. Update
   status_name's exhaustive match without changing worktree classifiers.
5. Count each transition's actual content, including a real non-gitlink
   side when a gitlink replaces a file/symlink or vice versa. Preserve
   D05 ordinary gitlink add/delete/update/rename behavior and binary nulls.
6. Bump workspace engine version and EXPECTED_ENGINE_VERSION together
   (currently 1.0.25 to 1.0.26; recheck), both workspace package entries
   in Cargo.lock and affected version tests. Rebuild and smoke-test.

## Touch

`src/backend/queries/commitDetails.ts`, `src/backend/queries/commitComparison.ts`,
`src/backend/queries/stashDetails.ts`, `src/backend/queries/diffFileChanges.ts`,
`src/backend/types/git.types.ts`, `src/backend/engine/details.ts`,
`src/backend/engine/addon.ts` (version/comment only),
`engine/native/core/src/diff.rs`, `engine/native/core/src/types.rs`,
`engine/native/core/src/status.rs` (exhaustive match only), `engine/Cargo.toml`, `engine/package.json`
(workspace/package version only), `engine/Cargo.lock` (workspace package versions only),
matching backend/Rust tests and affected version fixtures.

## Tests and acceptance

- All six directed file/symlink/gitlink transitions: one T path and exact
  Git name-status/numstat parity. Include multiline, identical-byte
  file/symlink, binary, executable-only, T followed by M and D05 gitlinks.
- TS NUL parsing with unusual paths; both strict engine payload shapes
  retain T and reject invalid kinds.
- Real reader parity for commits, comparisons both ways, first-parent
  merges and tracked stash transitions beside third-parent untracked
  entries; require the engine to serve its half.
- Temp repositories with isolated global/system Git config; use plumbing
  for modes, requiring no symlink privilege or network clone.
- Old engine version is rejected; rebuilt addon/smoke and all protocol
  gates plus Rust arm pass. Focused slice checks precede signed commits; full coverage/Sonar OK is required at integration.
  D04b owns presentation/actions. Stop if the approved budget/scope cannot fit.

## Report

_(not started)_
