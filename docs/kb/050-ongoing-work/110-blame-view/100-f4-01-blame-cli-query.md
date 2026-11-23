---
summary: >-
  F4-01: Read-only CLI blame query (`loadBlame`) and pure porcelain parser
  grouping lines into GitHub-style commit hunks, with safe revision
  resolution, binary/size pre-checks, `-w`/`-M`/`-C`/`--ignore-rev`/
  `--ignore-revs-file`/`--contents -` support, and real-Git fixtures.
---

# F4-01 — Blame CLI read query and porcelain parser

Status: claimed by Muse Code on 2026-11-23 02:00

Needs: —

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for decisions and standing rules;
"Git Graph+ features and next-release additions: research and slice plan"
(Future work), subsection "Blame view" (`040-blame-view.md`), especially
section 2 (verified Git `2.56.1` behavior) and section 4.

Rules for every slice: implement from Git's documentation (`git-blame(1)`) and
this project's own patterns; never copy third-party code (GitHub, GitLens,
Git Graph+, `vscode-git-graph-rs/src` or `/web`, or post-MIT `mhutchie`).
Tests ship with behavior, using real-Git fixtures in temporary directories
only. Strict Biome on touched files, no `var`, American English, no new
telemetry events or declarations (if a telemetry chokepoint would count
something new or a declaration must change, stop and report). Do not bump
versions or edit `CHANGELOG.md`, `README.md`, or `NOTICE.md`; the integrator
does. Report Sonar: integrator.

## Touch

New `src/backend/queries/blame.ts` (query `loadBlame`, pure porcelain parser
`parseBlamePorcelain`, revision/path validators, constants
`MAX_BLAME_FILE_BYTES` = 2 MB, `MAX_BLAME_LINES` = 25,000,
`BINARY_SNIFF_BYTES` = 8,000); `src/backend/types/queries.types.ts` (new
blame types: `GitBlameRequest`, `GitBlameCommit`, `GitBlameLine`,
`GitBlameHunk`, `GitBlameState`, `GitBlameResult`);
`src/backend/queries/index.ts` (export `loadBlame` and constants/helpers);
`src/backend/types/index.ts` (if query types are re-exported there — verify);
new `tests/backend/queries/blame.test.ts`; this slice file's Status and
Report.

## Task and acceptance

- **Query contract (`loadBlame`):**
  - Accepts `git`, `repo`, `request: GitBlameRequest` (`filePath`, optional
    `rev` / `null` for working tree, optional `contents` string for unsaved
    buffer via `--contents -`, flags `ignoreWhitespace` (`-w`), `detectMoves`
    (`-M`), `detectCopies` (`-C`), `ignoreRevsFile` (`string | null`),
    `ignoreRevs` (`string[]`), `binary` git path for `runGitWithInput` when
    `contents` is provided), and optional `record?: GitCommandRecorder`.
  - Returns `GitBlameResult` with:
    - `state`: `"lines" | "empty" | "binary" | "tooLarge" | "untracked" | "unborn" | null`
      (`null` exactly when `error !== null`).
    - `commits`: map/record keyed by 40/64-hex hash containing `hash`,
      `author`, `authorMail`, `authorTime` (Unix seconds), `authorTz`,
      `committer`, `committerMail`, `committerTime`, `committerTz`, `summary`,
      `boundary` (boolean), `uncommitted` (boolean, true for the all-zero
      OID), `previous` (`{ hash: string; path: string } | null`), and
      `filename`.
    - `hunks`: contiguous runs of lines sharing the same `commitHash` and
      origin `filename`/`previous`, each with `commitHash`, `startLine`
      (1-based final line), `lineCount`, `origStartLine`, `filename`,
      `previous`, and `lines: GitBlameLine[]` (`finalLine`, `origLine`,
      `content`).
    - `resolvedRev`: resolved 40/64-hex commit OID (or `null` for working
      tree / error), `totalLines`, `ignoreRevsFileUsed` (`string | null`), and
      `error: GitQueryError | null`.
- **Safe option handling (verified on Git `2.56.1`):**
  - `git blame` does **NOT** accept `--end-of-options`. Reject any `rev` or
    `ignoreRev` that is empty, starts with `-`, or contains ASCII control
    characters. Resolve non-OID `rev` values through
    `git rev-parse --verify --end-of-options <rev>^{commit}` to a 40/64-hex
    OID before calling `git blame`. Always pass `-c core.quotePath=false` and
    separate `<filePath>` with `--`. Reject empty `filePath`, NUL bytes, or
    path traversal outside the repo (`..` segments normalized safely).
- **Pre-checks before blaming:**
  - Detect binary content (NUL byte in the first `8,000` bytes, matching
    `src/extension/diffTab/engineSource.ts`) and oversized input (`> 2 MB`
    bytes or `> 25,000` lines) from the buffer (`contents`), disk file (working
    tree), or `git cat-file -s` / `git cat-file blob` / `git show` head read
    (revision mode) so `git blame` never streams huge or binary blobs.
- **Porcelain parser (`parseBlamePorcelain`):**
  - Pure function, tolerant of CRLF/LF line endings and lines containing tabs,
    UTF-8, or empty content (`\t`).
  - Handles `--porcelain` (where commit metadata is emitted on first
    occurrence) AND tracks per-hunk `filename`/`previous` changes if `-C`/`-M`
    emits them again on later hunks from the same commit (pin with a real-Git
    `-C` copy fixture; switch to `--line-porcelain` only if `--porcelain`
    omits per-hunk `filename` changes, and record the verification in Report).
  - Groups consecutive lines with the same commit hash and origin path into
    `GitBlameHunk` entries.
- **Edge-case mapping:**
  - Empty file (exit 0, empty stdout) -> `state: "empty"`, `hunks: []`,
    `error: null`.
  - Untracked file (`fatal: no such path ... in HEAD`) -> `state: "untracked"`,
    `error: null`.
  - Unborn repository (`fatal: no such ref: HEAD`) -> `state: "unborn"`,
    `error: null`.
  - Broken repo `blame.ignoreRevsFile` config -> returns a clear `error` (note
    from Git `2.56.1` verification: neither `-c blame.ignoreRevsFile=` nor
    `--ignore-revs-file=` overrides a missing configured path; never swallow
    it as empty).
  - Bare repository with explicit `rev` -> works; bare repository without
    `rev` (working tree) -> returns a clear `error` (no working tree).
- **Tests (`tests/backend/queries/blame.test.ts`):**
  - Unit tests for `parseBlamePorcelain` (multi-hunk grouping, repeated
    commits, `boundary`, `previous`, uncommitted 40-zero OID, tabs/empty lines,
    non-ASCII paths and summaries).
  - Real-Git temporary repository fixtures covering: root commit (`boundary`,
    no `previous`), rename + edit (`previous` carries prior commit + old
    path), parent-blame follow-up using `previous`, working-tree uncommitted
    lines, unsaved buffer via `--contents -`, `-w` whitespace ignore, `-M`
    move detection, `-C` cross-file copy detection, `--ignore-rev`,
    `--ignore-revs-file` (valid, comment-only, missing), empty file, binary
    file, oversized file (injected or generated above threshold), untracked
    file, unborn repository, bare repository (revision vs working tree),
    linked worktree, non-ASCII path with spaces, and rejected leading-`-`
    revision / control-character injection.

Run focused checks fitting the change (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `npx vitest run --project backend tests/backend/queries/blame.test.ts`,
and `node ./docs/kb/housekeeping.mjs --check`) and record each command and
result. Claim and changes are separate signed commits; never push.

## Report

Not started.
