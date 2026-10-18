---
summary: >-
  D03 · wave A · needs D02 · TypeScript · ≤220 lines: mark stashed untracked
  files as untracked in both backends, open their diff and file view from the
  stash's third parent (both open empty today), and count their lines on the
  engine path (null today, while Git counts them).
---

# D03 — Diff stashed untracked files from the third parent

Status: done — awaiting integration
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

- **Agent / date:** Muse Code sub-agent D03, 2026-10-19 00:17 (claimed 2026-10-19 00:09)
- **Branch and commits:** `diff-1.9.0/d03` — `71db1e0 G fix(details): diff stashed untracked files from the third parent (D03)`, plus the signed docs commit carrying this report (its own hash cannot be listed inside itself; verify with `git log --format='%h %G? %s' the-diff..HEAD`)
- **Files changed:** `src/backend/types/git.types.ts` (+2/−0), `src/backend/engine/details.ts` (+3/−2), `src/backend/engine/index.ts` (+24/−4), `src/backend/queries/stashDetails.ts` (+1/−0), `src/webview/main.ts` (+17/−4), `tests/backend/engine/details.test.ts` (+8/−1), `tests/backend/engine/parity.test.ts` (+27/−11), `tests/backend/engine/reader.test.ts` (+80/−1), `tests/backend/queries/stashDetails.test.ts` (+2/−1), `tests/webview/commitDetailsListMode.test.ts` (+77/−0), this slice file (status and report). Counts from `git diff --numstat HEAD~1..HEAD` for code and tests; 47 insertions and 10 deletions outside tests, inside the ≤220 budget.
- **Tests added or changed:** `details.test.ts` now asserts `U` maps to `{ type: "A", untracked: true }`; new `reader.test.ts` case "counts stashed untracked files from the third parent" (fake addon, 3-parent stash payload: second `loadLineCounts` with `from = null`, `to = untrackedFilesHash`); `stashDetails.test.ts` expects `untracked: true` on the untracked entry; the parity stash case now asserts full equality with counts for every file (untracked `1/0`), engine-served, D02's comments removed, plus `<W>^3` file-text checks on both arms behind `DiffDocProvider`; new webview case asserting `viewDiff` carries `oldRef: "<hash>^"`, `newRef: "<hash>^3"` and `viewFileAtRevision` carries `commitHash: "<hash>^3"` for an untracked change. Backend 866 → 867 tests, webview 590 → 591.
- **Gates:** biome pass (strict, `--error-on-warnings`, 10 touched files; one pre-existing organize-imports error in the touched `engine/details.ts` fixed by applying Biome's import order — verified present on the base file before fixing); typecheck pass; test backend 867/867 (80 files), webview 591/591 (54 files) via `pnpm run test`; l10n n/a (no user-visible text changed); kb:check pass; Rust arm n/a (no `engine/**` Rust code changed; `pnpm run engine:build` was run so the parity engine half could execute, its artifact is ignored and uncommitted); Sonar: integrator
- **Acceptance:** Gates pass — met, evidence above. On a real stash, the untracked file's diff shows its content on both backends — met at the levels a test can reach: the parity stash case builds a real `git stash push -u` fixture with `makeRepo()` and asserts `git show <W>^3:untracked.txt` returns `untracked\n` (the `DiffDocProvider` CLI arm) and the engine's `loadCommitFile` at `<W>^3` returns the same text (its engine arm), while the webview case asserts the click now sends exactly that `^3` revision; before this slice the revision sent was `<W>`, whose tree has no such file. The new and changed tests fail on the old code — verified by restoring the base sources under the new tests: 4 backend and 1 webview tests failed, all pass after the fix. The slice's test list is covered item by item as listed above, including equal untracked counts (`1/0`) in parity with D02's comment removed.
- **Deviations from the slice:** one, inside the *Touch* list. As D02's report observed, `readCommitDetails` rerouted multi-parent hashes to the CLI before its stash branch, so for a real stash (2–3 parents, confirmed on the fixture) the engine stash branch — and with it this slice's Step 2 counts — could never run through the reader; the existing fake-addon stash test hid this because its details payload has no parents. Handling: the stash lookup now runs before the reroute and only non-stash multi-parent hashes reroute, restoring the branch's documented intent (stashes diffed against their base via `load_stash_details`); non-stash merges are unchanged (D06). The new reader test pins this with a 3-parent payload, and the parity case asserts the stash read is engine-served. No other deviations; all slice facts were re-verified on a real fixture before coding (engine `U` type, base-to-stash counts omitting the untracked path, `null`-to-untracked-hash counts giving `1/0`, `<W>^3` resolving on both file-read arms).
- **Open questions / follow-ups:** none for this slice. Two adjacent behaviors intentionally left as the slice scoped them: "Compare with Working Tree" and "Reset File to Revision" for a stashed untracked file still address the stash commit rather than `^3` (the slice names only the diff and file-at-revision views).
