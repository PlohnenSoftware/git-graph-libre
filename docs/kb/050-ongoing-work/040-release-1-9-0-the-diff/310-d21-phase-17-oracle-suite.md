---
summary: >-
  D21 · wave C · needs D20 · TS tests · ≤250 lines: Phase 17 slice 17.1.
  Vendor VS Code's 58 diff fixtures and add a Vitest suite running
  `@vscode/diff`'s TypeScript and WebAssembly backends against them. It
  records every difference, including the still-unverified claim that the
  two backends agree.
---

# D21 — Phase 17 oracle suite

Status: done — awaiting integration
Needs: D20
Decisions: —
Kind: TypeScript tests and vendored fixtures · Size budget: ≤ 250 changed lines, not counting the fixtures
Source: Phase 17, "Test strategy" and slice 17.1

## Steps

1. Copy `src/vs/editor/test/node/diffing/fixtures/` from `microsoft/vscode`
   at the commit recorded in D20 into `tests/fixtures/vscode-diff/`. Add a
   README there naming the source path, the commit and the MIT license, as
   in D20's notices.
2. Create `tests/backend/vscodeDiffOracles.test.ts`.
   - For each fixture, run both package backends with
     `computeMoves: false` and `ignoreTrimWhitespace` true when the folder
     name contains `trimws`.
   - Convert each result to VS Code's fixture format (`[2,3)` line ranges,
     `[2,1 -> 2,5]` character ranges), and compare it with
     `advanced.expected.diff.json`, ignoring moves.
3. Known differences go in a documented allowlist in the test file, never
   by loosening the comparison: moves always; anything else found must be
   listed in the report.

## Touch

`tests/fixtures/vscode-diff/**` (new), `tests/backend/vscodeDiffOracles.test.ts` (new)

## Acceptance

- Gates pass.
- The report gives the number of fixtures where TypeScript = WebAssembly =
  expected, with each exception named.

## Report

- **Agent / date:** Muse Code D21 (muse-wonder-full-1.0, general-purpose, inherited runtime model; no named-model selector), 2026-10-19 10:46. Reassigned with maintainer authorization from the previous D21 agent (Claude Code, Opus 5.5, claimed 2026-10-19 02:19, inactive since 02:23), continuing from its vendored fixtures; no reset or clean.
- **Branch and commits:** `diff-1.9.0/d21` — `07f6c81 G test(diff): vendor VS Code's 58 diff fixtures (D21)`; `6348b05 G test(diff): add the Phase 17 oracle suite for @vscode/diff (D21)`; plus the signed report commit carrying this section. No push.
- **Files changed:** `tests/fixtures/vscode-diff/**` 236 files +13146/−0 (235 vendored fixture files in 58 folders, plus the new `README.md` +28 naming `microsoft/vscode` `src/vs/editor/test/node/diffing/fixtures/` at `28a562309973a386b2bdefae78127788a4742fe8` and the MIT notices from D20); `tests/backend/vscodeDiffOracles.test.ts` (new) +237/−0; this slice file (status and report). Non-fixture code is 237 lines, inside the 250-line budget.
- **Fixture verification:** the vendored tree was not re-copied. It was verified byte for byte (`diff -r`, clean) against a sparse checkout of `microsoft/vscode` at the D20 commit `28a562309973a386b2bdefae78127788a4742fe8`: 58/58 folders, 235/235 files (each folder's `1.*`, `2.*`, `advanced.expected.diff.json` and `legacy.expected.diff.json`, plus 3 `advanced.human.diff.json`). The suite itself also asserts 58 folders and that each expected file's embedded inputs match the vendored `1.*`/`2.*`.
- **Tests added or changed:** new `tests/backend/vscodeDiffOracles.test.ts`, 61 tests (1 inventory, 58 per-fixture, 2 allowlist pins). Backend totals 887 tests in 82 files before, 948 in 83 after; webview unchanged at 644 in 58 files.
- **Oracle result (the Phase 17 claim, now measured):** TypeScript = expected on **58/58**; WebAssembly = expected on **56/58**; **TypeScript = WebAssembly = expected on 56/58**. The two backends therefore do *not* always agree at `@vscode/diff` 0.0.2-87, contrary to the package's claim. Every exception is a WebAssembly-only difference, allowlisted and pinned exactly in the test file, with no comparison loosened anywhere else:
  - `noisy-move1` — WebAssembly change 4 of 13 is coarser (`[42,45)`/`[91,176)` from column 1 with `EOL` ends) than expected and TypeScript (`[42,44)`/`[91,175)` from column 9); the other 12 changes match exactly.
  - `ts-example1` — WebAssembly merges the 2 expected changes into 1 coarser change (`[9,15)`/`[9,80)` from column 1).
  - Moves, always: the suite runs `computeMoves: false` and ignores the expected `moves` field, carried by `difficult-move`, `move-1` and `noisy-move1` (1 move each), because neither package backend computes moves.
- **Gates:** strict Biome clean on the new test file (1 file); typecheck pass; focused suite 61/61; full `pnpm run test` backend 917 passed + 31 skipped of 948 (the 31 skips are the engine tests: this worktree has no built addon — the integrator's tree has one), webview 644/644; l10n n/a (no user-visible text); kb:check pass; Rust arm n/a (no `engine/**` change); Sonar: integrator.
- **Acceptance:** gates pass as above (full gate and Sonar belong to integration under the multi-agent policy); the fixture count where TypeScript = WebAssembly = expected is **56 of 58**, with both exceptions named above.
- **Deviations from the slice:** (1) the suite calls the package's exported line-level backends (`_DefaultLinesDiffComputer`, `_initWasm().computeDiffLines`) rather than the public `createDiffComputer`, whose offset-edit result is adapted from a lines diff and loses the line-range grouping the fixture format records; probes of the public and string entry points, and of `computeMoves`/`extendToSubwords`/`ignoreTrimWhitespace` toggles, show the same two WebAssembly differences, so they are backend differences, not entry-point artifacts. (2) Options the slice does not name follow VS Code's fixture runner: no timeout (`maxComputationTimeMs: 0`, the package's no-timeout value; the runner's `MAX_SAFE_INTEGER` gave identical results on all 58 in probes) and `extendToSubwords: false`. No other deviation; *Touch* held.
- **Open questions / follow-ups:** none for D21. D22's port must decide nothing from the two WebAssembly differences — they are package-backend behavior at 0.0.2-87, while the TypeScript backend and the expected files agree on all 58. If a future `@vscode/diff` pin fixes them, the pinned allowlist tests fail and the entries come out.
