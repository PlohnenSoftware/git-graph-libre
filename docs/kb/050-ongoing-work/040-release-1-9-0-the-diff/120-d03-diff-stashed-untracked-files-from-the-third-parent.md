---
summary: >-
  D03 · wave A · needs D02 · TypeScript · ≤220 lines: mark stashed untracked
  files as untracked in both backends, open their diff and file view from the
  stash's third parent (both open empty today), and count their lines on the
  engine path (null today, while Git counts them).
---

# D03 — Diff stashed untracked files from the third parent

Status: ready
Needs: D02
Decisions: —
Kind: TypeScript (webview included) · Size budget: ≤ 220 changed lines outside tests
Source: the "Diff parity against real history" record under Phase 16, root cause 10; engine counts checked `2026-10-18`

## Goal

A stashed untracked file opens with its content, on both backends, and
carries `+N/−0` counts on both backends.

## Read first

- [The agent protocol](010-agent-protocol.md), and D02's report
- `src/backend/types/git.types.ts`: `GitFileChange`
- `src/backend/engine/details.ts`: `mapEngineFileChange`, which maps `U` to `A`
- `src/backend/engine/index.ts`: `readCommitDetails`, stash branch;
  `fillLineCounts`
- `src/webview/main.ts`: `viewGitFileDiff`, `viewGitFileAtRevision`
- `src/extension/messageHandler.ts`: `viewDiff`, which takes `oldRef`/`newRef`

## Facts (checked `2026-10-18`)

- `viewDiff` opens `<W>^` and `<W>`. An untracked file isn't in `<W>`'s
  tree, so `DiffDocProvider` serves `""`. `git show <W>:untracked.txt` fails,
  while `git show <W>^3:untracked.txt` has the content.
- The engine's `loadLineCounts(repo, baseHash, W, paths)` omits untracked
  paths, giving null counts. `git stash show -u --numstat` reports `1 0`.
  `loadLineCounts(repo, null, <untrackedHash>, paths)` diffs the untracked
  root commit against the empty tree, which yields the counts.

## Steps

1. Add an optional field to `GitFileChange`:
   `untracked?: true` ("present only in a stash's untracked-files commit").
2. Engine path:
   - `mapEngineFileChange` sets `untracked: true` for type `U`, keeping
     type `A`.
   - In the stash branch of `readCommitDetails`, also count the untracked
     paths with `addon.loadLineCounts(repo, null, stash.untrackedFilesHash,
     JSON.stringify(paths))`, and apply them. A failure follows the same
     reroute rule as `fillLineCounts`.
3. CLI path (D02's `stashDetails.ts`): set `untracked: true` on the entries
   from `untrackedHash`.
4. Webview:
   - in `viewGitFileDiff`, when the change is `untracked`, send
     `newRef: \`${hash}^3\`` and `oldRef: \`${hash}^\``;
   - in `viewGitFileAtRevision`, use `${hash}^3` for untracked changes.

## Touch

`src/backend/types/git.types.ts`, `src/backend/engine/details.ts`,
`src/backend/engine/index.ts`, `src/backend/queries/stashDetails.ts`,
`src/webview/main.ts`, `tests/backend/engine/details.test.ts`,
`tests/backend/engine/reader.test.ts`, `tests/backend/queries/stashDetails.test.ts`,
`tests/backend/engine/parity.test.ts`, `tests/webview/messageHandler.test.ts`
or `tests/webview/commitDetailsListMode.test.ts` (whichever already asserts
`viewDiff` messages)

## Tests

- `details.test.ts`: `U` maps to `{ type: "A", untracked: true }`.
- `reader.test.ts`, fake addon: the untracked counts come from a second
  `loadLineCounts` call with `from = null` and `to = untrackedFilesHash`.
- `parity.test.ts`: D02's stash case now asserts equal counts for every
  file, untracked included (`1/0`). Remove D02's comment.
- Webview: a `viewDiff` message for an untracked change carries
  `newRef: "<hash>^3"`.

## Acceptance

- Gates pass.
- On a real stash, the untracked file's diff shows its content on both
  backends. Check that `DiffDocProvider` returns the text for
  `<hash>^3:<path>` in a test.

## Report

_(not started)_
