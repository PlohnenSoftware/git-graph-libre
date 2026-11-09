---
summary: >-
  F1-09: Serves the reflog read from the Rust engine (gix) when the engine is
  allowed, with the CLI query as the reference and fallback, proven by a
  cross-backend parity test. No visible change.
---

# F1-09 — Reflog read through the engine

Status: ready

Needs: F1-03

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

New `engine/native/core/src/reflog.rs`; `engine/native/core/src/lib.rs`,
`types.rs`, `api.rs` as needed; `engine/native/node/src/lib.rs` (the export);
new `engine/native/core/tests/reflog.rs`; `src/backend/engine/addon.ts` (the
optional export's types; not `EXPECTED_ENGINE_VERSION`); new
`src/backend/engine/reflog.ts` (the reader that tries the engine and falls
back to the CLI); `src/backend/engine/index.ts` if the reader seam needs it;
the call site in `src/extension/reflogTab/*` that reads the reflog; new
`tests/backend/engine/reflogParity.test.ts`; the slice file's Status and
Report.

## Task and acceptance

- The engine reads a ref's reflog with gix and maps it into this project's
  reflog entry type at the seam. The export is optional: a binary without it
  means "engine unavailable for this read", and the CLI serves it.
- The read follows the existing engine routing: the `backend` setting, the
  repository's verification, CLI fallback on `NotARepository`/`Unsupported`.
  Entry states (F1-02) may stay on the CLI; say which in the Report.
- Parity: over every F1-01 fixture (amend, rebase, merge, checkout, reset,
  detached HEAD, linked worktree, no reflog, expired entries, paging), the
  engine and the CLI return identical entries in identical order; malformed
  reflog lines must not diverge silently (decline instead).
- Measure the read on this repository with a release build and record the
  numbers.
- Runs beside F1-04 (no shared files) and is integrated before F1-05.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

Not started.
