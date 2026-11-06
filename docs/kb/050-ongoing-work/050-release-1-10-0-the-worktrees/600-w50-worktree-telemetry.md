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

Status: ready
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

Not started.
