---
summary: >-
  Maintainer report (`2026-11-07`, 1.9.0): a merge shows only one parent
  line although details list both. Fixed locally: retain and draw unloaded
  parent connections; 14 graph tests and real-history screenshots verify it.
  Full gate pending the compiled engine, SonarQube scanner, and Graphify.
---

# Missing merge-parent lines (`2026-11-07`)

**Status:** fixed locally, uncommitted; full verification has environment gaps
listed below. The installed extension was not changed or repackaged as a VSIX.

## Report and evidence

The newest pull-request merge on main shows one parent line; commit details
list two parents, and other installed graph extensions show both connections.
The supplied log records Git Graph Libre 1.9.0, VS Code Insiders
1.145.0-insider, Linux x64, Git 2.56.0, backend `auto`, Rust engine 1.0.26.
In the affected repository, `loadCommits` repeatedly succeeds with
`commits=251 moreAvailable=true error=none servedBy=engine`.

Read-only inspection of the local repository identified merge `9220a5d`,
with first parent `f188512` and second parent `918d576`. A date-ordered
show-all walk placed the merge at row 1, its second parent at row 2, and its
first parent at row 346. Thus a 250-commit page can contain only one parent.
Row positions depend on the selected refs and later repository changes;
even walking the merge alone places the first parent beyond 250 commits.
No fetch, checkout, config change, or other write was made in that repository.

The log alone does not contain the graph payload or history-filter values.
Its 251 rows are consistent with a 250-commit page plus a synthetic row,
but do not establish which synthetic row was present.

## Cause and scope

Before this fix, `src/webview/graph.ts` linked loaded parents in `linkVertices`,
but recorded unloaded parents only with `setParentBeyondGraph`. That boolean prevented a
false root square; it never schedules a parent connection. A merge with one
loaded parent consequently behaves like a single-parent commit in the layout.
This is shared rendering behavior on both CLI and engine payloads, not proof
of a Rust traversal error. Commit details read the actual commit independently
of the paginated graph, so retaining both parent hashes there is expected.

Workaround before the fix: **Load More Commits** until both parents appear,
or increase `git-graph-libre.initialLoadCommits`. The first-parent setting
(`git-graph-libre.repository.onlyFollowFirstParent`, also overridable in
repository settings) can intentionally omit a side history. The supplied log
does not establish that it was enabled; pagination reproduces the defect
without it. Hiding remote branches does not remove ancestors of included tips.

The later overlapping fetch/tag-fetch ref-lock errors and existing-local-branch
checkout errors are separate from the initial graph load. The latter is already
covered by issue #45 and release 1.10.0's W24. No unrelated action fix belongs
in this renderer change.

## Implementation and verification

`Vertex.parents` now retains a null slot for each unloaded parent, in the
original order. `hasPendingParents` distinguishes an unloaded parent from the
end of the parent list. The normal path draws each continuation through the
page boundary and marks it processed; a final-row merge reserves a separate
lane for each continuation. True roots end without a tail. Reloading commits
rebuilds the vertices, so an unloaded slot becomes a normal connection when
its parent arrives. Backend queries, settings, and the Rust engine are unchanged.

Changed files: `src/webview/graph.ts`, `tests/webview/graph.test.ts`,
`CHANGELOG.md`, this record, the generated knowledge-base index, and two
screenshots under `docs/screenshots/`.

Checks on `2026-11-07`:

- `pnpm exec vitest run --project webview tests/webview/graph.test.ts`:
  four new regression cases failed against the old code; all 14 tests passed
  after the fix and two more root/reload cases. The tests check either missing
  merge parent, two distinct continuations on a one-row page, root termination,
  ordinary page boundaries, and reconnection after loading more history.
- `pnpm exec biome check --config-path biome.strict.jsonc
  src/webview/graph.ts tests/webview/graph.test.ts`: passed. The installed
  Biome emits an informational schema-version mismatch, also seen in the
  unchanged repository-wide config.
- `pnpm run package`: passed (all TypeScript projects, repository lint,
  production bundles). `pnpm run l10n:check`: passed, all four translations
  complete. `pnpm run kb:index`, `pnpm run kb:check`, and `git diff --check`:
  passed.
- Read-only real-history reproduction: capture
  `git log --date-order --format='%H %P' -n 250 9220a5d`, feed those hashes
  and parent lists to the original and patched `Graph.loadCommits`, and count
  paths leaving the merge's point. The same page has first parent `f188512`
  absent and second parent `918d576` present: **one edge before, two after**.
  This reproduction does not depend on a Rust binary or changing settings.
- Headless QtWebEngine render using the real `media/table.css`, inspected:
  [before](../../screenshots/merge-parent-pagination-before.png) and
  [after](../../screenshots/merge-parent-pagination-after.png). PyQt6 is
  available; Xvfb and `xvfb-run` are absent, so the preview used Qt's
  `offscreen` platform. It needed execution outside the sandbox because the
  sandbox blocked Chromium subprocess startup. The previews are the graph
  with hash labels, not captures of the running VS Code extension.
- `pnpm run test` initially hit `spawnSync git EPERM` in the sandbox. Outside
  it, the backend suite had **1,260 passed, 161 skipped, five failed**: each
  failure in `tests/backend/engine/worktrees.test.ts` explicitly requires the
  missing built addon. The webview suite was run separately because the
  chained test script stopped at the backend failure: **988 passed, three
  skipped, one failed**. Its only failure, in
  `tests/webview/messageHandlerTrustGate.test.ts`, requires an engine-served
  worktree listing but gets the expected CLI fallback when the addon is absent.
- `pnpm run test:coverage` outside the sandbox: **2,248 passed, 164 skipped,
  six failed**, the same missing-addon cases. The command exits 1; this is not
  a successful full coverage gate. No test or gate was weakened or skipped
  to claim success.
- `pnpm run sonar:scan`: cannot run, `sonar-scanner: command not found`.
  No SonarQube quality-gate result is claimed. `pnpm run kb:graph` also
  cannot run, `graphify: command not found`; the tracked graph remains stale.
  No `engine/**` file changed, so the Rust gate arm does not apply.

**Next:** in the configured maintainer environment, build the engine addon,
rerun the full gate through SonarQube `OK`, refresh Graphify, then make the
signed commit. Move this record to History when verification is complete.
The missing-addon tests, scanner, and graph refresh are the remaining gaps;
the renderer fix and its focused regression checks are complete.
