---
summary: >-
  D06 · wave A · gated on X1 · TypeScript · ≤200 lines: with X1 = first
  parent, list a merge commit's files against its first parent on the CLI,
  as the engine already does. Then lift the engine's `mergeCommit` reroute
  and say "compared with first parent" in the details. Today the second
  parent's files appear as changed and their diffs open identical.
---

# D06 — Merge commits against their first parent

Status: waiting on X1
Needs: —
Decisions: X1
Kind: TypeScript (webview label included) · Size budget: ≤ 200 changed lines outside tests
Source: the "Diff parity against real history" record under Phase 16, root cause 8

## Goal

A merge's file list and its diffs agree with each other and between the
backends.

## Read first

- [The agent protocol](010-agent-protocol.md), and the answer to X1
- `src/backend/queries/commitDetails.ts`: the `-m` flag in both queries
- `src/backend/engine/index.ts`: `readCommitDetails`'s
  `details.parents.length > 1` reroute
- `src/extension/messageHandler.ts`: `viewDiff`, whose left side is
  `${commitHash}^`, the first parent

## Facts (checked `2026-10-18` on a fixture)

A clean `--no-ff` merge of a branch adding `feature.txt`, into a mainline
that added `main-only.txt`:
- today's CLI lists `A feature.txt` (from parent 1) and `A main-only.txt`
  (from parent 2);
- clicking `main-only.txt` opens `M^` against `M`, two identical sides.

## Steps (for X1 = (a); stop if X1 says otherwise)

1. CLI: for a commit with two or more parents that isn't a stash (D02
   handles stashes), diff `<hash>^1` against `<hash>` with the same flags
   minus `-m` and `--root`. Single-parent and root commits keep their
   current query.
2. Engine seam: remove the `mergeCommit` reroute, since the engine's
   `diff_commit` already diffs against the first parent.
3. Webview: when the details belong to a commit with more than one parent,
   show a muted note, `l10n.comparedWithFirstParent` ("Changes compared with
   the first parent"), in all five bundles.

## Touch

`src/backend/queries/commitDetails.ts`, `src/backend/engine/index.ts`,
`src/webview/commitDetailsView.ts`, `src/extension/webviewL10n.ts`,
`l10n/bundle.l10n*.json`, `tests/backend/queries/commitDetails/merge.test.ts`
(new, beside the existing `get.test.ts`), `tests/backend/engine/parity.test.ts`,
`tests/backend/engine/reader.test.ts`, and a webview rendering test

## Tests

- CLI: on the fixture above, the merge lists only `A feature.txt`.
- Parity: the engine and the CLI agree on that merge; the reader no longer
  reroutes merges.
- The webview shows the note only for merges.

## Acceptance

Gates pass. Clicking each listed file in the merge fixture opens a
non-empty diff (check the provider's text in a test).

## Report

_(not started)_
