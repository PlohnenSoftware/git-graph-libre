---
summary: >-
  Issue #32 (`2026-10-20`): the Source Control title button uses its
  `rootUri` to select the clicked repository; unknown roots are resolved
  through Git, while calls without a root retain the last active repository.
---

# Source Control title button repository selection (`2026-10-20`)

Issue [#32](https://github.com/PlohnenSoftware/git-graph-libre/issues/32)
reported that clicking repository B's Source Control title button kept
showing repository A. `git-graph-libre.view` discarded the `SourceControl`
argument supplied by VS Code's `scm/title` menu.

`src/extension/commandManager.ts` now handles that argument in
`openSourceControlRepo()`. A nonempty `rootUri.fsPath` is normalized with
`getPathFromStr()`. An exact known root goes through `focusRepo()`, updating
last-active state, opening or revealing the panel, and publishing repositories
so an already-visible graph switches too. Unknown roots go through the existing
`resolveGitRoot()` with the configured Git executable and command recorder,
then `addRepo()` and `focusRepo()`.

The known-root check is deliberately exact: unlike an active editor's file
path, a Source Control root must not select a known enclosing repository in
place of an undiscovered nested repository. A missing or malformed argument,
an empty path, or failed Git resolution preserves the ordinary open behavior.
Command Palette and status-bar invocations therefore keep their last-repository
behavior. This fix does not implement the broader SCM selection synchronization
proposed under Future direction: integrate with VS Code's native source control.

## Verification

Verified in the `fix` worktree based on `b18561d`:

- The command-manager regression suite first failed in five cases with the
  original handler (three known-root cases and two discovery cases), then
  passed all 30 tests with the fix. It also covers absent and malformed
  contexts, empty paths, failed Git resolution, Windows path normalization,
  last-active state, repository publication, and command telemetry.
- `pnpm exec biome check --config-path biome.strict.jsonc --error-on-warnings
  src/extension/commandManager.ts tests/webview/commandManager.test.ts` passed.
- `pnpm run package` passed typechecks, full lint (318 files), and production
  bundling.
- `pnpm run test` passed 88 backend files / 1,114 tests and 63 webview files /
  760 tests, with no skips. The initial run lacked the native addon; copying
  the matching ignored Linux binary from the main checkout and passing
  `pnpm run engine:smoke` (1.0.26) enabled all engine cases. No `engine/**`
  source changed, so the Rust source gate was not required.
- `pnpm run l10n:check` reported 100% in every locale; `pnpm run kb:index`,
  `pnpm run kb:check`, and `pnpm run kb:graph` refreshed and checked the
  documentation and its tracked graph.
- Fresh `pnpm run test:coverage` passed all 1,874 tests in 151 files:
  8,449 / 9,242 lines covered (91.42%). The existing Vitest 5.0.5 /
  coverage-v8 5.0.4 version warning, Vite CommonJS warning, and jsdom
  `scrollTo` warnings remain. The native diff rejection tests intentionally
  print their caught panic messages.
- `pnpm run sonar:scan` completed; the compute-engine task
  `377f40ac-29ed-42b4-8fb1-bcb499a45261` succeeded, analysis
  `7bd0e056-31ca-49fd-9389-547caaaf3cb4` returned quality gate **OK** on all
  nine reported conditions. New-code coverage was 100%, new violations 0,
  duplication 0%, and no open issues affected either touched TypeScript file.
  The server poll used curl after Python urllib received HTTP 403.

No manual VS Code click-through was performed; the regression tests exercise
registered commands and real Git-root discovery. The fix stays on the local
`fix` branch for review; publishing or integrating it is separate work.
