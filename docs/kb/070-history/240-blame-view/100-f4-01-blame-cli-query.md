---
summary: >-
  F4-01: Read-only CLI blame query (`loadBlame`) and pure porcelain parser
  grouping lines into GitHub-style commit hunks, with safe revision
  resolution, binary/size pre-checks, `-w`/`-M`/`-C`/`--ignore-rev`/
  `--ignore-revs-file`/`--contents -` support, and real-Git fixtures.
---

# F4-01 — Blame CLI read query and porcelain parser

Status: done — awaiting integration

Needs: —

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`070-history/240-blame-view.md`) for decisions and standing rules;
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

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 02:09
- **Branch and commits:** `blame/F4-01` —
  - `6bfefb03 G docs(blame): claim slice F4-01 (F4-01)`
  - `a91384f6 G feat(blame): add blame query types (F4-01)`
  - `bdd2d0dc G feat(blame): add the CLI blame read query and porcelain parser (F4-01)`
  - `ea953c71 G feat(blame): export the blame query from the queries index (F4-01)`
  - `de83d6a8 G test(blame): cover the blame parser and query against real Git (F4-01)`
  - plus this Report commit. Every commit verified `G` with
    `git log --format='%h %G? %s' 1fe8b472..HEAD`.
- **Files changed:** `src/backend/queries/blame.ts` (new, +656),
  `src/backend/types/queries.types.ts` (+134 blame types),
  `src/backend/queries/index.ts` (new, +1),
  `tests/backend/queries/blame.test.ts` (new, +804), this slice file
  (Status + Report). Nothing outside the Touch list.
- **Tests added or changed:** new `tests/backend/queries/blame.test.ts`,
  41 tests (9 parser unit, 32 real-Git). Full suite after: backend
  114 files / 1531 passed + 60 skipped, webview 85 files / 1096 passed;
  the new file accounts for exactly 1 file / 41 tests of the backend
  count and no other test file was touched.
- **Gates:** `npx biome check --config-path biome.strict.jsonc
  --error-on-warnings` on all four touched code/test files — clean (after
  formatter-only `--write` passes); `pnpm run typecheck` — clean;
  `npx vitest run --project backend tests/backend/queries/blame.test.ts`
  — 1 file, 41 passed; `pnpm run test` — backend 114/1531 passed +
  60 skipped, webview 85/1096 passed, no failures;
  `node ./docs/kb/housekeeping.mjs --check` — exit 0;
  `pnpm run l10n:check` — complete (no user-visible strings added; backend
  only). Sonar: integrator. No Rust touched, so no engine arm. No visual
  surface, so no renders.
- **Acceptance:**
  - Query contract: met. `loadBlame(git, repo, request, record?)` returns
    `state`/`commits`/`hunks`/`resolvedRev`/`totalLines`/
    `ignoreRevsFileUsed`/`error` exactly as specified, including
    `state: null` exactly on error; hunks group by commit + origin
    `filename`/`previous`. Evidence: "blames HEAD with hunks, identities,
    boundary and previous" and the recorder test.
  - Safe option handling: met. No `--end-of-options` reaches blame; empty,
    dash-led and control-bearing `rev`/`ignoreRevs` are refused before any
    Git call; every revision is resolved through
    `git rev-parse --verify --end-of-options <rev>^{commit}` and only the
    OID is passed; `-c core.quotePath=false` and `--` always used; empty,
    NUL-bearing, absolute and traversing paths refused. Evidence: the two
    input-validation tests (including `rev: "--ignore-revs-file=/etc/passwd"`).
  - Pre-checks: met. NUL in the first 8,000 bytes → `binary`; over
    `MAX_BLAME_FILE_BYTES` (2 MiB) or `MAX_BLAME_LINES` (25,000) →
    `tooLarge`; judged from the buffer, a bounded disk read, or
    `ls-tree -l` size plus `cat-file blob` at a revision. Evidence: the
    binary/tooLarge tests in all three modes.
  - Porcelain parser: met. Pure `parseBlamePorcelain`, CRLF/LF tolerant,
    keeps tabs/UTF-8/empty content. Verification the slice asked for:
    on Git 2.56.1 `--porcelain` DOES re-emit `filename` when a later group
    of the same commit comes from another origin file (scratch `-C`
    fixture: one commit, `host.txt` then `donor.txt` then `host.txt`
    groups), so `--porcelain` suffices and `--line-porcelain` is not
    needed; the parser tracks per-group `filename`/`previous` and the
    real-Git `-C` test pins it.
  - Edge-case mapping: met. Empty → `empty`; untracked → `untracked`;
    unborn → `unborn`; broken `blame.ignoreRevsFile` config → Git's own
    error (message names the missing file), never an empty blame; bare
    with a revision works, bare working tree returns a clear error.
    Evidence: the file-states and bare/worktree suites. One verified fact
    behind the bare rule: Git 2.56.1 silently blames `HEAD` for
    `git blame -- <path>` in a bare repository (exit 0), so the refusal is
    an explicit `--is-bare-repository` probe in this query.
  - Tests: met, every fixture the slice lists (root `boundary`, rename +
    parent-blame follow-up through `previous`, working-tree and staged
    uncommitted lines, `--contents -`, `-w`, `-M`, `-C`, `--ignore-rev`,
    `--ignore-revs-file` valid/comment-only/missing, empty, binary,
    oversized by lines and by bytes, untracked, unborn, bare
    revision/working-tree/buffer, linked worktree, non-ASCII path with
    spaces, rejected dash/control revisions). Fixtures use temporary
    directories and an isolated empty global Git config only.
- **Deviations from the slice:** none in outcomes. Choices where the slice
  left room, recorded for the integrator:
  - `src/backend/queries/index.ts` did not exist (queries are imported by
    direct path everywhere); created it as the minimal barrel the Touch
    list names, re-exporting `./blame` only. `src/backend/types/index.ts`
    already re-exports `queries.types.ts`, so no edit was needed there
    (verified as the slice suggested).
  - `untracked`/`unborn` are decided by structural probes (does `HEAD`
    resolve, does its tree hold the path) instead of matching Git's
    English `fatal:` text, so a localized Git cannot break the mapping;
    the resulting states match the slice's table in every tested case. A
    consequence: an explicit `rev: "HEAD"` (or a buffer, which defaults
    to `HEAD`) for a path missing from `HEAD` also answers `untracked`,
    while any other revision answers an error.
  - A `contents` buffer is a revision blame (it always passes a resolved
    OID), so bare repositories serve it; only the true working-tree mode
    is refused there. Verified against Git 2.56.1 and pinned by test.
  - OID-shaped revisions are also resolved through `rev-parse` (the slice
    requires it for non-OID values), which additionally rejects
    non-commit OIDs up front.
  - Hunk grouping also requires consecutive final/origin line numbers, so
    `origStartLine + lineCount` never claims lines the hunk does not hold.
  - `authorMail`/`committerMail` drop porcelain's angle brackets.
  - `MAX_BLAME_FILE_BYTES` reads the slice's "2 MB" as 2 MiB
    (`2 * 1024 * 1024`), matching the codebase's byte constants.
- **Open questions / follow-ups:** none blocking. For F4-02/F4-03: heat
  input is `GitBlameCommit.authorTime` (with `committerTime` alongside);
  `previous` on the hunk (not the commit record, which is first-seen) is
  the rewind target. The request field for the Git binary path is named
  `binary`, as the slice and `runGitWithInput` name it.
