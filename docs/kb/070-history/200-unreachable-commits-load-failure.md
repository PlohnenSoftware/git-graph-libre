---
summary: >-
  Maintainer report (`2026-11-23`, 1.10.0): enabling "Include unreachable
  commits" from the table-header menu on this repository replaces the graph
  with "Unable to load Git Graph" and ~220 KB of `unreachable ...` lines.
  Root cause: a stale base commit-graph file makes `git fsck` exit `16`,
  `simple-git` prepends `stdout` before `stderr` in `GitError.message`, and
  `loadCommits` lets `unreachableResult.error` abort an otherwise successful
  graph load. Fixed for release 1.11.0 by slice U1 (Muse Code, integrated
  `0a94f150`): `-c core.commitGraph=false`, a separated-stream `fsck` runner
  shared with `F1-07`, graceful degradation, and `git log --stdin` above 100
  extra tips.
---

# Unreachable-commits scan breaks graph load on stale commit-graph (`2026-11-23`)

**Status:** fixed — slice U1 integrated `0a94f150` on `main` (`2026-11-23`), for
release 1.11.0. Gates on `0a94f150`: strict Biome on the four touched files
clean; `pnpm run typecheck` clean; `pnpm run test` backend 1,565 and webview
1,096 passed. SonarQube runs at the release gate.

Maintainer report (`2026-11-23`): in Git Graph Libre 1.10.0 on this
repository, right-clicking the table headers and checking **Include
unreachable commits** replaced the graph with **Unable to load Git Graph**
followed by thousands of `unreachable commit/tree/blob ...` lines.

## Report and evidence

From the supplied extension log
(`git-graph-libre.log`, lines 819–860 and 942–955):

- **Environment:** Git Graph Libre `1.10.0`, VS Code Insiders
  `1.148.0-insider`, Linux `x64`, Git `2.56.1`, `backend=auto`, Rust engine
  `1.0.31`.
- **Sequence in the log:**
  1. `loadCommits` declined the engine with `reason=unreachableCommits` and
     routed to the CLI.
  2. `loadCommits.head`, `loadCommits.refs`, and `worktrees.list` all
     succeeded (`23–24 ms`).
  3. `loadCommits.unreachable` ran
     `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
     and failed in `63 ms` with `exit=(unknown)` and a ~229 KB `message`
     starting with `unreachable commit 04007573...` and ending with 60 lines
     of `error: Could not read ...` / `failed to parse commit ... from
     object database for commit-graph`.
  4. `loadCommits.log`, `loadCommits.status`, and `loadCommits.stashes`
     still ran and succeeded (`commits=250 moreAvailable=true`), yet the
     response logged `category=errorResponse` with
     `error="unreachable commit 04007573..."` and triggered a `loadRepos`
     recheck.
  5. Every subsequent refresh repeated the same failure (lines 942–955).

Read-only reproduction against this checkout at `4d7faaf3` confirmed the
exact repository trigger:

- `.git/objects/info/commit-graphs/graph-38308391affcce5b4f25b40e8aaaa138e0e8789a.graph`
  (base layer of the split commit-graph chain) still references **30
  commits** that have since been pruned from the object database.
  `git commit-graph verify` exits `1` with 30 pairs of:
  ```text
  error: Could not read <sha>
  failed to parse commit <sha> from object database for commit-graph
  ```
- Per `git-fsck(1)`, whenever `core.commitGraph` is `true` (the default),
  `git fsck` also inspects the commit-graph using `git commit-graph verify`.
- Running
  `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
  writes **3,765 lines** (`1,004` unreachable commits) to `stdout`, writes
  the 60 commit-graph error lines to `stderr`, and exits **`16`** (`0x10`,
  commit-graph verification failure).
- Running the same command with `-c core.commitGraph=false` exits **`0`**
  with empty `stderr`.

No repository files, refs, or `.git` metadata were modified during this
diagnosis.

## Root cause in Git Graph Libre

Line numbers below are from `4d7faaf3`. Three separate defects compound to
turn a non-fatal stale commit-graph into a full-screen error dump that
locks the user out of the table header:

### 1. `git fsck` runs unrelated integrity checks and discards valid `stdout` on non-zero exit

- **Where:** `getUnreachableCommitHashes()` in
  `src/backend/queries/loadCommits.ts:324-346`, invoked from
  `loadCommits()` after `loadCommitsDecline()` in
  `src/backend/engine/commits.ts:82-93` declines show-all loads with
  `unreachableCommits`.
- **What happens:** The query runs
  `["fsck", "--unreachable", "--no-reflogs", "--no-progress", "--connectivity-only"]`
  without `-c core.commitGraph=false`. Because `git fsck` is a repository
  verifier whose exit code is a bitmask of every integrity check it runs
  (including `commit-graph verify` and, on newer Git, `refs verify`), any
  stale commit-graph or unrelated repository diagnostic causes a non-zero
  exit even after `fsck` has successfully written every unreachable object
  to `stdout`. The `catch` block returns `{ value: [], error }` and discards
  all discovered commit hashes.

### 2. `simple-git` concatenates `stdout` before `stderr` into `GitError.message`

- **Where:** `runGitRaw()` (`src/backend/utils/gitRunner.ts:202-204`),
  `normalizeGitError()` (`src/backend/utils/gitRunner.ts:144-167`),
  `toGitQueryError()` (`src/backend/utils/queryError.ts:5-14`), and
  `simple-git`'s `errorDetectionPlugin`
  (`node_modules/simple-git/dist/esm/index.js:4375-4400`).
- **What happens:** `simple-git` treats any command with non-zero exit code
  and non-empty `stderr` as an error and constructs `GitError.message` via:
  ```js
  Buffer.concat([...result.stdOut, ...result.stdErr])
  ```
  It does not expose separate `stderr` or `exitCode` properties on the
  thrown `GitError`. As a result, `normalizeGitError()` records
  `exitCode: null` (logged as `exit=(unknown)`), `stderr: null`, and a
  ~220 KB `message` whose first 3,765 lines are normal `stdout`
  (`unreachable commit ...`, `unreachable tree ...`, `unreachable blob ...`),
  burying the actual `commit-graph` error at the very bottom.

### 3. Optional unreachable-scan failure aborts a successful graph load and hides the toggle

- **Where:** `loadCommits()` (`src/backend/queries/loadCommits.ts:481-525`),
  `GitGraphView.loadCommits()` (`src/webview/main.ts:1144-1158`),
  `renderShowError()` (`src/webview/main.ts:6624-6641`), and
  `toggleIncludeUnreachableCommits()` (`src/webview/main.ts:6909-6916`).
- **What happens:**
  - `loadCommits.log` still runs and loads the requested 250 commits, but
    line 524 folds `unreachableResult.error` into the top-level response
    error:
    ```ts
    const error = logResult.error ?? refsResult.error ?? unreachableResult.error ?? detachedHeadError;
    ```
    By contrast, the other two optional enrichments in the same file —
    `getOtherWorktreeHeadTips()` (`src/backend/queries/loadCommits.ts:302-322`)
    and `loadStashGraphNodes()` (`src/backend/queries/loadCommits.ts:544-559`)
    — explicitly resolve failures to empty arrays so losing optional rows
    never breaks the graph.
  - When `errorReason !== null`, `GitGraphView.loadCommits()` discards the
    loaded commits and calls `renderShowError()`, replacing `#commitTable`
    with `<h2>Unable to load Git Graph</h2>` and the entire ~220 KB
    `errorReason`.
  - Because `toggleIncludeUnreachableCommits()` persisted
    `includeUnreachableCommits: "enabled"` in the repository state before
    reloading, every subsequent refresh fails identically. Replacing the
    commit table also removes the table headers, so the user cannot turn
    the option back off from the same menu and must instead use **Settings
    → Repository** (or fix the repo's commit-graph).

## Adjacent risks found while investigating

1. **Upcoming Reflog tab slice `F1-07`:** `F1-07 — Lost-commit scan
   (opt-in)` (`docs/kb/070-history/230-reflog-tab/160-f1-07-lost-commit-scan.md`)
   plans to run the exact same
   `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
   command. It will hit the same stale-commit-graph failure and
   `stdout`-before-`stderr` error blob unless it reuses a hardened scan
   helper.
2. **Windows `argv` length limit with large unreachable sets:** this
   repository has `1,004` unreachable commits (~41 KB of hex hashes), all
   appended directly to `git log` arguments through `additionalRefs`
   (`src/backend/queries/loadCommits.ts:275,502`). That fits Linux's
   `ARG_MAX` (~2 MB), but exceeds Windows `CreateProcess`'s ~32 KB command
   line limit, where `loadCommits.log` would fail once `fsck` succeeds.
   Passing extra tips via `git log --stdin` avoids the limit on every
   platform.
3. **Git 2.48+ reference verification in `fsck`:** newer Git versions also
   run `git refs verify` during `git fsck` by default (opt-out via
   `--no-references`, which older Git versions do not recognize, whereas
   `-c core.commitGraph=false` is safe across all Git versions).

## Workarounds (before a code fix)

- **Disable the toggle in the UI:** open **Settings → Repository** and
  switch **Include unreachable commits** back off.
- **Fix a stale commit-graph in the affected repository:** run
  `git commit-graph write --reachable --changed-paths` to rebuild the
  commit-graph without pruned commit IDs. Confirmed by the maintainer on
  `2026-11-23` in this checkout: after rebuilding, `git commit-graph verify`
  passed (`1574/1574` commits, exit `0`), plain
  `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
  exited `0` with empty `stderr`, and the graph loaded with **Include
  unreachable commits** enabled.

## Proposed fix

1. **Skip commit-graph verification in the unreachable scan:** pass
   `-c core.commitGraph=false` before `fsck` so stale commit-graph files do
   not fail unreachable-commit discovery.
2. **Capture `stdout` and `stderr` separately for `fsck`:** run `fsck`
   through a dedicated spawn (similar to `runGitWithInput` in
   `src/backend/utils/gitRunner.ts` or `remoteTags.ts`, using the resolved
   `gitPath` and `cwd`) rather than `simple-git`'s `git.raw()`. Record the
   actual numeric `exitCode` and keep `stderr` separate from `stdout`.
   - If `stdout` yields valid unreachable commit hashes despite a non-zero
     `fsck` exit (unrelated integrity warnings/errors), parse and use them
     while logging the `stderr` summary rather than failing the scan.
   - If the command genuinely fails (spawn error, missing binary, fatal
     error with no usable output), surface only `stderr` (never `stdout`).
3. **Degrade gracefully on unreachable-scan failure:** match
   `getOtherWorktreeHeadTips()` and `loadStashGraphNodes()` in
   `src/backend/queries/loadCommits.ts` so a failed optional scan does not
   discard an otherwise valid `loadCommits.log` page and hide the table
   headers (log the failure, and optionally surface a non-blocking warning
   if desired).
4. **Feed large `additionalRefs` via `--stdin`:** when passing unreachable
   commit hashes to `git log`, use `--stdin` (or switch to `--stdin` above
   a safe threshold) so repositories with hundreds or thousands of
   unreachable commits work on Windows too.
5. **Share the hardened helper with `F1-07`:** have `F1-07`'s lost-commit
   scan use the same `-c core.commitGraph=false` + separated-stream `fsck`
   runner.
6. **Regression tests:** add real-Git fixture tests in
   `tests/backend/queries/loadCommits/list.test.ts` (and runner tests) for:
   - a repository with a stale/broken commit-graph entry where `git fsck`
     exits non-zero while still reporting unreachable commits on `stdout`;
   - ensuring `stdout` unreachable listings are never surfaced as the error
     message;
   - ensuring a failing unreachable scan does not discard a valid graph
     load.

## Verification of this diagnosis (`2026-11-23`)

- Read `git-graph-libre.log` lines 1–955 and end of line 832 (bytes
  184,320–229,449), confirming the exact `fsck` command, `stdout` +
  `stderr` concatenation, `commits=250`, `errorResponse`, and repeated
  failure on subsequent refreshes.
- Read `src/backend/queries/loadCommits.ts`,
  `src/backend/utils/gitRunner.ts`, `src/backend/utils/queryError.ts`,
  `src/backend/engine/commits.ts`, `src/extension/messageHandler.ts`,
  `src/webview/main.ts`, and
  `node_modules/simple-git/dist/esm/index.js:4373-4406`.
- Ran read-only Git checks on this repository:
  - `git commit-graph verify` → exit `1`, 30 missing commits in the
    commit-graph chain.
  - `git fsck --unreachable --no-reflogs --no-progress --connectivity-only`
    → exit `16`, `3,765` lines `stdout` (`1,004` unreachable commits), `60`
    lines `stderr`.
  - `git -c core.commitGraph=false fsck --unreachable --no-reflogs --no-progress --connectivity-only`
    → exit `0`, empty `stderr`.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 02:02
- **Branch and commits:** `rel-1.11.0/U1` —
  `b661e804 G docs(kb): claim unreachable scan fix (U1)`;
  `cf89e764 G fix(graph): harden the unreachable-commits fsck scan (U1)`;
  `6ae22651 G test(graph): cover the hardened unreachable scan (U1)`
  (plus this report commit)
- **Files changed:** `src/backend/queries/unreachableCommits.ts` (new, +248),
  `src/backend/queries/loadCommits.ts` (+92/−57),
  `tests/backend/queries/unreachableCommits.test.ts` (new, +177),
  `tests/backend/queries/loadCommits/list.test.ts` (+130/−3),
  this file (claim, status, report). Total before this report commit:
  5 files, +648/−61 (`git diff --stat 1fe8b472..HEAD`).
- **Tests added or changed:** 15 added, 1 updated. New
  `unreachableCommits.test.ts` (12): `classifyFsckRun` (hashes behind a
  non-zero exit kept; genuine failure built from `stderr` only; exit-code
  fallback), `summarizeFsckStderr` truncation, `discoverUnreachableCommitHashes`
  through the injected runner seam (recorded failure carries the truncated
  `stderr` summary and exit code `16`, never `stdout`; spawn failure; missing
  binary path) and through the real spawn (real dangling commit found;
  missing binary reported). `list.test.ts` (+3): stale commit-graph fixture
  (commit-graph written over a later-pruned commit; plain `git fsck` asserted
  against Git itself to exit non-zero with `commit-graph` on `stderr`, while
  `loadCommits` still loads the dangling commit), scan-failure degradation
  (missing binary keeps the page, `error` stays `null`), and 110 dangling
  commits reaching `git log` via `--stdin` with no hash on `argv`. The
  existing discovery test now threads `repo`/`gitPath` and pins the exact
  hardened `fsck` argument list. The tolerate-non-zero-with-hashes path is
  covered through the runner seam, because the real stale-commit-graph
  fixture exits `0` once `-c core.commitGraph=false` is passed — that is
  the point of proposed-fix item 1; the seam covers item 2's remaining
  non-zero cases (for example Git 2.48+ reference verification).
- **Gates:** strict Biome clean on all four touched `.ts` files
  (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`);
  `pnpm run typecheck` clean; focused
  `npx vitest run --project backend` on the two test files: 39 passed;
  whole suite `pnpm run test`: backend 114 files, 1505 passed, 60 skipped;
  webview 85 files, 1096 passed. `node ./docs/kb/housekeeping.mjs --check`
  clean (exit 0, no output). No user-visible
  strings changed, so `pnpm run l10n:check` does not apply. No webview or
  CSS change, so no headless renders. Sonar: integrator.
- **Acceptance:**
  - Item 1 (skip commit-graph verification): met — every scan runs
    `-c core.commitGraph=false` (`FSCK_UNREACHABLE_ARGS`), pinned by test.
  - Item 2 (separated streams, numeric exit code): met — dedicated async
    spawn in `unreachableCommits.ts` modeled on `remoteTags.ts` (resolved
    `gitPath`, `cwd` = repository, `windowsHide`); parseable hashes behind
    a non-zero exit are used and the recorded failure's message is the
    `stderr` summary truncated to 2,000 characters; a genuine failure
    surfaces `stderr` only.
  - Item 3 (graceful degradation): met — the scan result no longer feeds
    the `loadCommits` response error; a failed scan resolves to no extra
    rows, like `getOtherWorktreeHeadTips()`/`loadStashGraphNodes()`, with
    the failure visible in the recorded `loadCommits.unreachable` command.
  - Item 4 (`git log --stdin`): met — more than `LOG_STDIN_REF_THRESHOLD`
    (100) extra tips are fed through `--stdin` via `runGitWithInput` when
    the resolved binary and repository are threaded (the production
    caller always threads both); below the threshold, or without them,
    the tips stay on `argv` as before. Verified equivalent result sets
    against real Git; only same-timestamp tie-break order can differ.
  - Item 5 (share with F1-07): met as scoped — the helper is exported
    (`discoverUnreachableCommitHashes`, `FSCK_UNREACHABLE_ARGS`,
    `parseUnreachableCommitHashes`) with a caller-chosen command-log
    label; F1-07 itself is untouched.
  - Item 6 (regression tests): met — see Tests above, all with real-Git
    fixtures in temporary directories.
- **Deviations from the slice:** none outside the touch list. Two notes
  inside it: `src/backend/utils/gitRunner.ts` needed no change (the
  separated-stream runner lives in the new query module, and `--stdin`
  reuses the existing `runGitWithInput`), and `queryError.ts` needed no
  change. `parseUnreachableCommitHashes` moved to the new module and is
  re-exported from `loadCommits.ts` so existing importers keep working.
- **Open questions / follow-ups:** F1-07 should call
  `discoverUnreachableCommitHashes` with its own label instead of running
  `fsck` itself. The `--stdin` log path uses the existing synchronous
  `runGitWithInput` spawn, so a very large unreachable set blocks the
  extension host for the duration of that one `git log`; an async variant
  would be a separate slice if it ever matters in practice.
