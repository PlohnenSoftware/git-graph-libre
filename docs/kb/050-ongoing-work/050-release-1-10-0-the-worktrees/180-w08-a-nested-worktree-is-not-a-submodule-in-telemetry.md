---
summary: >-
  W08 · wave A · ready · TypeScript · ~40 lines: a reporting bug today. The
  once-per-session `view.submoduleRepo*` features count any repository
  nested inside another as a submodule (`isNestedRepo`, `hasNestedRepo`), on
  the stated assumption that `.gitmodules` is the only way a nested
  repository appears. A linked worktree inside its main worktree breaks
  that, so it is miscounted. Count submodules only.
---

# W08 — A nested worktree is not a submodule in telemetry

Status: ready
Needs: —
Decisions: —
Kind: TypeScript · Size budget: ~40 changed lines outside tests
Source: the TypeScript worktree map (`2026-11-04`); Telemetry under
Reference

## Facts (checked `2026-11-04`, `c47207e`)

- `isNestedRepo()` and `hasNestedRepo()` (`src/telemetry/viewFeatures.ts:152`–`:173`,
  `:226`–`:234`) decide by path prefix, and the comment at `:155`–`:157`
  assumes nesting only comes from `.gitmodules`.
- A linked worktree placed inside the main worktree, a common layout such as
  `.worktrees/<name>`, is nested by path but is not a submodule.

## Steps

1. Treat a nested repository as a submodule only when its `.git` file's admin
   dir has no `commondir`, or equivalently when the parent's `.gitmodules`
   lists its path. Prefer the file-system check: it needs no parsing and no
   Git spawn.
2. Fix the comment. Add tests:
   - a nested linked worktree is not counted;
   - a submodule still is;
   - a sibling worktree is never nested.

## Touch

`src/telemetry/viewFeatures.ts`, `tests/backend/telemetry/viewFeatures.test.ts`

## Acceptance

The three cases pass. The feature ids and the README's telemetry list are
unchanged: the fix corrects a count and adds nothing new.

## Report

Not started.
