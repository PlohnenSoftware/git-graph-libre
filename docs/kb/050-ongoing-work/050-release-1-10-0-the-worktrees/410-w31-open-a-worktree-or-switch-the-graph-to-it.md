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

Status: ready once W10 is integrated
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

## Touch

`src/extension/messageHandler.ts`, `src/extension/commandManager.ts`,
`package.json`, `package.nls*.json`, `src/webview/main.ts` (callers only),
`tests/**`

## Acceptance

Every open and switch path works on main and linked worktrees, and refuses a
path Git no longer lists.

## Report

Not started.
