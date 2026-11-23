---
summary: >-
  F4-08: Harden the Blame tab for linked worktrees, bare repositories, unborn
  repositories, untracked files, unsaved dirty editor buffers (`--contents -`),
  and live `RepoFileWatcher` refresh that preserves scroll position while
  keeping pinned historical revisions stable.
---

# F4-08 — Worktrees, bare repositories, unsaved buffers and watcher refresh

Status: ready

Needs: F4-07 (and maintainer confirmation of BQ6)

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`050-ongoing-work/110-blame-view.md`) for `BQ6`; "Blame view"
(`060-future-work/040-git-graph-plus-features-research-and-plan/040-blame-view.md`),
sections 1.6 and 2.

Rules for every slice: implement from Git's documentation and this project's
own patterns; never copy third-party code. Tests ship with behavior, using
real-Git fixtures in temporary directories only. Strict Biome on touched
files, no `var`, American English, OKLCH colors through `--ngg-*` tokens with
VS Code theme tokens first, every user-visible string in all five l10n bundles
(`l10n:check` at 100%), no new telemetry events or declarations. Do not bump
versions or edit `CHANGELOG.md`, `README.md`, or `NOTICE.md`; the integrator
does. Report Sonar: integrator.

## Touch

`src/blameTabTypes.ts` (unsaved-buffer flag, worktree/bare repo metadata,
scroll-anchor preservation flag on refresh);
`src/extension/blameTab/{blameData,blameTabPanel}.ts` (worktree folder display,
bare-repo guard, dirty editor detection feeding `document.getText()` into
`loadBlame`'s `--contents -` path, `RepoFileWatcher` + `onDidSaveTextDocument`
refresh for working-tree/HEAD mode only, pausing auto-refresh while a
historical commit is pinned); `src/extension/commandManager.ts` (pass dirty
document contents when invoking `showBlame` from an unsaved editor);
`src/webview/blameTab/{main,rowModel,view}.ts` ("Unsaved buffer" pill with
one-click "Blame HEAD" switch, worktree folder indicator in header, scroll
position preservation across live refresh, optional engine-wiring hook if
`F4-09` has already landed); `media/blame-tab/blame-tab.css`;
`l10n/bundle.l10n*.json` (all five bundles); tests under
`tests/webview/blameTab/` and `tests/webview/blameTabPanel.test.ts`; this
slice file's Status and Report.

## Task and acceptance

- **Linked worktrees:**
  - Opening blame on a file inside a linked worktree resolves to that linked
    worktree's root (never the main worktree) and displays the worktree folder
    name cleanly in the header (with full path on hover, matching the Styling
    Guide's path-in-running-text rule).
  - Uncommitted edits in the linked worktree show up in its blame without
    affecting the main worktree.
- **Bare repositories, unborn repos, and untracked files:**
  - Bare repository opened from Commit Details at an explicit commit renders
    normally; attempting working-tree blame on a bare repository shows a clear
    localized notice instead of a raw Git error.
  - Unborn repository and untracked file show their distinct localized notice
    states with an "Open File" action (and no broken rewind/diff controls).
- **Unsaved dirty editor buffers (`BQ6`):**
  - When `git-graph-libre.showBlame` is invoked on a dirty unsaved VS Code
    `TextDocument`, feeds `document.getText()` through `loadBlame` (`--contents -`
    via `runGitWithInput`).
  - Header displays a clear "Unsaved buffer" pill and a one-click "View HEAD"
    button; saving the document refreshes the tab cleanly onto the saved
    working tree.
- **Live watcher refresh & scroll stability:**
  - `RepoFileWatcher` refreshes the retained tab when `rev === null` (working
    tree) or `rev === "HEAD"`, preserving the user's current scroll position /
    selected line without resetting the DOM unnecessarily.
  - When the user has rewound to a pinned historical commit OID (via `F4-05`
    or Commit Details), watcher events do **not** wipe out their historical
    view; an optional subtle "Repository changed" / manual Refresh affordance
    lets them return to latest whenever they choose.
  - Watcher disposes cleanly on panel dispose (no handle leak).
- **Tests:**
  - Real-Git tests: linked worktree blame with divergent uncommitted edits,
    bare repository revision blame vs working-tree refusal, dirty buffer via
    `--contents -` matching line numbers, unborn repo, untracked file.
  - Panel & webview tests: watcher triggers reload in working-tree mode and
    preserves scroll line; watcher does NOT clobber a rewound historical
    commit; `onDidSaveTextDocument` clears "Unsaved buffer" pill; panel
    dispose stops all watchers/listeners.

Run focused checks (`npx biome check --config-path biome.strict.jsonc --error-on-warnings`
on touched files, `pnpm run typecheck`, `node esbuild.js --production`,
relevant backend and webview `vitest` suites, `pnpm run l10n:check`, and
`node ./docs/kb/housekeeping.mjs --check`) and record each command and result.
Claim and changes are separate signed commits; never push.

## Report

Not started.
