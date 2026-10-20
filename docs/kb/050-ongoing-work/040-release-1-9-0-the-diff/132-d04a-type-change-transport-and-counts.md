---
summary: >-
  D04a · ready · TS and Rust · at most 250 changed lines outside tests:
  admit T in history and engine payloads, count six type transitions like
  Git, and bump the engine version.
---

# D04a — Type-change transport and counts

Status: integrated 88f3715
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

- **Agent / date:** Muse Code, 2026-10-19 10:42 (reassigned 10:37; inherited and preserved the previous agent's uncommitted Rust work, verified it, and committed it first). Dispatched as general-purpose on the inherited runtime model — this runtime exposes no Haiku/Sonnet/Opus selector; the integrator records that constraint.
- **Branch and commits:** `diff-1.9.0/d04a` — `809a939 G feat(engine): list and count type changes as T (D04a)`; `56ad754 G feat(details): carry type changes as T on both backends (D04a)`; plus this report commit
- **Files changed:** Rust: `engine/native/core/src/diff.rs` +107/−23, `types.rs` +4, `status.rs` +3 (exhaustive match only). TypeScript: `git.types.ts`, `diffFileChanges.ts`, `commitDetails.ts`, `commitComparison.ts`, `stashDetails.ts`, `engine/details.ts`, `engine/addon.ts` (version/comment only), each 1–3 lines. Version: `engine/Cargo.toml`, `engine/package.json`, `engine/Cargo.lock` (workspace entries only) to 1.0.26. Tests: `git_parity.rs` +189, `graph_and_diff.rs` +9/−7, `tests/backend/queries/diffFileChanges.test.ts` +61 (new), `engine/details.test.ts` +24, `engine/parity.test.ts` +124, `engine/addon.test.ts` +4/−2. Outside tests: +127/−35 = 162 changed lines against the slice base `83dbb84`, inside the 250 budget.
- **Tests added or changed:** Rust `type_changes_list_and_count_as_git_does` (all six directed transitions vs `git diff --name-status/--numstat`, engine total 122 → 123) and `drops_a_type_change_like_the_cli_filter_does` rewritten as `lists_a_type_change_as_git_does`. TS: `diffFileChanges.test.ts` (3: T as one non-rename entry with counts and a space/tab/unicode path, T followed by M with binary nulls, unknown status stops parsing), `details.test.ts` (+1, total 15: both strict payload shapes retain T, bare list rejects `C`; T case added to the mapping test), `parity.test.ts` (+1: reader parity, engine serving each, for a type-change commit, comparisons both ways, a first-parent merge and a tracked stash beside its untracked third-parent entry), `addon.test.ts` stale-binary fixture now pins 1.0.25. Backend total 887 → 892.
- **Gates:** biome strict clean (11 touched .ts/.json files); typecheck pass; test backend 892/892, webview 644/644 (full `pnpm run test` with the rebuilt addon); l10n n/a (no user-visible text changed); kb:check pass; Rust arm pass (`engine:fmt`, `engine:lint`, `engine:check`, `engine:test` 123 passed incl. 1 doc test); `engine:build` + `engine:smoke` OK (1.0.26); Sonar: integrator
- **Acceptance:** Six directed file/symlink/gitlink transitions with exact Git name-status/numstat parity, including multiline, identical-byte file/symlink (0/0), binary (null/null), executable-only (M 0/0), T followed by M and D05 gitlink add/delete/update — met (`git_parity.rs`, git's own answers pinned). TS NUL parsing with unusual paths — met. Both strict engine payload shapes retain T and reject invalid kinds, U-to-A untracked mapping preserved — met. Real reader parity for commits, comparisons both ways, first-parent merges and tracked stash transitions beside third-parent untracked entries, engine serving its half (`didEngineServeRead()` asserted true) — met. Temp repositories with plumbing-staged modes, no symlink privilege or network — met (Rust helper sets `GIT_CONFIG_NOSYSTEM`; TS fixtures follow the existing local-config pattern with signing off). Old engine rejected — met: 1.0.25 pinned as `versionMismatch` against `EXPECTED_ENGINE_VERSION` 1.0.26, and `addon.test` pins that constant to the Cargo workspace version. Rebuilt addon/smoke and focused checks — met, numbers above.
- **Deviations from the slice:** none in scope or Touch. The version fixture literals elsewhere (`reader.test.ts`, component-status tests) are display examples not tied to `EXPECTED_ENGINE_VERSION`, so they were left unchanged.
- **Open questions / follow-ups:** D04b owns presentation/actions, unchanged. For the integrator: `the-diff` advanced past this slice's base (`83dbb84`) while it was worked (D42F), so rebase at integration as usual; no shared files expected. Fresh coverage and Sonar are the integrator's per the 2026-10-19 gate rule.
