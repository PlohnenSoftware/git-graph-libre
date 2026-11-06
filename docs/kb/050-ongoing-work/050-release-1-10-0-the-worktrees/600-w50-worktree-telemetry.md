---
summary: >-
  W50 · wave F · needs W11, W32, Y19 · TypeScript + docs · ~80 lines: two
  once-per-session view features, under the telemetry rules: a worktree
  marker was shown, and a graph was opened on a linked worktree. They are
  booleans with fixed ids: no paths, no counts, no names. They are added to
  the README's "What is sent", `telemetry.json` and the Telemetry reference.
  The actions themselves are already counted by the command chokepoint.
---

# W50 — Worktree telemetry

Status: done — awaiting integration
Needs: W11, W32
Decisions: Y19 (add the two features, or none)
Kind: TypeScript and docs · Size budget: ~80 changed lines outside tests
Source: Telemetry (`telemetry` branch, `2026-08-26`) under Reference: features
that work by showing something are reported once per session, at the
documented chokepoints

## Steps (as recommended)

1. In `src/telemetry/viewFeatures.ts`, add `view.worktreeMarker` (a marker
   from W11 or W12 was rendered) and `view.linkedWorktreeRepo` (a graph was
   loaded on a linked worktree). Each is reported once per session, as a
   boolean, from the same chokepoints as the existing features. The
   linked-worktree check is the admin dir's `commondir`, never a path sent
   anywhere.
2. Update the README's Telemetry section ("What is sent"), `telemetry.json`
   (the declaration `code --telemetry` shows), and the Telemetry reference
   section.
3. Tests, as for the existing features: reported once, never with a path,
   and not at all while telemetry is `unset` or `disabled`.

## Touch

`src/telemetry/viewFeatures.ts`, `telemetry.json`, `README.md` (the
Telemetry section only), `docs/kb/040-reference/040-telemetry.md`,
`tests/backend/telemetry/**`

## Acceptance

The two ids appear once per session in a packaged-build check, with nothing
but the boolean.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 15:12
- **Branch and commits:** `wt-1.10.0/W50` — `204024c G docs(telemetry): claim W50, worktree telemetry`; `fc19646 G feat(telemetry): report worktree marker and linked worktree (W50)` (source and tests together, since the sibling tests need the new behavior); `c301233 G docs(telemetry): list the worktree features in the disclosure (W50)`; then this report commit.
- **Files changed (against `b783f62`, before the report commit):** `src/telemetry/viewFeatures.ts` +103 (includes doc comments; the budget is a hint); `tests/backend/telemetry/viewFeatures.test.ts` 134 changed lines (new cases, two narrowed assertions, imports, id-pattern list); `telemetry.json` +1/−1; `README.md` +4/−2 (the Telemetry section only); `docs/kb/040-reference/040-telemetry.md` +10; this slice file.
- **Tests added or changed:** new in `viewFeatures.test.ts`: the describe is renamed to "submodule and worktree signals against real repositories" and gains five real-repository cases: a drawn branch held by a linked worktree is reported once across two loads; the linked worktree and the main branch it shares a repository with (order: linked, then marker); the linked worktree's own branch is not marked; a detached other worktree marks nothing; a bare repository's HEAD is not a checkout (its linked worktree is still reported). The id-pattern `it.each` gains the two ids. Two existing sibling and nested-worktree tests changed from `toEqual([])` to asserting that the submodule ids are absent, because the new signals fire legitimately there (the parent holds `main`). Counts: the focused telemetry file is 94 of 94 after the change; I did not re-measure the pre-change count, so the full suite below is the figure to rely on.
- **Gates:** strict Biome (`--config-path biome.strict.jsonc --error-on-warnings`) on both touched `.ts` files: clean (the only notice is the pre-existing `biome.strict.jsonc` schema-version mismatch 2.5.13 vs CLI 2.6.3, which W08 also reported); `pnpm run typecheck`: exit 0; `pnpm run test`: backend 1411 of 1411 (108 files), webview 954 of 954 (76 files), no "Unhandled Errors"; `pnpm run kb:check`: exit 0. `l10n:check` not run: no user-visible text changed. Engine: not touched, not rebuilt (the gitignored 1.0.31 binary was left in place). Sonar: integrator.
- **Acceptance:** "The two ids appear once per session in a packaged-build check, with nothing but the boolean" — **not met, not run.** No packaged build or VS Code session was run. The evidence is the reporter's tests: the ids are reported once across repeated loads, and the payload is the fixed id and `ok: true` only (the spy records exactly that). The packaged check is the integrator's to run.
- **Deviations from the slice:**
  1. **W12 is not included.** Step 1 says "a marker from W11 or W12", but the brief says "a worktree marker shown on a branch badge". W12's detached marker sits on a commit row, not a branch badge, and the host would need the detached-HEAD map to count it. I followed the brief and documented the choice in the reference.
  2. **The marker is decided from the admin directories, not from the worktree list.** The loaded commits reach the reporter, but the worktree list does not, and `src/extension/messageHandler.ts` (where the call site sits) is outside the Touch list. So `viewFeatures.ts` reads each linked worktree's `HEAD`, plus the main worktree's `HEAD` unless `core.bare` is set, with `fs` only. This relies on `core.bare` being parsed from `[core]` in the common config (a small parser that ignores subsections).
  3. **Telemetry-unset/disabled gating is not tested here.** The brief's step 3 asks for it. The gate lives in `src/telemetry/index.ts` (`logFeature` checks `enabled()`), and `viewFeatures.test.ts` does not exercise that path for the existing features either. I did not add a new test for it, to keep the slice inside Touch.
  4. **The two existing assertions were narrowed** (see tests above), not weakened: the submodule ids are still asserted absent.
- **Open questions / follow-ups:**
  1. Whether the W12 detached-HEAD marker should count as `view.worktreeMarker`. It is a different surface, so it would need its own id or a decision to widen this one.
  2. The packaged-build acceptance check, for the integrator.
  3. A test for the unset/disabled gate of `view.*` features in general (in `index.ts`), if the maintainer wants it per feature.
  4. The engine binary was not rebuilt for this worktree; the protocol asks for `pnpm run engine:build` after W01, and this slice does not change the engine. The integrator may want a rebuild at the gate.
