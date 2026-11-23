---
summary: >-
  F4-09 (optional, gated on BQ8 and profiling): Serve plain revision blame
  reads through the Rust engine (`gix` blame) with CLI as reference and
  fallback, clean declines for unsupported flags (`-M`, `-C`, `--contents`,
  `.git-blame-ignore-revs`), and cross-backend parity tests.
---

# F4-09 — Optional: Rust engine blame read with parity tests

Status: deferred (`2026-11-23`) — BQ8's profiling found no speedup: `gix`
blame is slower than `git blame` on every file measured (below). Not part of
release 1.11.0. Revisit when a newer `gix` changes the numbers.

**BQ8 profiling (`2026-11-23`, integrator).** Wall-clock time of
`git blame --porcelain -- <file>` (Git `2.56.1`, process start included)
against `gix blame <file>` built `--release` with `max-pure` from the engine's
own pin (gitoxide `f06f106`, the `Cargo.lock` source), same machine, warm
cache:

| Repository (commits) | File (lines) | `git blame` | `gix blame` |
| --- | --- | --- | --- |
| git.git (82,443) | `diff.c` (7,860) | 612 ms | 1,012 ms |
| git.git | `sequencer.c` (7,089) | 524 ms | 738 ms |
| git.git | `builtin/blame.c` (1,334) | 251 ms | 434 ms |
| git.git | `refs/files-backend.c` (4,116) | 315 ms | 400 ms |
| this repository (1,504) | `src/webview/main.ts` (9,212) | 84 ms | 140 ms |
| this repository | `src/extension/messageHandler.ts` (1,479) | 10 ms | 22 ms |

`gix` is 1.3–2.2 times slower in every case, so an engine read would make the
Blame tab slower, and BQ8's condition ("profiling on large files confirms a
meaningful speedup") is not met. A gitoxide checkout one month older
(`abdfc45`) measured the same within 5 %. The `git blame` side also already
handles `-M`, `-C`, `--contents -` and ignore-revs, which `gix` would decline.

Needs: F4-01

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for `BQ8`; "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`),
section 3; Phase 16 invariants, design rules, and non-goals
(`docs/kb/050-ongoing-work/030-implementation-roadmap/010-phase-16-rust-engine-backend/`);
and `src/backend/engine/reflog.ts` + `engine/native/core/src/reflog.rs` as the
exact template for an optional engine read.

Rules for every slice: implement from `gix` documentation and this project's
own patterns; never copy third-party code. Tests ship with behavior, using
real-Git fixtures in temporary directories only. Strict Biome on touched
TypeScript files, full Rust arm (`engine:fmt`, `engine:lint`, `engine:check`,
`engine:test`, `engine:build:release`, `engine:smoke`), no `var`, American
English, no new telemetry events or declarations. Do not bump versions or edit
`CHANGELOG.md`, `README.md`, or `NOTICE.md`; the integrator does. Report
Sonar: integrator.

## Touch

`engine/native/core/Cargo.toml` and `engine/Cargo.lock` (only if `gix` `0.90`
exposes a compatible `blame` / `gix-blame` feature without breaking existing
features — verify first; if `gix` `0.90` lacks the needed blame support or
introduces unacceptable compile/binary bloat, stop and report); new
`engine/native/core/src/blame.rs`; `engine/native/core/src/{lib,api,types}.rs`;
`engine/native/napi/src/lib.rs` (optional `loadBlame` export — do not bump
the engine protocol version so older binaries continue to fall back cleanly);
`src/backend/engine/addon.ts` (declare optional `loadBlame?`); new
`src/backend/engine/blame.ts` (`readBlame` engine-first wrapper mirroring
`src/backend/engine/reflog.ts`); new `tests/backend/engine/blameParity.test.ts`;
this slice file's Status and Report. Do **not** touch `src/webview/*`,
`l10n/*`, `package.json`, or `src/extension/messageHandler.ts` so this slice
can run cleanly beside UI slices (assembly wiring follows in `F4-08` or a
tiny `F4-09F` follow-up, exactly like `F1-09` / `F1-09F`).

## Task and acceptance

- **Profiling gate (before editing Rust):**
  - Benchmark `loadBlame` (`F4-01`) on `src/webview/main.ts` (~9,200 lines)
    and two medium files in this repository; record p50/p95 CLI timings in the
    Report. Proceed only if the CLI latency shows a real opportunity for an
    in-process speedup.
- **Engine design rules (Phase 16):**
  - Map engine results into `F4-01`'s exact `GitBlameResult` shape.
  - CLI (`loadBlame`) remains the reference and default fallback.
  - Decline (`Unsupported`) back to CLI whenever:
    - `backend() !== "auto"` or `!isVerified(repo)`
    - working-tree blame (`rev === null`) or unsaved buffer (`contents !== undefined`)
    - `-w` (if `gix-blame` differs on whitespace), `-M`, `-C`,
      `ignoreRevsFile`, or `ignoreRevs` are active
    - shallow clones, replace refs, submodules/gitlinks, binary/oversized
      files, or any case where `gix` could diverge from Git's blame output.
  - Release repository handles cleanly per handle-lifetime rules (no leaks).
  - Log route via `logBackendRoute("loadBlame", "backend=engine" | "backend=cli reason=...")`.
- **Cross-backend parity tests (`tests/backend/engine/blameParity.test.ts`):**
  - Compare `readBlame` (engine) vs `loadBlame` (CLI) hunk-for-hunk and
    line-for-line across real-Git temporary fixtures: linear history, merges,
    renames, root/boundary commit, non-ASCII paths and commit messages, empty
    file, linked worktree, and bare repository.
  - Verify every declined option (`rev === null`, `-M`, `-C`, `--contents`,
    `--ignore-rev`, unverified repo, `git-cli` setting) routes cleanly to CLI
    with identical output.
  - Record before/after benchmark numbers (CLI vs release-build engine) on
    this repository in the Report.

Run focused checks (full Rust arm: `pnpm run engine:fmt`, `pnpm run engine:lint`,
`pnpm run engine:check`, `pnpm run engine:test`, `pnpm run engine:build:release`,
`pnpm run engine:smoke`; plus `npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched TS files, `pnpm run typecheck`,
`npx vitest run --project backend tests/backend/engine/blameParity.test.ts`,
and `node ./docs/kb/housekeeping.mjs --check`) and record each command and
result. Claim and changes are separate signed commits; never push.

## Report

Not started.
