---
summary: >-
  F1-01: A bounded, typed CLI read of one ref's reflog entries and a pure
  classifier for reflog messages. Backend only; no visible change. Verifies
  the research's [verify] facts against real Git.
---

# F1-01 — Reflog read query

Status: done — awaiting integration

Needs: none

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`050-ongoing-work/080-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
for this slice's detailed design and the facts it marks [verify]; the Webview
UI Styling Guide (Reference) when the slice touches the webview; the Phase 16
invariants and non-goals when it touches the engine.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy Git Graph+ code (read it only if the slice says so,
and then describe rather than copy). Tests ship with behavior, using real-Git
fixtures in temporary directories only. Strict Biome on touched files, no
`var`, American English, OKLCH colors through `--ngg-*` tokens with VS Code
theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%). No new telemetry events or declarations: if a
telemetry chokepoint would count something new or a declaration must change,
stop and report. Do not bump versions or edit CHANGELOG, README or notices;
the integrator does. Report Sonar: integrator.

## Touch

`src/backend/queries/reflog.ts` (new); `src/backend/types/queries.types.ts`;
`tests/backend/queries/reflog.test.ts` (new); the slice file's Status and Report.

## Task and acceptance

- One read-only query lists a ref's reflog entries newest first, bounded by
  a limit and an offset (for paging), each with the commit hash, the selector
  index (`HEAD@{N}`), the reflog entry's own time (not the commit's), the
  identity that made the entry, and the raw message. Use `git log -g -z` with
  an explicit `--format` and parse NUL-separated records; verify the exact
  placeholders (`%gd`, `%gs`, `%gn`, `%ge`, and how to get the entry time) and
  that `--skip` works with `-g`, and record what you verified in the Report.
- Validate the ref before it reaches Git: refuse anything starting with `-`,
  pass `--end-of-options` where Git supports it, and resolve the ref first.
- Tell "no reflog for this ref" (for example `core.logAllRefUpdates=false`,
  a bare repository) from "an empty reflog" and from a real error; a failed
  read is an error, never an empty list.
- A pure `classifyReflogMessage` returns `{ kind, sub, raw }` with an open set
  of kinds (commit, checkout, reset, rebase, merge, pull, fetch, cherry-pick,
  revert, branch, stash, clone, other). It tolerates `rebase -i (pick)` and
  `rebase (pick)`, unknown text from other tools, and never throws.
- Tests: the classifier against a table of subjects captured from real Git in
  fixtures (never typed from memory); real-Git fixtures for plain commits,
  amend, rebase pick, squash and abort, fast-forward and no-ff merges,
  checkout, reset, cherry-pick, revert, detached HEAD, a linked worktree (HEAD
  reflog per worktree, branch reflog shared), `core.logAllRefUpdates=false`, a
  bare repository, an expired entry (`git reflog expire` in the fixture), a run
  with `LANG`/`LC_ALL` set to a non-English locale (do subjects stay
  English?), paging across a page boundary, and a ref starting with `-`
  refused.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Claude Sonnet (5.5), 2026-11-09 01:40
- **Branch and commits:** `reflog/F1-01`
  - `8ac09b5 G docs(kb): claim slice F1-01`
  - `37fed63 G feat(reflog): bounded reflog read query and message classifier (F1-01)`
  - `6290581 G feat(reflog): report none for an unborn HEAD instead of an error (F1-01)`
  - `02a869d G test(reflog): real-Git fixtures for the reflog query and classifier (F1-01)`
  - the report commit that follows this text
- **Files changed:** `src/backend/queries/reflog.ts` (new, +321), `src/backend/types/queries.types.ts` (+58), `tests/backend/queries/reflog.test.ts` (new, +623), this slice file.
- **Tests added or changed:** 56 tests in `tests/backend/queries/reflog.test.ts` (0 before), run three times in a row, stable. Fixtures are temporary directories with an empty global config, `GIT_CONFIG_NOSYSTEM=1` and fixed identities.
- **Gates:**
  - `npx vitest run --project backend tests/backend/queries/reflog.test.ts`: 56 passed (56).
  - `pnpm run typecheck`: clean (all three `tsc` projects).
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the three touched `.ts` files: exit 0. Biome prints an informational note that the config schema is 2.5.13 and the CLI is 2.6.5; it is not mine and not an error.
  - `node docs/kb/housekeeping.mjs --check`: exit 0, no output.
  - Sonar: integrator.
- **Acceptance:**
  - Bounded typed read, newest first, limit and offset, with hash, selector index, entry time, identity and raw message: met (`loadReflog`, `GitReflogEntry`).
  - `git log -g -z` with an explicit format, NUL records, `--skip` working with `-g`: met (paging test across and past a boundary).
  - Ref validation: leading dash refused (and any control character, empty name, hash or revision expression), nothing reaches Git (the recorder sees no command), `--end-of-options` and `--` used, the ref resolved first to its full name: met.
  - No reflog, empty and error told apart: met (tag, `core.logAllRefUpdates=false`, bare and unborn HEAD give `none`; an expired reflog gives `empty`; an unknown ref or an unreadable repository is an error).
  - Entry time is the reflog entry's own time: met (a checkout of a 2001 commit with a 2010 committer date reports 2010).
  - `classifyReflogMessage` pure, never throws, open kinds, tolerant of `rebase -i (pick)` and unknown text: met.
  - Table captured from real Git, and every listed fixture scenario: met, see Tests. The static table rows were observed in real output on Git 2.56.0; the history suite re-captures its own on every run.
- **Deviations from the slice:**
  - The entry is read twice (see the facts), so a page costs two `git log` runs, plus one `rev-parse` and, only for an empty page, one `git reflog list`.
  - `git reflog exists` could not be used: see the facts.
  - `GitReflogResult` carries `state`, `hasMore` and `ref` besides `entries` and `error`. No change to the queries index (none exists).
- **Open questions / follow-ups:**
  - No minimum Git version is recorded anywhere in the repository (confirmed: only the worktree notes say so). Required by this query: `--end-of-options` for `git log` and `rev-parse` (Git 2.24, from the docs), `--no-show-signature` (2.10), `--date=unix` (2.9), `%gd`, `%gs`, `%gn`, `%ge` (long-standing), and `git reflog list` (2.46) for telling `empty` from `none`. I did not have an older Git to run, so those versions are from documentation, not a run. On a Git without `reflog list` the query falls back to `empty` for an empty page. The maintainer should decide the minimum; if it is below 2.46 the empty/none split degrades as described, and if below 2.24 `--end-of-options` needs a replacement.
  - `--grep-reflog` (research fact 2), the exact `pull --rebase` wording across older Gits, and the cheapest reachability check (fact 7) were not in this slice and are not verified. `git cat-file --batch-check` is the F1-02 route.
  - `pnpm run typecheck` ran pnpm's automatic dependency check first and printed "Already up to date" plus two postinstall lines (`@vscode/vsce-sign`, `esbuild`) against the symlinked `node_modules`. Nothing was installed or changed (`git status` is clean of it), but the integrator may want to know pnpm tries this.
  - F1-08 will need other worktrees' HEAD reflogs: `HEAD` is per worktree, so a `loadReflog` call must run in that worktree's directory (as the test does); `wt/HEAD` is not a ref name.

### Verified Git facts (Git 2.56.0, Linux, real repositories)

- Placeholders: `%gd` (selector), `%gs` (message), `%gn` and `%ge` (identity of the entry, the committer identity at the time) all work. **`%gt` does not exist**: Git prints it literally. `%ct` and `%at` are the commit's own dates, not the entry's.
- Entry time: `%gd` under `--date=unix` prints `HEAD@{<unix seconds>}` (also `--date=raw` gives `HEAD@{ts +0000}`). That replaces the index, so the index and the time need two reads of the same page. `GIT_COMMITTER_DATE` sets the entry time. `log.date` and `log.showSignature` in config do not change `%gd`, but `log.showSignature` can add text, so `--no-show-signature` is passed.
- Selector numbers have gaps: `git log -g` and `git reflog show` skip entries (renaming the checked-out branch writes HEAD entries that are left out), so `HEAD@{N}` cannot be computed as offset plus position. Both runs list the same entries in the same order, so they pair by position and by hash.
- `--skip=N` works with `-g`, and combines with `-n`. A skip beyond the end exits 0 with no output. With `-z` and a format, each record ends with a NUL.
- `git log -g <tag>` (no reflog) exits 0 with no output, the same as an empty reflog. `git log -g nosuch` exits 128. A leading-dash ref after `--end-of-options` is treated as a bad revision (exit 128).
- `git reflog exists` reports only by exit status (1 for none), and the shared runner (`simple-git` `raw`) returns "" for a failing command with no stderr, so the status is invisible. It also wants a full ref name (`main` exits 1, `refs/heads/main` exits 0). `git reflog list` (2.46) prints every ref that has a reflog and works for the empty-or-none split. After `git reflog expire --expire=all --all` the file stays: the ref is still listed and its log is empty.
- `rev-parse --verify --quiet --symbolic-full-name --end-of-options <ref>` gives `refs/heads/main`, `refs/tags/v1`, or nothing for a hash or an expression such as `HEAD~1` or `main@{1}`. `HEAD` resolves to the branch it points at, so `HEAD` is special-cased and kept as `HEAD`. Without `--verify`, `rev-parse` echoes `--end-of-options` in its output.
- `core.logAllRefUpdates=false`: no `logs/` directory is created; `git log -g HEAD` exits 0 with nothing.
- Bare repository: `core.logAllRefUpdates` is unset; `git log -g HEAD` on an unborn HEAD exits 128 ("bad revision"); after a push, `main` has no reflog (`log -g main` exits 0 empty). An unborn HEAD in a normal repository fails the same way, so it is handled before the read.
- Worktrees: a linked worktree has its own HEAD reflog (git dir `.../.git/worktrees/<name>`), starting with `reset: moving to HEAD` and an empty-message entry at creation; branch reflogs live in the common git dir and read the same from either worktree.
- Locale: subjects stay English under `LC_ALL`/`LANG`/`LANGUAGE` set to `pl_PL.UTF-8` while Git's own output is Polish (`pl_PL.utf8` is installed here and Git has a Polish catalog). `de_DE` is not installed here, so it was not tested.
- Subjects observed on 2.56.0: `commit (initial|amend): ...`, `commit: ...`, `checkout: moving from X to Y`, `reset: moving to ...`, `rebase (start|pick|squash|fixup|reword|abort|finish): ...`, `rebase: fast-forward`, `merge X: Fast-forward`, `merge X: Merge made by the 'ort' strategy.`, `pull <args>: ...` and `pull <args> (start|pick|finish): ...` (the args from the command line are part of the subject), `fetch <args>: fast-forward`, `cherry-pick: <subject>`, `revert: Revert "..."`, `branch: Created from ...`, `Branch: renamed|copied ... to ...`, `WIP on <branch>: <hash> <subject>` and `On <branch>: <msg>` (stash), `clone: from <url>`. `rebase -i` is not written by 2.56.0 (interactive rebases write `rebase (pick)`); the classifier reads the older wording from the documentation. `merge --squash` followed by a commit writes a plain `commit:`; `update-ref -m` and `GIT_REFLOG_ACTION` write arbitrary text, classified `other`. A squash entry's message is the squash's first comment line (`rebase (squash): # This is a combination of 2 commits.`).

### Public API

- `src/backend/queries/reflog.ts`: `loadReflog(git, repo, request?: ReflogRequest, record?)` returning `GitReflogResult`; `ReflogRequest` (`ref`, `limit`, `offset`); `classifyReflogMessage(message)`; `parseReflogRecords(entryOutput, timeOutput)` and `ReflogFormatError` (exported for tests); `DEFAULT_REFLOG_PAGE_SIZE` (200) and `MAX_REFLOG_PAGE_SIZE` (1000).
- `src/backend/types/queries.types.ts`: `GitReflogEntry`, `GitReflogState`, `GitReflogResult`, `GitReflogMessageKind`, `GitReflogMessageClass`.
