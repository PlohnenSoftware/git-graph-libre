---
summary: >-
  Record of the `1.5.0` staging panel: reuses `#commitDetails`, re-queries
  after actions, drag payload format, `--untracked-files=normal`; `1.4.3` was
  never released; pnpm 12 `allowBuilds` switch; release verification.
---

# Uncommitted-changes staging panel, released as `1.5.0` (`2026-09-07`)

The staging panel closes the "uncommitted-changes details view" item Phase 10
had been carrying. What is durable about it:

- **It is the commit details row wearing a different face.** The panel is
  inserted as the same `#commitDetails` element (plus an `uncommittedDetails`
  class), and its Staged/Unstaged panes take the summary and files pane ids, so
  collapse styling, the resize handle, the height clamp and the graph's
  row-height math are inherited rather than duplicated. The price is that only
  one of the two panels can be open at a time, which is why every entry point
  hides the other first, and why `detailsHeightOwner()` can treat "whichever is
  open" as a selection rather than a precedence rule. Do not give the panel its
  own ids without also giving it its own copies of all of that.
- **The panel re-queries instead of patching.** A staging action is followed by
  the ordinary refresh, and `restoreUncommittedDetails()` re-sends
  `uncommittedDetails` after the table is rebuilt — that is what makes the
  panes show the result of the `git add`/`git reset`, and it is also what
  closes the panel when the working tree comes out clean.
- **The drag payload is `"<section> <uri-encoded path>"`.** The space separator
  is only safe because the renderer percent-encodes the path: real worktree
  paths contain spaces, and `-z` status output hands them over unquoted. Change
  both ends together or use a different encoding.
- **`--untracked-files=normal` is deliberate.** Git collapses a wholly
  untracked folder into a single `sub/` entry, and staging that row stages the
  folder (verified: `git add -- sub/` stages every file under it). `all` would
  flatten a fresh source tree into hundreds of rows without offering any choice
  the single row does not.
- **`git reset HEAD -- <paths>` is safe on an unborn branch.** Verified against
  git 2.55: unstaging the very first `git add` in a repository with no commits
  returns the file to untracked rather than failing on an unresolvable `HEAD`,
  so the unstage path needs no special case for a fresh repository.
- **The telemetry signal comes from a query route, not the load path.** Opening
  the panel is not a commit load, so `createViewFeatureReporter()` gained
  `recordUncommittedDetailsOpened()` and the `uncommittedDetails` route calls
  it. That keeps the third chokepoint the only place view features are
  reported, and the once-per-session rule and the fixed-id-only payload are
  unchanged — `msg` carries the repository path and never reaches the reporter.

**`1.4.3` was prepared but never released, and `1.5.0` is what shipped.** The
version was bumped and a dated `1.4.3` changelog section written on
`2026-09-06` (in `eb20a0a`, whose own message records that Sonar, `test:ext`
and graphify could not run in its sandbox and had to be re-run before release),
and a `1.4.3` analysis followed on the morning of `2026-09-07`. No tag, GitHub
release, or Marketplace version ever carried it. At release time the maintainer
chose `1.5.0`, so that section and the staging work were folded into one
`1.5.0` entry: the staging panel is a new feature, which makes the whole delta
since `v1.4.2` a minor rather than a patch, and a dated `1.4.3` section whose
`v1.4.2...v1.4.3` compare link 404s would be worse than one honest release
entry. Do not look for a `v1.4.3` tag — the sequence is `v1.4.2` → `v1.5.0`.

**The toolchain moved to pnpm 12 in the same line of work**, and it reverses a
narrower note from the `2026-08-25` upstream review. `package.json` pins
`pnpm@12.3.4` and `pnpm-workspace.yaml` now uses pnpm 12's `allowBuilds` map in
place of `onlyBuiltDependencies`; the lockfile carries the
`packageManagerDependencies` block pnpm 12 writes for a pinned package manager.
That block was described in `3e3ed75`'s message as an "unreviewed pnpm 10
lockfile migration" to be dropped, but **that commit's diff is the
`allowBuilds` rewrite, not a lockfile revert** — the message and the content
disagree, and the block is still there on purpose. It belongs there:
`pnpm install --frozen-lockfile`, which is exactly what the release workflow
runs, passes against this tree under pnpm 12.3.4. The earlier "leave
`pnpm-workspace.yaml` alone" decision was about pnpm 10, where
`onlyBuiltDependencies` was the current key.

Verification (`2026-09-07`), release gate for `1.5.0`:

- `git fetch --all --prune`; `AI-dev` was ahead of `origin/main` by six commits
  and a strict fast-forward, so the release is `main` moved to that exact
  commit and tagged, per the branch and release policy.
- Documentation pass over the new code before the gate: `src/backend/actions/stage.ts`
  had no comments at all (it now records why `--` is load-bearing, why a literal
  `--` path is rejected, and that the unstage path is safe on an unborn branch);
  `parseStatusEntries()`'s JSDoc was attached to the `UNMERGED_PAIRS` constant
  that had been inserted between it and the function, so it documented the wrong
  declaration; and the panel's non-obvious contracts in `src/webview/main.ts`
  (the `#commitDetails` id reuse, the re-query-not-patch refresh, the
  `"<section> <uri-encoded path>"` drag payload) were undocumented.
- Three empirical checks behind those comments, against git `2.55.0`: rename
  records really arrive as `RM new\0old\0`; `--untracked-files=normal` collapses
  a wholly untracked folder to one `sub/` row and `git add -- sub/` stages every
  file under it; `git reset HEAD -- <path>` unstages the first ever `git add` in
  a repository with no commits instead of failing on `HEAD`.
- Strict Biome (`check`, lint + format + import order, warnings as errors) over
  all 23 touched/new TypeScript files: three findings, all in the new code and
  all mechanical — import order in `src/extension/messageHandler.ts` and
  `tests/webview/uncommittedDetailsView.test.ts`, formatting in
  `tests/webview/uncommittedDetails.test.ts`. Fixed, re-run clean. Note the
  whole-tree `pnpm run lint` (migration config) passed on all three before the
  fix: it does not carry the import-order assist, so it is not a substitute for
  the strict config on new files.
- `pnpm run package` (typecheck, whole-tree lint over `235` files, production
  builds) passed.
- `pnpm run test`: backend `56` files / `443` tests, webview `47` files /
  `460` tests.
- `pnpm run test:ext`: both launches green (exit `0`), including the non-git
  workspace launch that guards BUG-5.
- `pnpm run l10n:check`: `100%` package and bundle coverage for all five
  languages (`96` package keys).
- `pnpm run test:coverage`: `103` files / `903` tests, raw LCOV line coverage
  `92.6%` (`5,721`/`6,175`).
- `pnpm install --frozen-lockfile` — the release workflow's own install step —
  passes under pnpm `12.3.4` against this tree.
- `graphify update .` + `graphify tree` rebuilt the tracked map at `2,441`
  nodes / `5,731` edges / `150` communities, closing the refresh `eb20a0a`
  deferred.
- SonarQube, two analyses and both `ZAM` **`OK`** — read them together, because
  each one's window covers only part of the release:
  - `b89d1e18-afa2-43c7-8153-50bda2cc6bbc` (labelled `1.4.3`), window
    `Previous Version` `1.4.2`: this is the analysis that measured the whole
    release — `new_coverage` `93.0`, `new_violations` `0`,
    `new_duplicated_lines_density` `0.0`, `new_software_quality_high_issues`
    `0`, maintainability rating `1`, reliability and security issues `0`.
  - task `dc7e485e-9315-41af-af83-d11a601daa3b`, analysis
    `658a233c-b8e9-4d60-aa67-be1681de1886` (labelled `1.5.0`), window
    `Previous Version` `1.4.3`: the documentation pass and Biome fixes above —
    `new_coverage` `100.0`, `new_violations` `0`, duplication `0.0`, and the
    same four project-wide conditions clean.
- Known gap, unchanged and pre-existing: `pnpm run format` reports drift in
  eight files this slice did not touch (`.vscode/settings.json`,
  `src/extension/webviewLanguages.ts`, `tests/backend/avatarManager.test.ts`,
  `tests/backend/diffDocProvider.test.ts`,
  `tests/backend/telemetry/language.test.ts`,
  `tests/webview/telemetryConsentPrompt.test.ts`,
  `tests/webview/utils/dom.test.ts`, `tests/webview/webviewPanel.test.ts`) —
  one fewer than the `2026-09-03` list, since `src/extension/webviewHtml.ts`
  was formatted in the stylesheet split. Still left for a dedicated cleanup
  slice; `pnpm run package` does not run the formatter, so it blocks nothing.
