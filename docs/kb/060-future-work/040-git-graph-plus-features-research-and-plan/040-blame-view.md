---
summary: >-
  Design and slice plan (`2026-11-23`) for Feature 4 beside the Git Graph+
  phases: a GitHub-inspired Blame view with perceptual OKLCH hotspot coloring
  for the next release. Covers clean-room boundaries, GitHub-inspired grouped
  hunk UX and heat scale, real Git 2.56.1 verification (porcelain format,
  parent-blame `previous`, binary/empty/untracked/bare/worktree/ignore-revs
  edge cases, `--end-of-options` rejection), what Git Graph Libre already has,
  slices F4-01 to F4-09, and decisions BQ1 to BQ9.
---

# Blame view (GitHub-inspired with hotspot coloring): design and slice plan

Design and planning note prepared beside the three Git Graph+ feature notes
(`010-reflog-tab.md`, `020-interactive-rebase.md`, `030-timeline.md`). Nothing
is implemented yet. All Git command behaviors below were verified in throwaway
temporary repositories on Git `2.56.1` (`commit.gpgsign=false`,
`core.quotePath=false`) on `2026-11-23`; nothing depends on unverified memory.

## 0. Provenance and clean-room boundary

- **Not from Git Graph+.** Git Graph+ (`the0807/git-graph-plus` at `c6c2a9a`)
  is not the source for this feature. The maintainer requested an additional
  Blame view for the next release inspired by **GitHub's web blame view**
  (grouped commit hunks, age/recency heat bar, and one-click parent-blame
  rewind).
- **Clean-room rule.** Every slice implements strictly from Git's documented
  `git-blame(1)` porcelain interface, VS Code's official webview/menu/command
  APIs, and Git Graph Libre's own existing patterns (the GGL Diff tab, the
  Reflog tab, and the Webview UI Styling Guide). No code, CSS, icons, or
  color literals are copied from GitHub, GitLens, Git Graph+,
  `vscode-git-graph-rs/src`, `vscode-git-graph-rs/web`, or post-MIT `mhutchie`
  sources.
- **In-house source of truth (`One name and one shape for a shared concept`).**
  Wherever the Blame view displays a concept that already exists in Git Graph
  Libre — commit hashes (`abbrevCommit` at `shortHashLength`, header `ui.commit`),
  dates (`dateFormat` through `src/webview/utils/date.ts`, header `ui.date`),
  source editor typography (`editor.fontSize`, `editor.lineHeight`,
  `editor.tabSize`, matching `diffTabPanel.ts`), resizable columns (graph &
  reflog drag interaction with 40px floor), issue linkification (`linkifyText`
  with `issueLinking`), avatars (`AvatarManager`), binary/size guards
  (`diffTab/engineSource.ts`), and OKLCH `--ngg-*` tokens over VS Code theme
  variables — it reuses the in-house name, shape, and helper from the first
  slice rather than introducing a duplicate variant.

## 1. User-facing behavior (GitHub-inspired with hotspot coloring)

### 1.1 Core layout: grouped blame hunks beside source code

Unlike inline single-line editor annotations that repeat metadata on every
line, a GitHub-inspired blame view groups consecutive lines from the same
commit (and same origin path) into **one horizontal hunk band**:

- **Left blame gutter (resizable width, saved per repository/tab state):**
  - **Hotspot / age heat rail:** a continuous vertical bar (3–4px wide) along
    the hunk boundary plus a subtle, theme-adapted background tint on the
    gutter/band, colored on a **10-step perceptual OKLCH heat scale**
    (`--ngg-blame-heat-0` coldest/oldest through `--ngg-blame-heat-9`
    hottest/newest). Uncommitted lines use the existing `--ngg-uncommitted`
    neutral identity so they never masquerade as the newest committed change.
  - **Commit header block (shown once per hunk):**
    - Commit subject (truncated to fit, full subject on hover; clickable to
      open the commit detail popover or jump to the commit in the graph).
    - Author name (with optional avatar via `AvatarManager`), short hash
      (`abbrevCommit(hash, shortHashLength)`, full hash on hover), and
      formatted date (`dateFormat` via `src/webview/utils/date.ts`, full local
      date and time on hover).
    - **"View blame prior to this change" button** (rewind/history icon) on
      every hunk where Git reports a `previous <parent-sha> <previous-path>`.
      Absent or disabled on `boundary` / file-creation hunks and uncommitted
      hunks (with an explanation tooltip).
- **Right source column:**
  - Monospaced line numbers (`tabular-nums`, clickable to highlight a line or
    open the file at that line in VS Code's editor).
  - Source code rendered with VS Code's editor font family, `editor.fontSize`,
    `editor.lineHeight`, and `editor.tabSize` (matching `diffTabPanel.ts`).
- **Same-commit highlight on hover:** hovering or focusing a hunk subtly
  highlights all other hunks in the file introduced by the same commit so the
  reader can immediately see a commit's full footprint across the file.

### 1.2 Hotspot coloring design

- **Default mode — File-relative recency heat (rank-quantile):**
  - Collect all distinct committed timestamps in the blamed file, sort them
    oldest to newest, and assign each commit to one of 10 stepped heat buckets
    (`0` = oldest through `9` = newest) by quantile rank (with a linear-span
    fallback when timestamps are identical or only 1–2 commits exist).
  - **Why rank-quantile beats naive linear span:** in real files, a single
    line from a 10-year-old initial commit stretches a linear time axis so that
    every commit from the last 12 months collapses into bucket `9`. Quantile
    ranking preserves crisp visual separation across recent edits while keeping
    strictly monotonic older → newer ordering.
- **Optional secondary modes (governed by decision `BQ2`):**
  - **Calendar age:** fixed age thresholds (`>2y`, `>1y`, `>6m`, `>90d`,
    `>30d`, `>14d`, `>7d`, `>2d`, `>24h`, `≤24h`) for cross-file age
    comparison.
  - **Churn / hotspot density:** scores each hunk by how many times its
    commit/hunk neighborhood changed relative to the file (or commit recency
    weighted by hunk frequency), surfacing high-churn hotspots at a glance.
  - **Off:** disables heat fills while keeping clean hunk dividers for
    minimal visual noise.
- **Visual palette & accessibility:**
  - All 10 steps live in `media/tokens.css` as `--ngg-blame-heat-0` through
    `--ngg-blame-heat-9` with separate dark-theme defaults and
    `body.vscode-light` overrides, plus `@media (forced-colors: active)` and
    `@media (prefers-reduced-motion: reduce)` rules.
  - Zero raw hex, RGB, HSL, or named color literals; `color-mix(in oklab, ...)`
    for translucent surface tints (per the Webview UI Styling Guide).
  - A compact legend in the sticky header (`Older` [10 swatches] `Newer`) makes
    the heat scale self-explanatory without prose.

### 1.3 Sticky header, revision rewind stack, and blame options

- **Header (pinned with `position: sticky; top: 0` and opaque
  `--vscode-editor-background`):**
  - Repository / worktree badge + repository-relative file path + current
    revision badge (`Working Tree`, `Unsaved Buffer`, `HEAD`, or short hash).
  - **Navigation stack** (`Back`, `Forward`, `Latest`): clicking "View blame
    prior to this change" pushes the current `{ rev, path, line }` onto the
    stack and loads `{ rev: previous.hash, path: previous.path }`, following
    renames automatically and scrolling to the corresponding original line.
  - **Option toggles:**
    - Ignore whitespace (`-w`).
    - Detect moved/copied lines (`-M`, `-C`).
    - `.git-blame-ignore-revs` toggle (auto-detected when present at repo root
      or configured via `blame.ignoreRevsFile`, with a visible status pill and
      removable per-session `--ignore-rev` chips).
    - Heat mode selector (`Age` / `Off`, plus optional `Calendar` / `Churn` per
      `BQ2`).
    - In-tab Find / Author filter (highlights matching lines or filters/jumps
      between hunks by author, hash, or commit summary).
  - **Open in Editor** button (opens the file at the active/scrolled line, or
    views the file at the pinned historical revision).

### 1.4 Commit popover and cross-surface actions

Clicking a hunk's commit header or opening its context menu reveals:
- Full commit details (subject + linkified body, author, committer, full hash,
  date, avatar).
- **View Blame Prior to This Change** (when `previous` exists).
- **Show Commit in Graph** (opens/reveals the graph panel for the repository
  and reveals that commit via `revealCommit`).
- **Open Diff in GGL Diff** (opens the file's commit diff in the GGL Diff tab
  when `diffTabAvailable`, falling back to `vscode.diff`).
- **Ignore Commit (This Session)** (adds `--ignore-rev <hash>` and reloads so
  the user can look behind a formatting commit in one click).
- **Copy Commit Hash** / **Copy Commit Message**.
- **Open File at Line** (opens the working file at the selected line in VS Code).

### 1.5 Entry points

1. **Command Palette:** `Git Graph Libre: Show Blame for Current File`
   (`git-graph-libre.showBlame`).
2. **Editor Title & Editor Context Menu** (`editor/title`, `editor/context`):
   blames the active file and scrolls to the current cursor line.
3. **Explorer Context Menu** (`explorer/context`, files only): blames the
   clicked file.
4. **Source Control Context Menu** (`scm/resourceState/context` for
   `workingTree` and `index` groups): blames the clicked changed file.
5. **Commit Details File Context Menu** (inside the Graph webview, gated by a
   new `commitDetailsViewFile.showBlame` visibility toggle in
   `src/contextMenuVisibility.ts`): blames the file **at that commit** (or at
   the commit's first parent using `oldFilePath` when `fileChange.type === "D"`).

### 1.6 Empty, loading, special, and error states

- **Loading:** localized loading indicator carrying a monotonic `requestId` so
  slow older loads never overwrite newer requests (same contract as Reflog tab).
- **Empty file:** distinct `empty` state ("This file has no lines to blame"),
  never shown as an error.
- **Binary file:** pre-detected (NUL byte in the first 8,000 bytes, matching
  `diffTab/engineSource.ts`) -> distinct `binary` state.
- **Too large:** files exceeding the constant size/line cap (`2 MB` or
  `25,000` lines, decision `BQ7`) -> distinct `tooLarge` state.
- **Untracked file / Unborn repository:** distinct friendly state explaining
  that the file has no commit history yet.
- **Error:** distinct error state with Git's sanitized message (for example,
  broken `blame.ignoreRevsFile` config or missing path at revision), never
  masked as empty.

## 2. Verified Git `2.56.1` behavior

Tested in temporary repositories on `2026-11-23` (`git version 2.56.1`,
`core.quotePath=false`):

1. **`--end-of-options` is NOT supported by `git blame`.** Running
   `git blame --porcelain --end-of-options HEAD -- "b file.txt"` exits `128`
   with `fatal: bad revision 'b file.txt'`. **Consequence:** never pass
   `--end-of-options` to `git blame`. Instead, validate every revision before
   calling `git blame` (reject empty strings, leading `-`, and control
   characters) and resolve non-OID refs through
   `git rev-parse --verify --end-of-options <ref>^{commit}` into a verified
   40/64-hex commit OID, which can never be parsed as an option. Always place
   `--` before the repository-relative file path.
2. **`--porcelain` vs `--line-porcelain`.** `--porcelain` emits commit metadata
   (`author`, `author-mail`, `author-time`, `author-tz`, `committer`,
   `committer-mail`, `committer-time`, `committer-tz`, `summary`, optional
   `boundary`, optional `previous <sha> <path>`, `filename <path>`) **once**
   per commit hash on first occurrence, and subsequent lines from the same
   commit emit only `<sha> <origLine> <finalLine>[ <numLines>]` plus
   `\t<content>`. This keeps stdout compact on multi-thousand-line files.
   When `-C` / `-M` is enabled, a single commit can supply lines with different
   `filename` values across hunks; `--line-porcelain` (or tracking per-hunk
   metadata in `--porcelain` when `filename`/`previous` reappears) must be
   pinned by real-Git fixtures in `F4-01`.
3. **Parent blame across renames (`previous`).** On a high-similarity rename +
   edit (`orig.txt` -> `renamed.txt`), `git blame --porcelain` emits
   `previous <parent-sha> orig.txt` alongside `filename renamed.txt`. Passing
   `<parent-sha>` and `orig.txt` back into `git blame` opens the pre-rename
   file cleanly. On a root/creation commit, Git emits `boundary` and no
   `previous` line.
4. **Working tree uncommitted lines.** Running `git blame --porcelain -- <path>`
   attributes modified/added working-tree lines to the 40-zero hash
   `0000000000000000000000000000000000000000` (`author Not Committed Yet`) and
   includes `previous <HEAD-sha> <path>`.
5. **Unsaved editor buffers (`--contents -`).** Running
   `git blame --porcelain --contents - HEAD -- <path>` with the buffer bytes on
   stdin (through `runGitWithInput`) attributes unsaved edits to the 40-zero
   hash (`author External file (--contents)`) while attributing unchanged lines
   to their real commits.
6. **Binary and empty files.** Empty files exit `0` with empty stdout. Binary
   files exit `0` and emit raw NUL bytes inside `\t<content>`; pre-checking
   binary content before spawning `git blame` is mandatory.
7. **Untracked files and unborn repositories.** Untracked files exit `128`
   (`fatal: no such path '<file>' in HEAD`); unborn repositories exit `128`
   (`fatal: no such ref: HEAD`). Both must map to clear non-crash states.
8. **Bare repositories and linked worktrees.** Linked worktrees work normally
   for both working-tree and revision blame. Bare repositories succeed when
   given a revision (e.g. `HEAD` or a commit OID) and have no working tree;
   working-tree/unsaved-buffer modes must be rejected cleanly on bare repos.
9. **`.git-blame-ignore-revs` and broken `blame.ignoreRevsFile`.** Passing
   `--ignore-rev <sha>` skips the commit and blames the prior commit. Passing
   `--ignore-revs-file <path>` fails with exit `128` if `<path>` does not
   exist. Notably, if the repository's Git config already sets
   `blame.ignoreRevsFile` to a non-existent path, Git `2.56.1` exits `128`
   (`fatal: could not open object name list: ...`) even when
   `-c blame.ignoreRevsFile=` or `--ignore-revs-file=` is passed. Therefore:
   check file existence before passing `--ignore-revs-file .git-blame-ignore-revs`,
   and surface a clear actionable error when a broken repo config blocks blame.
10. **Non-ASCII paths.** Always run with `-c core.quotePath=false` so
    `filename` and `previous` paths remain unescaped UTF-8.

## 3. What Git Graph Libre has today

- **Editor-tab webview pattern (two proven templates):**
  - GGL Diff tab (`src/diffTabTypes.ts`, `src/extension/diffTab/`,
    `src/webview/diffTab/`, `media/diff-tab/`, `out/diffTab.min.js`) — singleton
    `WebviewPanel` with `retainContextWhenHidden: true`, editor typography
    reader (`editor.fontSize`, `editor.lineHeight`, `editor.tabSize`), binary
    sniff (`8000` bytes), file-size cap, and SCM context-menu commands
    (`scmCommands.ts`).
  - Reflog tab (`src/reflogTabTypes.ts`, `src/extension/reflogTab/`,
    `src/webview/reflogTab/`, `media/reflog-tab/`, `out/reflogTab.min.js`) —
    request-id race protection, `RepoFileWatcher` live refresh, live settings
    subscription (`shortHashLength`, `dateFormat`), `ReflogDisplay` plumbing,
    shared `src/webview/utils/date.ts` formatting, and draggable column widths
    (`columnResize.ts`).
- **Backend & Git runners:**
  - `runGitRaw` and `runGitWithInput` (`src/backend/utils/gitRunner.ts`) record
    every Git command through `runGitCommand`.
  - Existing queries in `src/backend/queries/` (`commitDetails.ts`,
    `loadCommits.ts`, `reflog.ts`, `worktrees.ts`) return `{ ..., error: GitQueryError | null }`.
  - `src/backend/utils/string.ts` exports `abbrevCommit`.
- **Graph & Commit Details integration points:**
  - `src/webview/main.ts` already has `revealCommit(hash)` (line `1796`) and
    the commit details file context menu (`buildGitFileContextMenu`, line
    `7722`), gated by `src/contextMenuVisibility.ts` (`commitDetailsViewFile`).
  - `src/extension/messageHandler.ts` registers `openDiffTab` and `showReflog`.
  - `src/extension/commandManager.ts` registers palette/SCM commands and
    resolves known repositories via `findKnownRepoForPath` (longest root wins).
- **Rust engine (`engine/native/core/Cargo.toml`):**
  - Currently uses `gix = "0.90"` with features `revision`, `blob-diff`,
    `status`, `dirwalk`, `index`, `parallel`, `mailmap`, `sha1`. No `blame`
    feature is enabled yet, and `engine/Cargo.lock` contains no `gix-blame`
    crate. Any future engine blame read (`F4-09`) must follow the Phase 16
    design rules (optional addon export, CLI default and fallback, decline
    unsupported flags cleanly, cross-backend parity test).

## 4. Slice plan (temporary IDs F4-01 to F4-09)

Every slice follows the standing rules: clean-room implementation from Git docs
and this project's patterns, real-Git temporary fixtures, strict Biome on
touched files, American English, OKLCH tokens (`--ngg-*` with VS Code theme
tokens first), all five l10n bundles (`l10n:check` 100%), no unapproved
telemetry, no version/CHANGELOG/README/NOTICE edits, and headless dark/light
renders for UI slices.

| ID | Slice | Needs | Model | Size (approx) | Ships with |
| --- | --- | --- | --- | --- | --- |
| F4-01 | Blame CLI read query & porcelain parser | — | Sonnet | ~320 lines + tests | core |
| F4-02 | Hotspot age-heat & churn scoring model | F4-01 | Haiku | ~140 lines + tests | core |
| F4-03 | Blame editor-tab panel & read-only view | F4-01, F4-02 | Sonnet | ~500 lines + tests | core |
| F4-04 | Hotspot OKLCH palette, heat rail, legend & hover highlight | F4-03 | Haiku | ~160 lines + tests | core |
| F4-05 | Parent-blame rewind stack, blame flags, ignore-revs & find | F4-04 | Sonnet | ~380 lines + tests | core |
| F4-06 | Commit popover, Show in Graph, GGL Diff & Open File at Line | F4-05 | Sonnet | ~340 lines + tests | core |
| F4-07 | Editor, Explorer, SCM & Commit Details entry points | F4-06 | Sonnet | ~260 lines + tests | core |
| F4-08 | Worktrees, bare repos, unsaved buffers & live watcher refresh | F4-07 | Sonnet | ~260 lines + tests | core or follow-up |
| F4-09 | Optional: Rust engine blame read with parity tests | F4-01 | Sonnet | ~400 Rust + ~180 TS | optional (BQ8) |

### Summary of slice boundaries

- **F4-01 (backend only):** `src/backend/queries/blame.ts`,
  `src/backend/types/queries.types.ts`, `src/backend/queries/index.ts`,
  `tests/backend/queries/blame.test.ts`. Safe revision resolution, binary &
  size pre-check, `--porcelain` parser grouping consecutive lines into hunks,
  `previous`, `boundary`, uncommitted lines, `-w`/`-M`/`-C`/`--ignore-rev`/
  `--ignore-revs-file`/`--contents -`, real-Git fixtures for every verified
  Git `2.56.1` case above.
- **F4-02 (pure scoring model):** `src/blameHotspot.ts`,
  `tests/backend/blameHotspot.test.ts`. Deterministic 10-step heat bucketing
  (rank-quantile default, calendar-age helper, churn-density helper), edge
  cases (0 lines, 1 commit, equal timestamps, uncommitted lines excluded from
  heat normalization).
- **F4-03 (read-only Blame tab shell):** `src/blameTabTypes.ts`,
  `src/extension/blameTab/*`, `src/webview/blameTab/*`, `media/blame-tab/*`,
  `esbuild.js` (`blameTab.min`), `package.json`, `package.nls*.json`,
  `src/extension/commandManager.ts`, `l10n/bundle.l10n*.json`, tests, and
  headless dark/light renders. Uses `abbrevCommit`/`shortHashLength`,
  `dateFormat` + `src/webview/utils/date.ts`, `ui.commit`/`ui.date`, editor
  font/lineHeight/tabSize, and resizable gutter width from day one.
- **F4-04 (hotspot visual layer):** `media/tokens.css` (`--ngg-blame-heat-0`..`9`
  dark + light + forced-colors), `media/blame-tab/blame-tab.css`,
  `src/webview/blameTab/*`, `l10n/bundle.l10n*.json`, CSS token guard test,
  and headless dark/light renders showing the heat rail, subtle band tint,
  header legend, and same-commit hover highlight.
- **F4-05 (GitHub-style history navigation & options):** parent-blame rewind
  via `previous.hash` + `previous.path` with Back/Forward/Latest stack and
  target-line scroll preservation; `-w`, `-M`/`-C`, `.git-blame-ignore-revs`
  detection + toggle + per-session `--ignore-rev` chips; in-tab Find / Author
  filter.
- **F4-06 (commit inspection & cross-tab links):** hunk commit detail popover
  (full commit message with `linkifyText`, author/committer, avatar), "Show
  Commit in Graph" (reveals commit in main graph), "Open Diff in GGL Diff"
  (falls back to `vscode.diff`), Copy Hash/Message, and Open File at Line.
- **F4-07 (all entry points):** Editor title/context menu, Explorer context
  menu, SCM resource context menu, and Commit Details file context menu
  (`commitDetailsViewFile.showBlame` visibility toggle + deleted-file parent
  blame).
- **F4-08 (repository edge cases & live freshness):** linked worktrees, bare
  repositories, unborn repos & untracked files, unsaved dirty editor
  `--contents -` blaming with "Unsaved buffer" pill, and `RepoFileWatcher`
  refresh preserving scroll position while keeping pinned historical revisions
  stable.
- **F4-09 (optional engine acceleration):** gated on `BQ8` and profiling
  against real files. Adds `gix` blame support in `engine/native/core`,
  optional `loadBlame` N-API export, `src/backend/engine/blame.ts` with CLI
  fallback on unsupported flags, and cross-backend parity tests.

## 5. Decisions the maintainer must make

**BQ1. Where does the Blame view live?**
- (a) A dedicated editor-tab webview panel (`git-graph-libre.blameTab`, own
  bundle `out/blameTab.min.js`), modeled on GGL Diff tab and Reflog tab.
- (b) Native VS Code editor gutter decorations (`TextEditorDecorationType`).
- **Recommendation: (a).** Native editor decorations cannot render GitHub's
  grouped multi-line commit blocks, continuous vertical heat rails, clickable
  parent-blame rewind buttons, or historical revision rewinding without
  virtual documents. A dedicated editor tab delivers the full GitHub-style
  experience while offering one-click "Open File at Line".

**BQ2. Hotspot coloring scale, palette, and modes.**
- Scale: (i) file-relative rank-quantile age heat (10 steps, newest = hottest),
  (ii) linear timestamp span, or (iii) fixed calendar-age buckets.
- Modes: (a) Rank-quantile age heat + Off; (b) Rank-quantile age heat (default)
  + Calendar age + Churn/frequency hotspot + Off.
- Palette: warm amber/coral heat ramp in OKLCH (inspired by GitHub's blame
  heat bar, keeping clear of error red) vs cool-to-warm slate-to-amber ramp.
- **Recommendation:** **Rank-quantile age heat as default** with **Off** and
  optional **Calendar age** toggle, using a **warm OKLCH heat ramp** (muted
  cool-neutral oldest -> warm amber/orange newest) with dedicated dark, light,
  and forced-colors tokens.

**BQ3. Single reused Blame tab vs one tab per file.**
- (a) Single reused Blame tab (like GGL Diff tab and Reflog tab), retargeting
  on each open and carrying an in-tab Back/Forward stack.
- (b) One tab per `(repo, file)` pair.
- **Recommendation: (a)** for v1, consistent with both existing secondary tabs.

**BQ4. Syntax highlighting in the Blame tab.**
- (a) Plain monospaced source text using VS Code's editor font settings (like
  GGL Diff tab — zero new dependencies, small bundle, instant render).
- (b) Add a syntax highlighter dependency (e.g., Shiki / highlight.js).
- **Recommendation: (a)** for v1; evaluate syntax highlighting as a separate
  follow-up across both Diff tab and Blame tab together.

**BQ5. Default Git blame options and `.git-blame-ignore-revs`.**
- Auto-apply `.git-blame-ignore-revs` when present at repo root (with a
  visible header toggle chip, like GitHub), while keeping `-w`, `-M`, and `-C`
  off by default and toggleable in the header?
- **Recommendation: yes.** Matches GitHub's default behavior while keeping the
  ignored-revs state transparent and reversible in one click.

**BQ6. Blaming an unsaved dirty editor buffer.**
- When opened from an editor with unsaved edits, feed the live editor text via
  `git blame --contents -` (marking unsaved lines as uncommitted and matching
  editor line numbers exactly), or always blame disk/HEAD?
- **Recommendation: blame the live buffer via `--contents -`** with an
  "Unsaved buffer" pill and a one-click jump to `HEAD`.

**BQ7. Limits and settings.**
- Keep file-size (`2 MB`) and line-count (`25,000`) caps as documented
  constants with no new settings at first (matching RQ7 and GGL Diff tab), or
  expose settings immediately?
- **Recommendation: constants for now**, no new settings beyond the standard
  `contextMenuActionsVisibility.commitDetailsViewFile.showBlame` toggle.

**BQ8. Rust engine blame read (`F4-09`).**
- Ship CLI-only first, profile on large files (for example `src/webview/main.ts`
  at ~9,200 lines in this repository), and build `F4-09` (`gix` blame) only if
  profiling shows a clear speedup?
- **Recommendation: CLI first, profile before opening `F4-09`.** Note that
  `gix` `0.90` does not currently have a `blame` feature enabled in
  `engine/native/core/Cargo.toml`, so enabling it adds crate surface and build
  cost that should be justified by numbers.

**BQ9. Release placement and final slice IDs.**
- Ship Blame view (`F4-01`–`F4-08`) in the next feature release beside the
  Reflog tab (`F1`) or as its own following release, and whether to keep
  `F4-01`–`F4-09` or assign release-themed IDs when execution starts.
- **Recommendation:** keep `F4-01`–`F4-09` in the tailored slice register
  under `docs/kb/050-ongoing-work/110-blame-view/` until the maintainer stamps
  the release number and confirms `BQ1`–`BQ8`.
