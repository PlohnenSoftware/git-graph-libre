---
summary: >-
  D14 · wave B · needs D13 · TypeScript + webview · ≤220 lines: "Compare with
  Working Tree" for a commit, meaning every file changed between that commit
  and the files on disk, through the comparison view. The CLI runs
  `git diff <commit>`; the engine hands this read back to the CLI; each
  file's diff shows the working file on the right.
---

# D14 — Compare with the working tree

Status: integrated cda8cb7
Needs: D13
Decisions: —
Kind: TypeScript (backend and webview) · Size budget: ≤ 220 changed lines outside tests
Source: Phase 10 ("Add uncommitted-changes details and compare-to-commit")

## Goal

See everything that differs between a commit and the current files, not
just one file at a time.

## Read first

- [The agent protocol](010-agent-protocol.md), and D13's report
- `src/backend/queries/commitComparison.ts`: `requireRef`,
  `fetchComparisonDiff`
- `src/backend/engine/index.ts`: `readCommitComparison`, which reroutes
  blank refs
- `src/extension/messageHandler.ts`: `viewDiff` and
  `compareFileWithWorkingTree`, which puts `vscode.Uri.file(...)` on the
  right
- `engine/native/core/src/diff.rs`: `diff_against_worktree`, why the engine
  must not serve this one (no counts for modified files, and it lists
  untracked files that `git diff` doesn't)

## Steps

1. Use the existing uncommitted sentinel `"*"` as `compareRef` to mean the
   working tree.
   - In `commitComparison.ts`, when `compareRef === "*"`, run
     `git diff -z --find-renames --diff-filter=AMDR --name-status <baseRef>`
     (and `--numstat`) with no second revision.
   - `requireRef` still rejects blank refs.
2. In `readCommitComparison`, reroute `compareRef === "*"` to the CLI with
   reason `worktreeComparison`, logged as D01 does.
3. In `viewDiff`, when `newRef === "*"`, open the right side as the working
   file (`vscode.Uri.file`, through `resolveRepoFilePath`, as
   `compareFileWithWorkingTree` does). For a file deleted in the working
   tree, open the left side alone with `vscode.open`. Title:
   `<base> ↔ l10n diff.workingTree`.
4. Add a commit context-menu item `l10n.compareWithWorkingTree` (the
   existing key `action.compareFileWithWorkingTree` is per file; add a new
   `action.compareCommitWithWorkingTree`), behind visibility key
   `compareWithWorkingTree`. Its header label is "Working Tree".

## Touch

`src/backend/queries/commitComparison.ts`, `src/backend/engine/index.ts`,
`src/extension/messageHandler.ts`, `src/webview/main.ts`,
`src/contextMenuVisibility.ts`, `src/types.ts`, `src/extension/webviewL10n.ts`,
`l10n/bundle.l10n*.json`, `tests/backend/queries/commitComparison.test.ts`,
`tests/backend/engine/reader.test.ts`, `tests/webview/messageHandler.test.ts`,
`tests/webview/contextMenuVisibilityRendering.test.ts`

## Tests

- Real repository: modify one tracked file, delete one, and add an untracked
  one. The comparison lists the first two with counts and not the untracked
  file, matching `git diff --name-status --numstat <commit>`.
- The reader reroutes with `worktreeComparison` and never calls the
  engine's `compareCommits`.
- `viewDiff` with `newRef: "*"` opens `vscode.diff` with a `file:` URI on
  the right.

## Acceptance

Gates pass, and `l10n:check` is at 100%.

## Report

- **Agent / date:** Muse Code (general-purpose) sub-agent D14, claimed
  2026-10-19 11:04 Europe/Warsaw, report 2026-10-19 11:10. Model note:
  general-purpose on the inherited runtime model — no named-model
  selector exists in this runtime; the integrator records the constraint.
- **Branch and commits:** `diff-1.9.0/d14` — `fad16f2 G feat(compare):
  compare a commit with the working tree (D14)`, plus the signed report
  commit carrying this section. No push.
- **Files changed:** `src/backend/queries/commitComparison.ts` +11/−9,
  `src/backend/engine/index.ts` +6, `src/extension/messageHandler.ts` +41,
  `src/webview/main.ts` +27/−2, `src/contextMenuVisibility.ts` +1,
  `src/types.ts` +1, `src/extension/webviewL10n.ts` +2, each of the five
  `l10n/bundle.l10n*.json` +1, `tests/backend/queries/commitComparison.test.ts`
  +83, `tests/backend/engine/reader.test.ts` +33,
  `tests/webview/messageHandler.test.ts` +76,
  `tests/webview/contextMenuVisibilityRendering.test.ts` +79/−1; 17 files,
  366/−13 total, 105 changed lines outside tests (budget ≤220), all
  within *Touch*.
- **Tests added or changed:** `commitComparison.test.ts` 2 → 4 cases
  (commit vs working tree listing the modified and deleted files with
  Git's exact counts and never the untracked file; the swapped,
  working-tree-first form with reversed statuses/counts), all in temp
  repos via `makeRepo`; `reader.test.ts` +2 cases (either `"*"` side
  reroutes with `reason=worktreeComparison`, the engine's
  `compareCommits` is never called, the result equals the direct CLI
  read); `messageHandler.test.ts` 37 → 40 cases (`viewDiff` with
  `newRef: "*"` diffing against the `file:` URI with the Working Tree
  title, a deleted file opening its revision alone via `vscode.open`,
  the swapped `oldRef: "*"` form); `contextMenuVisibilityRendering.test.ts`
  7 → 9 cases (the commit-menu item sending `commitComparison` with
  `compareRef: "*"`, its "Working Tree" header label, file diffs
  carrying `newRef: "*"`, and the visibility setting hiding it).
  Backend total 953 → 957, webview total 673 → 678.
- **Gates:** strict Biome clean on the 16 touched code/locale/test
  files (also `lint:strict:staged` at commit); `pnpm run typecheck`
  green; full `pnpm run test` with the built engine addon
  (`engine:build` + `engine:smoke` OK at 1.0.26): backend 957/957,
  webview 678/678; `pnpm run l10n:check` 100% in all five bundles
  (the new key carries each locale's existing "Compare with Working
  Tree" rendering, no English copies); `pnpm run kb:check` green;
  `git diff --check` clean. Rust arm n/a (no `engine/**` change).
  Sonar: integrator.
- **Acceptance:** gates pass and `l10n:check` at 100% — met, numbers
  above. The named tests cover the slice's three: a real repository
  with a modified, a deleted and an untracked file lists the first two
  with counts while matching `git diff <commit>`; the reader reroutes
  `"*"` with `worktreeComparison` and never calls `compareCommits`;
  `viewDiff` with `newRef: "*"` opens `vscode.diff` with a `file:` URI
  on the right (and the revision alone when deleted). The commit-menu
  item, its `compareWithWorkingTree` visibility key (commit group,
  default `true`) and the "Working Tree" header label are covered by
  the visibility-rendering cases.
- **Deviations from the slice:** three interpretation choices, all kept
  inside *Touch*. (1) Step 1 keeps the current `--diff-filter=AMDRT`
  instead of the slice's pre-D04 `AMDR`, so type changes against the
  working tree stay listed like every other comparison. (2) D13's Swap
  puts `"*"` on the left, which the slice does not address: the backend
  answers it with `git diff -R <compareRef>`, the reader reroutes
  either `"*"` side, and `viewDiff` mirrors step 3 for `oldRef: "*"`
  (file on the left; the revision alone when the reversed type is `A`,
  i.e. deleted in the working tree). (3) D13 travels labels as refs, so
  `viewGitFileDiff` pins a `"*"` side to itself instead of sending its
  "Working Tree" display label as a revision; the handler titles it
  from `diff.workingTree`, newly exposed to the webview as
  `l10n.workingTree` for the header (the menu item is the new
  `action.compareCommitWithWorkingTree` behind
  `l10n.compareWithWorkingTree`, as the slice names it).
- **Open questions / follow-ups:** inside a working-tree comparison,
  the per-file "View File at Revision" and "Compare with Working Tree"
  actions still resolve the new side as revision `"*"` (outside this
  slice's steps; a small follow-up could open the working file there).
  Integrator: full gate with coverage and Sonar; `src/webview/main.ts`
  hunks sit near, but do not share lines with, D13F's two swap-area
  fixes — expect a textual-adjacency merge at worst.
