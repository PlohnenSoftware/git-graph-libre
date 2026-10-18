---
summary: >-
  D02 · wave A · ready · TypeScript · ≤220 lines: on the CLI path, list a
  stash's files the way `git stash show --include-untracked` does, instead
  of `diff-tree -m`'s one section per parent. That repeated files three and
  two times, added a foreign file, and showed an untracked file as deleted.
  The engine path is already right.
---

# D02 — Correct stash details on the CLI path

Status: ready
Needs: —
Decisions: —
Kind: TypeScript · Size budget: ≤ 220 changed lines outside tests
Source: the "Diff parity against real history" record under Phase 16, root cause 9

## Goal

When the CLI answers commit details for a stash commit, with the backend
set to `git-cli`, no engine, or an engine reroute, list exactly what
`git stash show --include-untracked --name-status` lists, in the engine's
order. No user should see a different file list depending on the backend.

## Read first

- [The agent protocol](010-agent-protocol.md)
- `src/backend/queries/commitDetails.ts` and
  `src/backend/queries/diffFileChanges.ts`
- `src/backend/queries/stashes.ts`: `loadStashes` lists `%H` and `%P`
- `src/backend/engine/index.ts`: `readCommitDetails`, which runs the CLI as
  `cliRead`
- `engine/native/core/src/details.rs`: `stash_details`, the behavior to
  match

## Facts (checked `2026-10-18` on a fixture)

- A stash commit `W` has parents `W^1` (the base), `W^2` (the index commit)
  and, with `-u`, `W^3` (the untracked files, as a root commit).
- Test case: one staged change to `shared.txt`, one unstaged change to
  `feature.txt`, one untracked file `untracked.txt`, saved with
  `git stash push -u`.
  - Today's CLI query (`diff-tree -z -r -m --root --find-renames
    --diff-filter=AMDR W`) lists `feature.txt` three times and `shared.txt`
    twice, adds a foreign `A main-only.txt`, and marks `D untracked.txt`.
  - `git stash show --include-untracked --name-status` gives
    `M feature.txt`, `M shared.txt`, `A untracked.txt`, and `--numstat`
    `1 0` for each.
- The engine lists the base-to-`W` changes, then the untracked files
  (mapped to `A`).

## Steps

1. Create `src/backend/queries/stashDetails.ts`, exporting
   `stashFileChanges(git, { stashHash, baseHash, untrackedHash, repo,
   recordGitCommand })`. It runs:
   - `git diff-tree -z -r --root --find-renames --diff-filter=AMDR
     --name-status <baseHash> <stashHash>`, and the same with `--numstat`;
   - when `untrackedHash` is set, `git diff-tree -z -r --root --name-status
     <untrackedHash>` and `--numstat <untrackedHash>`, whose entries are all
     added.

   It joins each pair with the existing `parseDiffFileChanges`, and returns
   the base changes followed by the untracked ones. Use `runGitRaw` with
   labels `stashDetails.*`.
2. In `commitDetails()`, after `fetchCommitInfo`: when the commit has two or
   more parents, look up its hash among the stashes with the existing stash
   query (or a light `git stash list --format=%H%x00%P`; reuse
   `loadStashes` if it fits). If it's a stash, use `stashFileChanges` in
   place of the two `-m` queries. Leave non-stash merges unchanged; D06
   handles them.
3. Don't change the engine path.

## Touch

`src/backend/queries/stashDetails.ts` (new), `src/backend/queries/commitDetails.ts`,
`tests/backend/queries/stashDetails.test.ts` (new; `tests/backend/queries/stashes.test.ts` shows the existing stash fixtures),
`tests/backend/engine/parity.test.ts` (one new case only)

## Tests

- `stashDetails.test.ts`, with `makeRepo()` and the fixture above: the CLI
  `commitDetails` for the stash hash gives exactly `M feature.txt 1/0`,
  `M shared.txt 1/0`, `A untracked.txt 1/0`. Also: a stash without `-u`
  (two parents), and a stash holding only a staged change.
- `parity.test.ts`: a new case comparing the engine and the CLI on the same
  stash, with identical file lists, statuses and order. Counts for untracked
  files may differ until D03; assert equality for tracked files only, and
  say so in a comment naming D03.

## Acceptance

- Gates pass. The new tests fail on the old code.
- With the backend at `git-cli`, the stash fixture shows three files in
  commit details.

## Report

_(not started)_
