---
summary: >-
  F2-10 (optional, later): route the existing drop and squash-of-selection
  actions through the interactive todo, so one rebase replaces several
  sequential runs and the HEAD-chain restriction goes. Changes two shipped
  actions, so it needs the maintainer's go-ahead. Waits for F2-05 and decision IQ10.
---

# F2-10 — Route drop and squash through the todo (optional, later)

Status: done — awaiting integration

Needs: F2-05; decision IQ10 (yes, after F2-05, with its own release note) confirmed by the maintainer

Model: Muse Code (`muse exec --yolo`)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions and clean-room
rules; research sections 2 (Related rewriting actions), 4 (F2-10) and 5 (IQ10)
of `060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config. Strict Biome on touched files, no `var`, American English. Every
user-visible string goes into all five l10n bundles, and `pnpm run l10n:check`
reports complete. No new telemetry events or declarations. Do not bump versions
or edit CHANGELOG, README or notices. Report `Sonar: integrator`.

## Touch

- `src/backend/actions/commit.ts`: `dropCommit` and `dropCommitSelection` (currently `git rebase --onto <hash>^ <hash>`), and `squashCommitSelection` (currently `git reset --soft` then `git commit`)
- `src/backend/actions/rebaseInteractive.ts`: the todo route, reused
- `src/webview/main.ts` and `src/contextMenuVisibility.ts`: only where the HEAD-chain restriction is enforced (`selectedCommitsAreLoadedHeadChain`, `main.ts:3784`), if the maintainer approves its removal
- existing action tests, re-pointed; new cases in `tests/backend/actions/`
- this slice file's `Status:` line and `## Report`

## Task and acceptance

**Scope.** The research says this changes two shipped actions and needs the
maintainer's OK before it starts. Do not start it on the agent's own judgment.

- Drop: `dropCommit` and `dropCommitSelection` run one interactive rebase
  with `drop` lines, instead of N sequential `rebase --onto` runs. The root
  and merge-commit exclusions in the menu stay until the maintainer decides.
- Squash of a selection: `pick` plus `fixup` lines through the todo, so the
  HEAD-chain restriction is no longer needed and author and hook semantics are
  those of a real rebase. The current squash dialog (textarea and "bypass
  hooks") keeps its meaning; the bypass option is not offered on the rebase
  path (the editor's rule, F2-05).
- The terminal-only interactive path stays behind the mode setting (IQ3).

**Tests.** Existing action tests re-pointed. New cases for non-HEAD ranges and
for non-contiguous selections. Real Git for every sequence.

**Release note.** The integrator writes the change into the CHANGELOG, since
this changes shipped behavior.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run <each test file touched>
pnpm run l10n:check
```

## Report

- **Agent / date:** Started/claimed by Muse Code on 2026-11-23 17:46 (interrupted by HTTP 429); taken over, fixed, verified, and completed by Gemini 4 Neon (agy), 2026-11-23 19:11
- **Branch and commits:** `rebase/F2-10` (base `68fb3f73`)
  - `4df79a96 G docs(rebase): claim F2-10 (F2-10)`
  - `ec7ae144 G feat(rebase): route drop and squash actions through interactive todo (F2-10)`
  - `4b6ba48f G test(rebase): cover todo-routed drop and squash with real Git (F2-10)`
  - `75c71cef G feat(rebase): lift HEAD-chain gate and drop hook bypass for selection actions (F2-10)`
  - plus this report/status commit
- **Files changed:** (`git diff --stat 68fb3f73..75c71cef`, excluding this slice file)
  - `src/backend/actions/commit.ts` (+249 / −35)
  - `src/backend/types/actions.types.ts` (+1 / −1)
  - `src/extension/messageHandler.ts` (+14 / −2)
  - `src/webview/main.ts` (+57 / −12)
  - `tests/backend/actions/commit/advanced.test.ts` (+107 / −41)
  - `tests/backend/actions/commit/dropSquashTodo.test.ts` (+389 / −0, new)
  - `tests/webview/rendering.test.ts` (+144 / −5)
- **Tests added or changed:**
  - `tests/backend/actions/commit/advanced.test.ts`: re-pointed the 3 existing `dropCommit`, `dropCommitSelection`, and `squashCommitSelection` tests from mocked `rebase --onto` / `reset --soft` + `commit --no-verify` to real-Git single interactive-rebase todo verification.
  - `tests/backend/actions/commit/dropSquashTodo.test.ts`: added 11 real-Git tests covering single middle/HEAD drop, non-contiguous non-HEAD multi-drop in one rebase, dropping all commits after base, dropping across a merge while refusing the merge itself, conflict pause leaving rebase state for the F2-03 banner, refusing root/short-hash/outside-HEAD/orphan commits, non-HEAD contiguous squash preserving oldest author and replaying later commits, `commit-msg` hook enforcement (pausing on rejection with no bypass), refusing non-contiguous/duplicate/cross-merge-sibling squashes, and running inside a linked worktree.
  - `tests/webview/rendering.test.ts`: re-pointed `"sends selection commit actions from the selected-row context menu"` (asserting no `bypassHooks` checkbox and no `noVerify` field on `squashCommitSelection`) and added `"offers drop and squash selection on non-HEAD ranges and drop-only on non-contiguous selections (F2-10)"` covering non-HEAD contiguous chains, non-contiguous selections, and root/outside-HEAD/merge exclusions.
  - Counts: backend `1,725` → `1,736` passed (`60` skipped in linked worktree, `127` files); webview `1,203` → `1,204` passed (`96` files).
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 7 touched `.ts` files: clean (0 errors, 0 warnings).
  - `pnpm run typecheck`: clean (`src`, `src/webview`, `tests`).
  - Focused tests: `tests/backend/actions/commit/{advanced,dropSquashTodo}.test.ts` (`18/18` passed); `tests/webview/rendering.test.ts` (`112/112` passed).
  - Full `pnpm run test`: backend `127` files, `1,736` passed / `60` skipped; webview `96` files, `1,204` passed.
  - `pnpm run l10n:check`: complete (`100%` across `nl`, `pl`, `zh-cn`, `zh-tw`; no l10n keys added or removed).
  - `node ./docs/kb/housekeeping.mjs --check`: run on this slice file update (clean).
  - Sonar: integrator.
- **Acceptance:**
  - **Drop through one interactive todo:** met — `dropCommit` and `dropCommitSelection` in `src/backend/actions/commit.ts` call `runInteractiveRebase` once with `drop` lines for selected commits and `pick` for the rest, using `git merge-base --octopus` to find the true common ancestor and omitting unselected merge commits from the linear todo. Root and merge exclusions stay enforced in both the webview menu and the backend. Proven by `advanced.test.ts` and `dropSquashTodo.test.ts`.
  - **Squash through the todo without HEAD-chain restriction or hook bypass:** met — `squashCommitSelection` builds `pick` (carrying the final message) + `fixup` lines over any unbroken single-parent chain in `HEAD`'s history, preserving the oldest commit's author and running Git hooks as a real rebase. The bypass-hooks checkbox and `noVerify` payload field are removed from the squash selection dialog/action. Proven by `dropSquashTodo.test.ts` and `rendering.test.ts`.
  - **Terminal-only interactive path preserved (IQ3):** met — `rebaseCurrentBranch` with `interactive: true` (`openInteractiveRebaseTerminal`) and the Interactive checkbox in `showRebaseDialog` are untouched.
  - **Clean-room:** Git Graph+ was read for behavior only (through the research note); no code was copied.
  - **Proposed release note (for integrator placement in `CHANGELOG.md`):**
    > - **Drop Commit, Drop Selection, and Squash Selection now run through interactive rebase**: dropping multiple commits runs a single rebase instead of one per commit and works for non-contiguous selections anywhere in `HEAD`'s history; squashing a selection now works for any contiguous chain of commits in `HEAD`'s history (not only chains ending at `HEAD`), preserves the oldest selected commit's author, runs Git hooks like a real rebase (removing the "Bypass Git hooks" option from the squash dialog), and hands off conflicts or hook pauses to the in-progress rebase banner.
- **Deviations from the slice:**
  - Minimal glue edits outside the literal Touch list: `src/extension/messageHandler.ts` threads `binary: config.gitPath()` into `dropCommit`, `dropCommitSelection`, and `squashCommitSelection` because `runInteractiveRebase` spawns Git via `runGitWithEnv` with the configured binary path; `src/backend/types/actions.types.ts` removes `noVerify: boolean` from `squashCommitSelection` to match the removed bypass-hooks checkbox.
  - No CSS or layout changes were made (only removing one existing form field from `showFormDialog`), so no headless renders were produced.
  - No new l10n keys were added (`dialog.bypassGitHooks` remains used by merge/push/tag dialogs), so no translations were required.
- **Open questions / follow-ups:**
  - None. Note for integration: the earlier interrupted Muse Code draft used `git merge-base HEAD ...selected` without `--octopus` (which picked the newest selected commit instead of the oldest for multi-commit selections) and left unselected merge commits in the todo (which Git rejects with `'pick' does not accept merge commits`); both were corrected and covered with real-Git tests before committing.
