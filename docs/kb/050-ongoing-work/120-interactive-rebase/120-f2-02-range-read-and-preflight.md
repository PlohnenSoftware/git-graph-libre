---
summary: >-
  F2-02: the range read and preflight for interactive rebase: commits in
  `base..HEAD` with merge, published and state facts, and a "can start?" answer
  with reasons, with real-Git tests. No visible change.
---

# F2-02 — Range read and preflight

Status: done — awaiting integration

Needs: none

Model: Muse Code (`muse exec --yolo`; the range read and the preflight contract are more than a mechanical slice)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 1.2 (Range read), 1.3, 2 (Worktrees) and 4 (F2-02) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. This
slice adds no user-visible string. No new telemetry events or declarations. Do
not bump versions or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/queries/rebaseRange.ts` (new)
- `src/backend/rebase/preflight.ts` (new; the preflight answer, used by F2-07)
- the query's types, in `src/backend/types/` (query types, as the other queries do)
- `src/types.ts`: the response shape, only if the webview needs it later; add the type, no UI
- `src/extension/messageHandler.ts`: register the query handler only
- `tests/backend/queries/rebaseRange.test.ts` (new, real Git) and
  `tests/backend/rebase/preflight.test.ts` (new)
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Range read.** The commits from `git log --topo-order --reverse` over
`<base>..HEAD` (or `--root` for the root case), with a NUL-delimited format
that carries full hashes, parents, author, subject and body. Parse with the
explicit format; never parse human output. Output is oldest first, the order
of the todo.

**Preflight facts**, each from Git's own data:

- `branch`: `git rev-parse --abbrev-ref HEAD`; `detached` when HEAD is not a branch.
- `dirty`: `git status --porcelain` (staged or unstaged or untracked content
  that Git refuses; untracked-only is reported separately if Git refuses it).
- `inProgress`: a rebase, merge, cherry-pick or revert state exists in the
  per-worktree git dir. Use the files `rebase-merge/` and `rebase-apply/`, and
  `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`. Never use `REBASE_HEAD`
  alone: it lingers after a successful rebase (commit `a79f444`).
- `upstream`: `git rev-parse --abbrev-ref @{upstream}`, or none.
- `isPublished` per commit: one `git rev-list <upstream>..HEAD` gives the
  unpublished set cheaply. Without an upstream, nothing is marked published
  here (F2-07 decides how to show that).
- `isMerge` per commit (more than one parent) and `mergeCount`.
- `alreadyUsedElsewhere`: whether the branch is checked out in another
  worktree, from the existing worktree data (W10, `src/types.ts`); optional
  when that data is missing, and then reported as unknown.
- A range longer than 500 commits is returned with `tooLong: true` (the
  preflight does not refuse it; F2-07 prompts).

**Result shape:** `{ commits: [{hash, subject, body, parents, isMerge, isPublished}], mergeCount, dirty, inProgress, detached, branch, upstream, alreadyUsedElsewhere, tooLong }`.

**Preflight answer:** `canStart` plus a list of reason codes (for example
`inProgress`, `emptyRange`, `dirty`). Reason codes are data; no message text here.

**Tests (real Git):** merges flagged; a root range; an empty range; a
published and local split with a bare remote (a local bare repository); a
detached HEAD; dirty states (staged, unstaged, untracked); a stale
`REBASE_HEAD` after a successful rebase is not "in progress"; a linked
worktree (its own git dir); a range over 500 commits marked `tooLong`.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run tests/backend/queries/rebaseRange.test.ts tests/backend/rebase/preflight.test.ts
```

## Report

- **Agent / date:** Muse Code (muse-wonder-full-1.0), 2026-11-23 02:14
- **Branch and commits:** `rebase/F2-02` —
  - `1769af6a G docs(rebase): claim slice F2-02 (F2-02)`
  - `e7cec4e9 G feat(rebase): add range types and the preflight answer (F2-02)`
  - `5bd6f070 G feat(backend): read the rebase range and its preflight facts (F2-02)`
  - `de6adb74 G feat(extension): register the rebaseRange query handler (F2-02)`
  - `1e186d8f G test(backend): cover every in-progress kind in the range read (F2-02)`
  - (plus this report commit)
- **Files changed:** `src/backend/queries/rebaseRange.ts` (+389, new),
  `src/backend/rebase/preflight.ts` (+38, new),
  `src/backend/types/queries.types.ts` (+86),
  `src/extension/messageHandler.ts` (+14),
  `tests/backend/queries/rebaseRange.test.ts` (+540, new),
  `tests/backend/rebase/preflight.test.ts` (+82, new), this slice file.
- **Tests added or changed:** 37 new (29 in `rebaseRange.test.ts`, 8 in
  `preflight.test.ts`); backend suite 1505 passed before (derived), 1542
  passed after. Real Git in temporary directories only, no global config.
- **Gates:** strict Biome (`biome.strict.jsonc --error-on-warnings`) on all
  6 touched code/test files: clean. `pnpm run typecheck`: pass. Slice
  tests (`npx vitest run --project backend` on the two new files): 37
  passed. Full suite (`pnpm run test`): backend 116 files, 1542 passed |
  60 skipped; webview 85 files, 1096 passed. `pnpm run kb:check`: pass.
  `pnpm run l10n:check`: complete (no strings added, verified anyway).
  Sonar: integrator. No visuals: this slice has no visible change, so no
  headless renders.
- **Acceptance:**
  - Range read (`--topo-order --reverse`, `--root` for a null base,
    NUL-delimited explicit format with hash, parents, author, subject,
    body; oldest first): met — linear, root and parent-chain tests.
  - `branch` / `detached`: met — attached, detached and unborn tests.
  - `dirty` from `git status --porcelain`, untracked apart: met — staged,
    unstaged and untracked-only tests (`dirty` = tracked changes;
    `hasUntracked` separate).
  - `inProgress` from `rebase-merge/`, `rebase-apply/`, `MERGE_HEAD`,
    `CHERRY_PICK_HEAD`, `REVERT_HEAD` in the per-worktree git dir, never
    `REBASE_HEAD` alone: met — one real-Git fixture per kind, plus the
    stale-`REBASE_HEAD` test after a successful `rebase -i`.
  - `upstream` and per-commit `isPublished` from one `rev-list`
    `<upstream>..HEAD`; nothing published without an upstream: met —
    bare-remote split test (`[true, false, false]`).
  - `isMerge` / `mergeCount`: met — merge fixture (`mergeCount` 1).
  - `alreadyUsedElsewhere` from worktree data, `"unknown"` when missing:
    met — caller-held data honored, the query lists worktrees itself
    otherwise, a failed listing reads `"unknown"`.
  - `tooLong` past 500 without refusing: met — `git fast-import` fixtures
    at 500 (`false`) and 501 (`true`).
  - Result shape and preflight answer (`canStart` plus reason codes as
    data, no message text): met — `GitRebaseRangeResult` carries the named
    shape plus the additions under Deviations; `evaluateRebasePreflight`
    is pure with 8 unit tests.
  - Linked worktree through its own git dir: met — conflict state in the
    main worktree is invisible from the linked one.
  - Clean room: implemented from Git's documentation and this project's
    patterns; the Git Graph+ research was read for behavior only, no code
    copied.
- **Deviations from the slice:**
  - `src/types.ts` untouched: the new `rebaseRange` payload already flows
    to the webview types through the existing `QueryRequest` /
    `QueryResponse` imports (typecheck and the webview suite pass), so no
    type was needed there.
  - The result carries a few fields past the named shape: `author` /
    `email` per commit (the format clause names author), `hasUntracked`
    (the "reported separately" clause), `inProgressKind`, the computed
    `preflight`, and `error` (the project query convention).
  - The branch read uses the prescribed `rev-parse --abbrev-ref HEAD`,
    with a `symbolic-ref` fallback that tells an unborn branch (where
    `rev-parse` fails, verified on Git 2.56.1) from a detached HEAD.
  - The base and the upstream are resolved to full hashes before ranging,
    so caller text never reaches Git as an option and one read sees one
    fixed pair of commits.
- **Open questions / follow-ups:**
  - A range always ends at `HEAD`, whose branch Git allows in only one
    worktree, so `alreadyUsedElsewhere: true` is reachable today mainly
    with caller-supplied data; F2-07's entries for other branches still
    need their own check.
  - The handler lets the query list worktrees on the CLI; routing that
    list through the engine-backed reader (the W10F shape) is a natural
    follow-up when F2-04 wires the UI.
  - The range is the literal `base..HEAD` the slice prescribes;
    `git rebase -i <base>` replays `merge-base..HEAD` for a non-ancestor
    base, so F2-04's entry points should offer ancestors (or accept the
    difference knowingly).
