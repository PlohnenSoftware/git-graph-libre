---
summary: >-
  D06 · wave A · gated on X1 · TypeScript · ≤200 lines: with X1 = first
  parent, list a merge commit's files against its first parent on the CLI,
  as the engine already does. Then lift the engine's `mergeCommit` reroute
  and say "compared with first parent" in the details. Today the second
  parent's files appear as changed and their diffs open identical.
---

# D06 — Merge commits against their first parent

Status: integrated aae87ab
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

- **Agent / date:** Muse Code sub-agent D06, 2026-10-19 01:44 (claimed 2026-10-19 01:35)
- **Branch and commits:** `diff-1.9.0/d06` — `3d3cf41 G fix(details): diff merge commits against their first parent (D06)`, `490df5e G feat(details): note first-parent comparison for merges (D06)`, plus the signed docs commit carrying this report (its own hash cannot be listed inside itself; verify with `git log --format='%h %G? %s' the-diff..HEAD`)
- **Files changed:** `src/backend/queries/commitDetails.ts` (+35/−36), `src/backend/engine/index.ts` (+5/−8), `src/webview/commitDetailsView.ts` (+10/−2), `src/extension/webviewL10n.ts` (+1/−0), `l10n/bundle.l10n.json`, `.nl`, `.pl`, `.zh-cn`, `.zh-tw` (+1/−0 each), `tests/backend/queries/commitDetails/merge.test.ts` (new, +176/−0), `tests/backend/engine/parity.test.ts` (+11/−6), `tests/backend/engine/reader.test.ts` (+13/−10), `tests/webview/commitDetailsView.test.ts` (+22/−2), this slice file (status and report). Counts from `git diff --numstat c6f2d08..HEAD`; 56 insertions and 46 deletions outside tests, inside the ≤200 budget.
- **Tests added or changed:** new `merge.test.ts` (4 cases on the slice fixture built with `makeRepo()`: only `A feature.txt` listed with `1/0` counts; the recorded `diff-tree` args are `<hash>^1 <hash>` without `-m`/`--root` for both name-status and numstat; every listed file's two `DiffDocProvider` texts — `<hash>^` against `<hash>`, the sides `viewDiff` opens — differ; the merge's first parent still lists `A main-only.txt`). The two `reader.test.ts` merge cases now assert the engine serves a two-parent payload with settled counts, no CLI read, and an `backend=engine` route line with no `reason=mergeCommit` line. The parity case is renamed "serves merges from the engine and errors unborn on both sides": it asserts the merge read is engine-served (`expectedServed` false → true), full CLI equality, and the first-parent file list (`A side.txt 1/0`). New webview case "shows the first-parent note only for a merge commit" (note present above the file list for two parents, absent for one and for zero). Backend 873 → 877 tests, webview 591 → 592.
- **Gates:** biome pass (strict, `--error-on-warnings`, 13 touched files; a pre-existing organize-imports error in the touched `tests/webview/commitDetailsView.test.ts` and format errors in the new test code fixed by applying Biome's own fixes); typecheck pass; test backend 877/877 (81 files), webview 592/592 (54 files) via `pnpm run test`, with `pnpm run engine:build` run first so the parity engine half executed instead of skipping (artifact ignored, uncommitted); l10n pass at 100% in all five bundles (615 keys each; the new string is translated in nl/pl/zh-cn/zh-tw, not copied English); kb:check pass; Rust arm n/a (no `engine/**` Rust code changed); Sonar: integrator
- **Acceptance:** Gates pass — met, evidence above. Clicking each listed file in the merge fixture opens a non-empty diff, checked by the provider's text in a test — met: `merge.test.ts` drives a real `DiffDocProvider` over a real merge repository and asserts the `<hash>^` and `<hash>` texts differ for every listed file (on the old code this case failed with `main-only.txt` reading `main only\n` on both sides). The slice's test list is covered item by item: the CLI lists only `A feature.txt` on the fixture (facts first re-verified by hand on a scratch repository: today's `-m` output lists both files, the `<hash>^1 <hash>` form lists only `feature.txt`); the engine and CLI agree on a merge and the reader no longer reroutes merges (parity + reader cases, real addon); the webview shows the note only for a multi-parent commit (webview case). New and changed tests fail on the old code — verified twice: 3 of the 4 new merge cases failed before the fix (the first-parent regression guard passed), and with the base sources restored under the updated tests, the 2 reader cases, the parity case and the webview case failed (4 tests); all pass after the fix.
- **Deviations from the slice:** one, forced by the *Touch* list. Step 3 asks for a "muted note", but no stylesheet is in *Touch*: the note renders as a `commitDetailsFirstParentNote` element with the localized text, and no CSS rule mutes it yet. Adding `color: var(--vscode-descriptionForeground, …)` (plus any spacing) for that class in `media/commit-details.css` is left to the integrator. No other deviations: every slice fact was re-verified against the current code before coding (the `-m` queries, the `parents.length > 1` reroute after D03's stash restore, `viewDiff`'s `${commitHash}^` left side), and X1 is recorded as (a).
- **Open questions / follow-ups:** two consequences of step 3's literal "more than one parent" criterion, which is all `commitDetailsView.ts` can see within *Touch* (`GitCommitDetails` carries no stash or comparison marker, and `src/webview/main.ts` is outside *Touch*): a stash's details (2–3 parents, diffed against its base — its first parent — plus untracked files from the third) will also show the note, and a commit comparison whose commit is itself a merge will show it even though its files compare the chosen refs. Suppressing the note in those two views needs a marker threaded through `main.ts` or the details type; D13's comparison header touches the same surface. The muted CSS rule above is the other follow-up.
