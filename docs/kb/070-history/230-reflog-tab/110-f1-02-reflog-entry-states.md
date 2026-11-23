---
summary: >-
  F1-02: Tells for each reflog entry on a page whether its commit is reachable
  from a ref, only in the reflog, or no longer exists, so the view can mark
  recoverable rows and disable impossible actions.
---

# F1-02 — Reflog entry states

Status: integrated `2deb880`

Needs: F1-01

Model: Claude Haiku (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Reflog tab overview
(`070-history/230-reflog-tab.md`) for the decisions in force; "Git Graph+ features: research and slice plan" (Future work), subsection "Reflog tab" (`010-reflog-tab.md`), section 5
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

`src/backend/queries/reflog.ts`; `src/backend/types/queries.types.ts`;
`tests/backend/queries/reflog.test.ts`; the slice file's Status and Report.

## Task and acceptance

- For the entries of one page, compute one of three states: `reachable`
  (reachable from a branch, tag or remote-tracking ref), `reflogOnly`
  (the commit exists but only reflogs reach it) and `missing` (the object no
  longer exists). Use `git cat-file --batch-check` on stdin for existence and
  one bounded Git call for reachability (for example `git rev-list` with the
  page's hashes and `--not --branches --tags --remotes`; verify the semantics
  and record them). Keep the cost bounded to one page and measure it on this
  repository's history.
- Tests with real-Git fixtures: a hard reset leaves a `reflogOnly` commit;
  deleting a branch likewise; a commit whose reflog entries expired and whose
  objects were pruned in the fixture is `missing`; ordinary commits are
  `reachable`.

Run focused checks fitting the change (strict Biome on touched files,
`pnpm run typecheck`, the vitest files you touch, `l10n:check` when strings
change; the Rust arm and an addon rebuild when `engine/**` changes) and
record each command and result. Claim and changes are separate signed
commits; never push.

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-09 02:44. The slice names Claude Haiku; its agent died on the Claude usage limit before its first tool call (session `39eef1e9`), leaving the worktree clean at `d6e1644`. The maintainer continued that session here, and Muse Code worked the slice as agent in the same worktree, with itself as integrator.
- **Branch and commits:** `reflog/F1-02`
  - `beceaf5 G docs(kb): claim slice F1-02 (F1-02)`
  - `78a8d12 G feat(reflog): reflog entry states from cat-file and rev-list (F1-02)`
  - `6096770 G test(reflog): entry-state fixtures for reachable, reflog-only and missing (F1-02)`
  - the report commit that follows this text
- **Files changed:** `src/backend/queries/reflog.ts` (+166/−1), `src/backend/types/queries.types.ts` (+18), `tests/backend/queries/reflog.test.ts` (+129), this slice file.
- **Tests added or changed:** 5 new tests in `tests/backend/queries/reflog.test.ts` (56 before, 61 after), real-Git fixtures only: hard reset and deleted branch give `reflogOnly`; a tag-only and a remote-tracking-only commit stay `reachable`; `reflog expire` plus `gc --prune=now` gives `missing`; duplicates, non-hashes and a blob hash are ignored and the reachability call carries the expected arguments; an empty page runs no Git, and a failed read (no binary path, no repository) leaves the states unknown instead of erroring the entries.
- **Gates:**
  - New tests first, red: `npx vitest run --project backend tests/backend/queries/reflog.test.ts -t loadReflogEntryStates`: 5 failed (`loadReflogEntryStates is not a function`).
  - `npx vitest run --project backend tests/backend/queries/reflog.test.ts`: 61 passed (61).
  - `pnpm run typecheck`: clean (all three `tsc` projects).
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on the three touched `.ts` files: clean after one import-format fix. The 2.5.13 schema note against CLI 2.6.5 is informational, as in F1-01.
  - `node docs/kb/housekeeping.mjs --check`: exit 0.
  - Sonar: integrator.
- **Acceptance:**
  - Three states for one page, `reachable` / `reflogOnly` / `missing`: met (`GitReflogEntryState`, `loadReflogEntryStates`).
  - `git cat-file --batch-check` on stdin for existence and one bounded Git call for reachability, semantics verified and recorded: met. The stdin feed uses the existing `runGitWithInput` with the caller-resolved Git binary (the `commitSignatures` pattern); reachability is one `git rev-list --no-walk=unsorted <hashes> --not --branches --tags --remotes` per chunk of at most 200 hashes. See the verified facts below.
  - Cost bounded to one page and measured on this repository's history: met. A 200-entry page of this repository's own `HEAD` reflog (174 unique hashes; 1,517 commits under `--all`) costs 8.0 ms of Git time (best of 3, `cat-file` plus `rev-list`, read-only), 11 of them `reflogOnly`.
  - Real-Git fixtures for reset, deleted branch, pruned object and ordinary commits: met, plus the brief's tag-only and remote-tracking-only cases.
  - A failed state read never errors the entries: met by design — the states are a separate read, and any failure returns `states: {}` with `error` set.
- **Deviations from the slice:**
  - The state lives in a separate function over the page's hashes, not a field on `GitReflogEntry` (the dispatch brief allowed either). This matches `commitSignatures`: the page can render first, `loadReflog`'s contract and tests stay untouched, and F1-03 merges `states[entry.hash]`.
  - Without a resolved Git binary path the read reports unknown (`states: {}` with an error): the shared runner feeds stdin only through `runGitWithInput`, which needs the binary the extension resolves once from `config.gitPath()`. F1-03's handler passes it, as the `commitSignatures` handler does.
  - An existing object that is not a commit gets no state. A reflog entry's `%H` is always a commit's hash, so this only affects a caller passing other hashes; a fixture pins it with a blob.
- **Open questions / follow-ups:** none for this slice. F1-01's minimum-Git-version question still waits for the maintainer (recorded in the overview's integration log); nothing here changes it (`--batch-check` and `--no-walk` are long-standing, but no older Git was run).

### Verified Git facts (Git 2.56.0, Linux, scratch repositories)

- `git cat-file --batch-check` reads hashes from stdin and prints one line per input, in input order: `<oid> commit <size>` for an existing commit, `<input> missing` for a missing object. It exits 0 even when an input is missing, so `missing` is read from the output, never from the exit status.
- `git rev-list --no-walk=unsorted <hashes> --not --branches --tags --remotes` prints exactly the given commits that no branch, tag or remote-tracking ref reaches, and nothing else. The walking form (no `--no-walk`) agrees on which page hashes it prints, but also prints their unreachable ancestors, so its output is not bounded by the page; the `--no-walk` form's is.
- `rev-list` exits 128 when a positive hash names a missing object. Existence is therefore read first, and only hashes `cat-file` calls a commit go to the reachability read.
- With no branches, tags or remote-tracking refs at all, the same `rev-list` exits 0 and prints the hash (unreachable), so an empty ref universe needs no special case.
- A commit only a detached `HEAD` points at is printed: `HEAD` is not among `--branches --tags --remotes`. By the slice's definition it is `reflogOnly`.
- After `git reflog expire --expire=now --expire-unreachable=now --all` and `git gc --prune=now`, commits only a reflog reached report `missing`, while reachable commits are kept. A state can therefore be asked for a hash whose reflog entry is already gone; the entries of a page never are (the entry itself keeps its object until the entry expires).

### Public API

- `src/backend/queries/reflog.ts`: `loadReflogEntryStates(git, repo, hashes, gitPath?, record?)` returning `GitReflogEntryStatesResult`.
- `src/backend/types/queries.types.ts`: `GitReflogEntryState`, `GitReflogEntryStatesResult`.
