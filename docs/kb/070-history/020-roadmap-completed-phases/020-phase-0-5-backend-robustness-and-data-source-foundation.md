---
summary: >-
  Complete. Hardening `webviewBridge.ts`, raw Git via `gitRunner` over
  `simple-git`, request ids against stale responses, NUL-separated parsing,
  `loadRepoInfo`, the `RepoFileWatcher` rework.
---

# Phase 0.5: Backend Robustness and Data-Source Foundation

**Status: complete.**

Goal: strengthen the extension host, Git data flow, and repository watchers
before adding broader Git operations.

Implementation plan:

- Harden `src/extension/webviewBridge.ts` so watcher unmute always happens in a
  `finally` block, and so unexpected handler errors are logged and surfaced
  through typed responses where possible.
- Treat `simple-git` as an interim transport. New Phase 0.5 work should use
  explicit raw Git commands through `gitRunner`, and should reduce high-level
  `simple-git` parser usage when touching nearby code.
- Add request or refresh ids for async branch, commit, and future repo-info
  loads so stale Git responses cannot overwrite newer UI state.
- Replace brittle newline/text-separator parsing with NUL or record-separated
  formats for log, refs, diff name-status, diff numstat, and future stash data.
- Add a focused `loadRepoInfo` query that returns repo validity, branch head,
  remotes, stashes count/list, and config summary needed by later phases.
- Rework `RepoFileWatcher` to use `vscode.RelativePattern` and a separate
  `.git/**` watcher, while preserving the existing debounce/mute behavior.
- Revisit activation events so the extension can activate on relevant commands or
  Git workspaces instead of always relying on `onStartupFinished`, if that does
  not regress repo discovery.
- Add a small command-manager layer only if it reduces extension-shell growth for
  active-editor repo opening, manual add/remove repo, version diagnostics, and
  future fetch/search commands.

Acceptance:
