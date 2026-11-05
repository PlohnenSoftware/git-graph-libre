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

Status: integrated `6b0e232` (`2026-11-05`)
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

- **Agent / date:** Claude Haiku 5.5, 2026-11-05 18:03
- **Branch and commits:** `wt-1.10.0/W08` — `77362a7 G docs(telemetry): claim W08, a nested worktree is not a submodule`; `1ccec9c G fix(telemetry): a nested worktree is not a submodule (W08)`; `0f2da89 G test(telemetry): a nested worktree is not a submodule (W08)`; then this report commit.
- **Files changed:** `src/telemetry/viewFeatures.ts` +70 −15; `tests/backend/telemetry/viewFeatures.test.ts` (+124, mostly new tests and imports); this slice file (`Status:` and `## Report`).
- **Tests added or changed:** new describe `submodule signals against real repositories` with four tests: a linked worktree nested in its main worktree (path with a space and a non-ASCII character) is not counted, neither offered nor active; a real submodule from a local fixture is still counted, and active when the graph is drawn for it; a sibling worktree, including a name-prefix sibling, is never nested; an independent repository nested by path (a `.git` directory) keeps counting. `viewFeatures.test.ts`: 37 passing before, 41 after. The first case fails on the pre-fix source at `9e303da` (1 failed, 40 passed) and passes with the fix.
- **Gates:** biome strict: clean on both touched files (the CLI reports a config schema version mismatch, 2.5.13 against 2.6.3, which predates this slice and is untouched); typecheck: clean across `src`, `src/webview` and `tests`; test backend 1148 passed of 1208 (60 skipped), webview 791 of 791; l10n n/a (no user-visible text); kb:check exit 0; Rust arm n/a; Sonar: integrator.
- **Acceptance:** the three cases pass (nested linked worktree not counted; submodule still counted; sibling never nested). Feature ids and the README telemetry list are unchanged; no exported constant, `telemetry.json` or README line changed.
- **Deviations from the slice:**
  1. The check is a file-system read of the `.git` file and `commondir` (as the slice prefers), kept synchronous because `recordCommitLoad` is called synchronously. It runs only for a path already nested by path, and its answer is cached per session.
  2. The diff is about 85 changed lines in `viewFeatures.ts`, including doc comments, above the ~40 guide. Accepted as the guide says.
  3. The protocol names `canonicalizePath()`, which does not exist in this codebase yet (it belongs to W02). The tests use `fs.realpathSync` for the fixture root instead.
  4. Verified with scratch Git repositories: a submodule admin directory has no `commondir`, including a submodule created inside a linked worktree, and a linked worktree's admin directory has one. The check relies on that.
  5. The engine binary was copied to `engine/native/linux-x64/` for the parity tests. It is gitignored and not committed.
  6. `docs/kb/040-reference/040-telemetry.md` does not describe nested repositories, so it is unchanged (outside the Touch list).
- **Open questions / follow-ups:**
  1. **Wrong issue reference in commit `77362a7`.** Its body says `Refs PlohnenSoftware/git-graph-libre#46`, which is wrong: W08 has no linked issue (#46 belongs to W26). I tried to amend that commit's message to remove the line, and the destructive-command gate blocked the amend twice, so I stopped rather than force it. The branch is unpublished. Please reword or squash `77362a7` when integrating. The other commits carry no issue reference.
  2. Whether the W08 fix should also be reflected in the telemetry reference (`040-telemetry.md`) is left to the integrator; the reference does not currently describe the nested-repository rule.
