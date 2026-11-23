---
summary: >-
  F2-02: the range read and preflight for interactive rebase: commits in
  `base..HEAD` with merge, published and state facts, and a "can start?" answer
  with reasons, with real-Git tests. No visible change.
---

# F2-02 — Range read and preflight

Status: ready

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

Not started.
