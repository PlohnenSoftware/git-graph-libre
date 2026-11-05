---
summary: >-
  W31 · wave E · needs W10 · TypeScript + manifest · ~180 lines: open a
  worktree in a new window or this one (`vscode.openFolder`, new to the
  extension), add it to the workspace, reveal it in the OS, or switch the
  graph to it, adding it to the repository list as the Source Control
  button's fix for #32 does. Used by W11's marker, W20's "Open Worktree…",
  W22's finish step and W30's rows.
---

# W31 — Open a worktree or switch the graph to it

Status: done — awaiting integration
Needs: W10
Decisions: —
Kind: TypeScript, manifest and l10n · Size budget: ~180 changed lines outside
tests
Source: full worktree support; the TypeScript worktree map (`2026-11-04`),
"Command surface"

## Facts (checked `2026-11-04`, `c47207e`)

- No `vscode.openFolder` or new-window code exists yet.
- `openSourceControlRepo()` (`src/extension/commandManager.ts:223`–`:246`)
  shows how to focus a known repository, or resolve an unknown one with
  `--show-toplevel`, `addRepo` and focus it.
- A repository added that way stays CLI-only until the next scan marks it
  verified (`isVerified`). That is correct, and stays.

## Steps

1. Webview messages, and matching hidden commands so other entry points can
   reuse them:
   - `openWorktree { path, newWindow }` runs `vscode.openFolder` with
     `forceNewWindow`;
   - `addWorktreeToWorkspace { path }` runs `updateWorkspaceFolders`;
   - `revealWorktree { path }` runs `revealFileInOS`;
   - `switchGraphToWorktree { path }` follows the `openSourceControlRepo`
     flow.
2. Guard each path against the worktree list before acting, so a stale UI
   can't open a removed path. A prunable path offers Repair (W21) instead.
3. Register the commands in `package.json` and `package.nls*.json`, hidden
   from the Command Palette unless there is a reason to show them, with
   command telemetry through `register()` as today.
4. Tests: each message's VS Code call, mocked; the stale-path guard; switch
   on an unknown worktree adds and focuses it.

## Integrator addition (`2026-11-05`)

W21 built the prune flow (a webview preview dialog and the
`pruneWorktrees` action), but could not add Y5 (b)'s Command Palette entry:
its Touch list had no manifest. This slice edits `package.json` anyway, so
it also contributes **"Git Graph Libre: Prune Stale Worktrees…"**
(`git-graph-libre.pruneStaleWorktrees`) with its `package.nls*` title. It
opens the same preview for the active graph's repository, or says that
none is open. Add a test.

## Touch

`src/extension/messageHandler.ts`, `src/extension/commandManager.ts`,
`package.json`, `package.nls*.json`, `src/webview/main.ts` (callers only),
`tests/**`

## Acceptance

Every open and switch path works on main and linked worktrees, and refuses a
path Git no longer lists.

## Report

- **Agent / date:** Claude Haiku 5.5 (claim, message types, and the command
  core, left uncommitted by a rate limit), continued and finished by Muse
  Code powered by muse-wonder-full-1.0, 2026-11-05 19:09. The uncommitted
  core was reviewed and kept: only the `vscode.openFolder` argument changed
  to the `{ forceNewWindow }` form the slice names, plus formatting.
- **Branch and commits:** `wt-1.10.0/W31` —
  `2fab5de G docs(worktrees): claim W31, open a worktree or switch the graph to it (W31)`;
  `4a9911b G feat(worktrees): message types for opening a worktree and the palette prune (W31)`;
  `b741064 G feat(worktrees): open, add, reveal or switch to a worktree, and the palette prune (W31)`;
  `b711725 G feat(worktrees): Open Worktree opens a new window; palette prune opens the preview (W31)`;
  `30ad2db G test(worktrees): cover the open commands, the stale guard and the palette prune (W31)`;
  `d506676 G refactor(worktrees): keep the VS Code folder factory module-private (W31)`;
  plus the signed commit carrying this report.
- **Files changed:** 22 files against `c5f572e`, +588/−19 before this
  report commit (`git diff --numstat`): the slice file (+1/−1, then this
  report), `src/extension/commandManager.ts` (+129),
  `src/extension/messageHandler.ts` (+14), `src/webview/main.ts` (+28/−4),
  `package.json` (+41), five `package.nls*.json` (+5 each), five
  `l10n/bundle.l10n*.json` (+12/−1 each),
  `src/backend/types/actions.types.ts` (+9), `src/types.ts` (+10/−1),
  `src/extension/webviewPanel.ts` (+4), `src/extension/webviewL10n.ts`
  (+5), and tests `tests/webview/commandManager.test.ts` (+191/−3),
  `tests/webview/worktreeHandlers.test.ts` (+49/−1),
  `tests/webview/branchWorktreeActions.test.ts` (+22/−4). Outside tests
  the slice ran past its ~180-line guide, mostly the five-language strings
  in ten JSON files and the folded-in palette prune.
- **Tests added or changed:** 10 new cases and 1 updated case. Command tests
  (real-Git temporary fixtures, a worktree path with a space and an accent,
  mocked `WorktreeFolderApi`): open main and linked; add to workspace and
  the already-there note; reveal; switch to an unknown worktree adds and
  focuses it; switch to a known one; not-listed, stale and malformed
  refusals; palette prune with and without a graph. Handler test: each open
  message forwards to its hidden command. Webview tests: "Open Worktree…"
  now sends `openWorktree` (was Copy Path); the palette preview opens and
  says when nothing is stale. Counts: backend 1,257 passed / 60 skipped
  before and after; webview 851 passed before, 861 after. Focused run of
  the three touched files: 77 passed.
- **Gates:** strict Biome
  (`biome check --config-path biome.strict.jsonc --error-on-warnings`) on
  all 21 touched `.ts`/`.json` files: clean. `pnpm run typecheck`: exit 0.
  `pnpm run test`: backend 101 files, 1,257 passed, 60 skipped; webview 68
  files, 861 passed. `pnpm run l10n:check`: complete in every language.
  `pnpm run kb:check`: exit 0. No `engine/**` change, so no Rust arm.
  Sonar: integrator.
- **Acceptance:** met. Every open and switch path is exercised on main and
  linked worktrees through the mocked folder API (add and reveal on a
  linked worktree; all four share the one guard), and a path Git no longer
  lists — or lists as prunable — is refused before any VS Code call
  (command tests above). Step 1's four messages run as the four hidden
  commands; Step 3's commands are registered with palette hiding and
  `register()` telemetry; the integrator's palette "Prune Stale
  Worktrees…" opens W21's preview for the open graph or says none is open.
- **Deviations from the slice:**
  - Files outside *Touch*, each flagged in its own commit:
    `src/backend/types/actions.types.ts`, `src/types.ts` and
    `src/extension/webviewPanel.ts` (4a9911b, message types cannot exist
    without them); `src/extension/webviewL10n.ts` and the five
    `l10n/bundle.l10n*.json` files (the slice's Kind names l10n; the bridge
    entries are how strings reach the webview).
  - Step 2's "a prunable path offers Repair instead" is a refusal whose
    message names Repair and Prune, not a new Repair button: W21's branch
    menu already offers Repair for a stale holder, and the palette now
    offers Prune. No new dialog surface was added for it.
  - W20's dialog kept its shape, but its submit changed from "Copy Path"
    to "Open in New Window" in every bundle, and now sends
    `openWorktree { newWindow: true }`. Copy Path returns with W30's rows.
  - The Dutch, Polish, zh-CN and zh-TW strings are the agent's own
    translations; `l10n:check` reports complete.
- **Open questions / follow-ups:**
  - A webview open action is counted twice by telemetry, once as the action
    (`openWorktree`) and once as the command
    (`git-graph-libre.openWorktree`), because both existing chokepoints see
    it. Left as the chokepoints dictate; the integrator may want one.
  - Bare worktrees get no special handling (W33's scope): switching the
    graph to a bare path fails through `--show-toplevel` as "not a Git
    repository", and open/reveal act on the bare folder as listed.
  - W30 and W22 can now send all four messages; only W20's caller is wired
    in this slice, per "callers only".
