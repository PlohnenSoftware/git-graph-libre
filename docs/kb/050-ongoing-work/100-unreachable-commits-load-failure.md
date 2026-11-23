---
summary: >-
  Maintainer report (`2026-11-23`, 1.10.0): enabling "Include unreachable
  commits" from the table-header menu on this repository replaces the graph
  with "Unable to load Git Graph" and ~220 KB of `unreachable ...` lines.
  Root cause: a stale base commit-graph file makes `git fsck` exit `16`,
  `simple-git` prepends `stdout` before `stderr` in `GitError.message`, and
  `loadCommits` lets `unreachableResult.error` abort an otherwise successful
  graph load. Open, with proposed fixes and adjacent risks (`F1-07`, Windows
  argv limit).
---

# Unreachable-commits scan breaks graph load on stale commit-graph (`2026-11-23`)

**Status:** claimed by Muse Code on 2026-11-23 01:54

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
   (opt-in)` (`docs/kb/050-ongoing-work/080-reflog-tab/160-f1-07-lost-commit-scan.md`)
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
