---
summary: >-
  D14 · wave B · needs D13 · TypeScript + webview · ≤220 lines: "Compare with
  Working Tree" for a commit, meaning every file changed between that commit
  and the files on disk, through the comparison view. The CLI runs
  `git diff <commit>`; the engine hands this read back to the CLI; each
  file's diff shows the working file on the right.
---

# D14 — Compare with the working tree

Status: claimed by Muse Code (general-purpose) sub-agent D14 on 2026-10-19 11:04
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

_(not started)_
