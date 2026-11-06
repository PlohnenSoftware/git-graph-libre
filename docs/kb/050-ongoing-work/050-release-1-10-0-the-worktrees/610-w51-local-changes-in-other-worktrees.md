---
summary: >-
  W51 · wave F · needs W30, Y20 · TypeScript · ~120 lines: show whether
  another worktree has uncommitted changes. It is computed on demand when the
  worktree list opens, never on every refresh: one bounded `git -C <path>
  status` per worktree, with a timeout. It warns before removal (W21) and
  marks rows (W30). Deferring it is a valid answer to Y20.
---

# W51 — Local changes in other worktrees

Status: done — awaiting integration
Needs: W30
Decisions: Y20 ((a) on demand in the list; (b) defer)
Kind: TypeScript · Size budget: ~120 changed lines outside tests
Source: full worktree support; Engine changes for worktrees (each worktree's
status needs its own index and work tree, so its own handle on the engine)

## Facts

- The uncommitted row and staging run in the selected repository only
  (`src/backend/gitClient.ts`; `src/backend/queries/uncommittedDetails.ts:79`–`:94`).
  Another worktree's state needs `git -C <path>`, or an engine handle per
  worktree, which costs memory (Engine changes for worktrees, Handles).
- `git worktree remove` already refuses a worktree with local changes, so W21
  is safe without W51. W51 only warns earlier.

## Steps for (a)

1. A read-only `worktreeStatus { paths }` runs `git -C <path> status
   --porcelain=v2 --untracked-files=normal`, a few at a time with a
   per-worktree timeout, and returns `dirty`, `clean` or `unknown` for each.
   It is CLI only: no engine handles are opened for siblings.
2. The worktree list (W30) requests it when it opens, and marks dirty rows.
   W21's confirmation names the state when it is known.
3. Tests: dirty, clean and timed-out fixtures, and the concurrency bound.

## Touch

`src/backend/queries/worktreeStatus.ts` (new), `src/backend/types/queries.types.ts`,
`src/extension/messageHandler.ts`, `src/webview/worktreeList.ts`, `tests/**`

## Acceptance

The list shows each worktree's state within the timeout. Nothing runs on an
ordinary refresh.

## Report

- **Agent / date:** Claude Haiku 5.5, 2026-11-06 15:05. Branch `wt-1.10.0/W51`, base `3da59d7`.
- **Branch and commits:** `wt-1.10.0/W51`:
  - `0f04707 G docs(worktrees): claim W51, local changes in other worktrees (W51)`
  - `85b085d G feat(worktrees): read each linked worktree's uncommitted changes on demand (W51)`
  - `6dc6bee G feat(worktrees): localize the worktree changes marks in all five bundles (W51)`
  - `933ab06 G feat(worktrees): mark each worktree row with its uncommitted changes (W51)`
  - `0de8f17 G feat(worktrees): ask for the changes when the Worktrees popup opens (W51)`
  - this report commit
- **Files changed** (`git diff --stat 3da59d7..HEAD`, +/−): `src/backend/queries/worktreeStatus.ts` +106 (new); `src/backend/types/queries.types.ts` +20; `src/extension/messageHandler.ts` +14; `src/extension/webviewL10n.ts` +6; `src/webview/worktreeList.ts` +88/−6 (mark, labels, popup request and answer); `src/webview/main.ts` +17/−1 (outside Touch, see deviations); `l10n/bundle.l10n{,.nl,.pl,.zh-cn,.zh-tw}.json` +6 each (outside Touch); tests: `tests/backend/queries/worktreeStatus.test.ts` +201 (new), `tests/webview/worktreeList.test.ts` +67/−1, `tests/webview/worktreeListPopup.test.ts` +50. Source under `src/` alone: about +258/−9, above the ~120 guide; not split.
- **Tests added or changed:** backend, 9 new in `worktreeStatus.test.ts` (dirty and clean with a space and a non-ASCII path; the path limit; an unlisted path with no read; a stale entry; a failed read; a timed-out read; a timeout where the other rows still answer; the concurrency bound; a requested spelling that differs from Git's). Webview, 4 new in `worktreeList.test.ts` (the changes mark, per state, and the rows that get none) and 2 new in `worktreeListPopup.test.ts` (asks once on open, never on a refresh, asks again on reopening; an answer for another request is dropped). Before-counts on this base were not measured, so the change is stated as the new tests only.
- **Gates:**
  - strict Biome (`--error-on-warnings`) on every touched TS file: clean. Biome prints an informational notice that `biome.strict.jsonc` carries schema 2.5.13 and the CLI is 2.6.3; this predates the slice and was not changed;
  - `pnpm run typecheck`: exit 0;
  - `pnpm run test`: backend 107 files, 1338 passed, 60 skipped (1398); webview 76 files, 954 of 954; no "Unhandled Errors";
  - `pnpm run l10n:check`: 100% for nl, pl, zh-cn and zh-tw, bundle and package.nls;
  - `pnpm run kb:check`: exit 0;
  - Sonar: integrator.
- **Acceptance:**
  - *The list shows each worktree's state within the timeout:* met. The read has a 5 s timeout (`WORKTREE_STATUS_TIMEOUT_MS`), and a timed-out or failed row shows "changes unknown". Tested with a 50 ms timeout seam.
  - *Nothing runs on an ordinary refresh:* met. The popup asks only in `show()`, and the popup test asserts that a refresh sends nothing new.
- **How the mark behaves:**
  - *clean:* a "clean" badge, when the read succeeded and found no uncommitted or untracked files;
  - *changes:* "N local changes" (singular for one), or "more than 20 local changes" past the path limit;
  - *unknown:* "changes unknown", for a failed read, a timed-out read, a stale or bare entry, or a path Git does not list;
  - *checking:* "checking changes" on each row while the answer is due, and no mark once it is not;
  - the current worktree, stale entries and bare entries get no mark.
- **Deviations from the slice:**
  1. *Files outside the Touch list, each flagged:* `src/webview/main.ts` (commit `0de8f17`, with its popup test): the handler wiring, the request on open and the response. The popup cannot receive or send without it. `l10n/bundle.l10n*.json` and `src/extension/webviewL10n.ts` (commit `6dc6bee`), which the brief names for l10n. `src/webview/worktreeList.ts` and its test went in `933ab06`, which is inside Touch.
  2. *Reuse:* the read is W21's `worktreeChanges`, called as is, with no edit to `src/backend/actions/worktree.ts`. Only a listed, non-stale, non-bare path is read.
  3. *The timeout does not stop the process:* simple-git's `raw` has no abort, so a timed-out `git status` keeps running until it ends, and its answer is dropped. Stopping it needs a spawn with a timeout, which is a larger change.
  4. *Each read lists again:* `worktreeChanges` runs `worktree list` before its status read, so a query with N paths runs N+1 listings. The popup has few worktrees, so this stays bounded.
  5. *Remove is unchanged:* the popup's Remove still asks its plain confirmation, then W21's flow reads the changes and asks again before `--force`. The mark is not used there, and the second confirmation is untouched.
  6. *Styling:* no CSS changed. Marks use the base `worktreeBadge` look, so a changes badge is not warning-coloured; a warning colour would need `media/settings.css`, outside Touch.
  7. *CHANGELOG.md:* not in Touch, so no `[1.10.0]` line. The integrator adds one if wanted.
- **Open questions / follow-ups:**
  - Should the W21 remove confirmation name the known state (the mark) before the read? Left as is.
  - Should a timed-out read kill its `git status` process? Needs a spawn with a timeout.
  - The nl, pl, zh-cn and zh-tw strings are the agent's own; a native read would help.
