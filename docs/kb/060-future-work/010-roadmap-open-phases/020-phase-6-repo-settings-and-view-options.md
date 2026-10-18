---
summary: >-
  Mostly complete: repo settings modal and per-repo view toggles. Open:
  initial branches on load. `2026-07-27` record: detached-HEAD visibility,
  `repository.includeUnreachableCommits` (`git fsck`), segmented local/remote
  ref badges.
---

# Phase 6: Repo Settings and View Options

**Status: mostly complete** — the repository settings modal covers display-name override, per-repo view toggles (stashes, tags, reflog and unreachable commits, first parent, remote branches), user details, remotes, issue linking, and config export. The all-branches view also keeps a detached HEAD visible. Remaining: initial-branches-on-load selection.

Goal: keep the toolbar clean while still exposing repo-scoped rendering options.

Implementation plan:

- Add `RepoSettings` type, for example `{ showTags, showRemotes, showRemoteHeads,
  showStashes, showUncommittedChanges, rowHeight, fontSize }`.
- Add `ExtensionState` helpers for repo settings.
- Use absolute repo path as the first repo key because the extension already
  tracks repos by path. Optionally normalize remote URL later for portability.
- Add `loadRepoSettings` and `saveRepoSettings` messages.
- Add a small webview menu/toggle surface scoped to the active repo.
- Apply settings to existing data flow:
  - `showRemotes` can map to the existing remote branch visibility.
  - `showTags` can filter rendered tag refs or query refs differently.
  - `showStashes` can control the stash UI from Phase 7.
  - row height/font size can feed CSS variables.

Acceptance:

- Switching repos loads each repo's own settings.
- Changes persist across webview reloads.
- Settings changes rerender without restarting the extension.
- The settings UI remains compact and does not dominate the graph.

Slice progress:

- `2026-07-27`: Hardened the all-branches graph and ref labels. The default
  revision set now explicitly includes `HEAD` with `--ignore-missing`, so a
  checked-out detached commit remains visible even when no branch or tag points
  to it. Added opt-in `repository.includeUnreachableCommits` discovery using a
  read-only `git fsck --unreachable --no-reflogs --connectivity-only` scan; it
  applies only to Show All, is persisted globally or per repository, and is
  available as a checked item in the table-header context menu. Matching local
  and remote branches on the same commit now render as one segmented badge with
  the local name followed by compact remote-name segments; every underlying ref
  retains its own tooltip, checkout behavior, and context-menu actions. The UI
  was reimplemented from this repository's own ref model after reviewing only
  the referenced project's public feature description and supplied screenshot;
  no source code from the referenced project was consulted or copied. Renamed
  the internal webview type namespace from `GG` to the project-specific `GGL`
  across declarations, runtime source, and test fixtures.

  Verification:
  - `git fetch --all --prune` (branch level with `origin/AI-dev` before work)
  - strict Biome format and lint checks over all `49` touched/new TypeScript,
    JSON, and CSS files passed with warnings treated as errors
  - `pnpm run format` reported only six pre-existing format drifts in untouched
    files: `.vscode/settings.json`, `tests/backend/avatarManager.test.ts`,
    `tests/backend/diffDocProvider.test.ts`, `tests/backend/manifest.test.ts`,
    `tests/backend/statusBarItem.test.ts`, and `tests/webview/utils/dom.test.ts`
  - `pnpm run package` passed (TypeScript, whole-tree Biome lint, and production
    extension/webview builds); the only lint output was the existing Biome
    schema-version information (`2.5.2` configuration vs `2.5.5` CLI)
  - `pnpm run test` passed: backend `42` files / `299` tests and webview `34`
    files / `283` tests
  - `pnpm run test:ext` passed all `49` extension-host tests after the extension
    test TypeScript config was given explicit local aliases compatible with
    TypeScript 6
  - `pnpm run l10n:check` passed with `100%` package and bundle coverage for
    `pl`, `zh-cn`, and `zh-tw`
  - `pnpm run test:coverage` passed: `76` files / `582` tests, with raw LCOV
    line coverage `91.9%`, branch coverage `77.7%`, and function coverage
    `89.1%`
  - `graphify update .` and `graphify tree` rebuilt the tracked map at `2,023`
    nodes / `4,758` edges and regenerated `GRAPH_TREE.html`
  - Pre-commit SonarQube scans were run from the completed working tree with
    fresh LCOV. The first scans exposed inherited maintainability findings and
    an uncovered extension-host path; both were fixed and all affected gates
    were rerun. Final task `1d55f137-4655-4902-a28d-e2af75ccf720`, analysis
    `47796099-6a08-435b-a519-551af75bfbc4`, passed the `ZAM` quality gate:
    new coverage `88.2%`, new duplicated-lines density `0.0%`, and `0` new or
    unresolved issues. Project-wide maintainability issues/effort,
    reliability issues, and security issues were also all `0`.
