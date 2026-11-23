---
summary: >-
  F4-08: Harden the Blame tab for linked worktrees, bare repositories, unborn
  repositories, untracked files, unsaved dirty editor buffers (`--contents -`),
  and live `RepoFileWatcher` refresh that preserves scroll position while
  keeping pinned historical revisions stable.
---

# F4-08 — Worktrees, bare repositories, unsaved buffers and watcher refresh

Status: done — awaiting integration

Needs: F4-07 (and maintainer confirmation of BQ6)

Model: Claude Sonnet (cheapest first; escalate one step on failure)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the Blame view overview
(`070-history/240-blame-view.md`) for `BQ6`; "Blame view"
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

- **Agent / date:** Gemini 4 Neon (agy), 2026-11-23 13:16
- **Branch and commits:** `blame/F4-08` (base `c9b2f96f`)
  - `95d6aa9e G docs(blame): claim slice (F4-08)`
  - `60a64afb G feat(blame): add worktree, bare, unsaved buffer and watcher host support (F4-08)`
  - `3b8387d6 G feat(blame): render worktree, bare, unsaved buffer UI and preserve scroll on refresh (F4-08)`
  - `81a5f094 G test(blame): cover worktrees, bare repos, unsaved buffers, watcher and scroll stability (F4-08)`
  - plus the report/status commit that adds this section
- **Files changed:** 22 files (+1315 / −76 before this report commit):
  - `src/blameTabTypes.ts` (+77 / −2)
  - `src/extension/blameTab/blameData.ts` (+26 / −3)
  - `src/extension/blameTab/blameTabPanel.ts` (+175 / −15)
  - `src/extension/commandManager.ts` (+47 / −15)
  - `src/webview/blameTab/main.ts` (+11 / −1)
  - `src/webview/blameTab/rowModel.ts` (+42 / −6)
  - `src/webview/blameTab/view.ts` (+197 / −14)
  - `media/blame-tab/blame-tab.css` (+59 / −1)
  - `l10n/bundle.l10n.json`, `l10n/bundle.l10n.nl.json`, `l10n/bundle.l10n.pl.json`, `l10n/bundle.l10n.zh-cn.json`, `l10n/bundle.l10n.zh-tw.json` (+7 / −1 each; 6 new keys appended at the end of every bundle, agent-translated for `nl`, `pl`, `zh-cn`, `zh-tw` — a native review would help)
  - `tests/webview/blameTab/blameData.test.ts` (+88 / −3)
  - `tests/webview/blameTab/blameTabCss.test.ts` (+6 / −1)
  - `tests/webview/blameTab/fixtures.ts` (+10 / −1)
  - `tests/webview/blameTab/main.test.ts` (+22 / −0)
  - `tests/webview/blameTab/rowModel.test.ts` (+30 / −0)
  - `tests/webview/blameTab/view.test.ts` (+169 / −2)
  - `tests/webview/blameTabPanel.test.ts` (+267 / −11)
  - `tests/webview/commandManager.test.ts` (+48 / −0)
  - `docs/kb/070-history/240-blame-view/170-f4-08-worktrees-bare-unsaved-and-watcher.md` (Status and Report)
- **Tests added or changed:** +20 new tests (webview suite 1,243 → 1,263 passed across 94 files; backend suite 1,581 passed, 60 skipped in linked worktree, across 118 files):
  - `tests/webview/blameTab/blameData.test.ts` (+4 real-Git tests): linked worktree divergent uncommitted edits without affecting main worktree; bare repository revision blame vs working-tree `bareWorkingTree` notice; unsaved dirty buffer via `--contents -` with matching line numbers; unborn repository state.
  - `tests/webview/commandManager.test.ts` (+2 tests): dirty unsaved editor contents forwarded to `openBlameTab`; nested linked worktree resolves to the linked worktree root rather than an enclosing known main worktree.
  - `tests/webview/blameTabPanel.test.ts` (+5 tests): `RepoFileWatcher` refreshes working-tree and `HEAD` modes with `preserveScroll: true` and no extra `tab.blame` telemetry; watcher and `onDidSaveTextDocument` do not clobber pinned historical commits (emits `blameRepoChanged`, `blameLatest` returns to latest); `onDidSaveTextDocument` clears `unsavedBuffer` pill and reloads saved working tree, and `blameHead` switches to `HEAD`; `openFile` opens target working-tree file, real linked-worktree `repoMeta`, and panel dispose stops watcher and all VS Code listeners; bare repository `repoMeta`, `openFile` no-op on bare, and `blameLatest` targeting `HEAD` on bare.
  - `tests/webview/blameTab/rowModel.test.ts` (+2 tests): `unsavedBuffer`/`repoMeta`/`repoChanged`/`preserveScroll` propagation and `applyRepoChanged` scoping.
  - `tests/webview/blameTab/view.test.ts` (+6 tests): linked worktree folder name + badge + full-path hover; `Unsaved buffer` pill + `Blame HEAD` button; `bareWorkingTree` localized notice + `bare` badge without error or `Open File`; `untracked`/`unborn` states with `Open File` action and no heat controls; `Repository changed` notice + `View latest` button; scroll position preservation across live refreshes and reuse of `.blame-scroll` without resetting unchanged body DOM.
  - `tests/webview/blameTab/main.test.ts` (+1 test): `blameHead`, `blameLatest`, and `openFile` message wiring from UI clicks.
  - `tests/webview/blameTab/blameTabCss.test.ts` (extended): regression assertions for `.blame-bare-working-tree`, `.blame-unsaved-pill`, `.blame-worktree-badge`, `.blame-action-btn`, `.blame-repo-changed`.
- **Gates:**
  - `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all 20 touched `.ts`/`.json` files: 0 errors, 0 warnings
  - `pnpm run typecheck`: pass
  - `node esbuild.js --production`: pass
  - `pnpm run l10n:check`: 100% complete across `nl`, `pl`, `zh-cn`, `zh-tw` (899/899 bundle keys, 135/135 package.nls keys)
  - `node ./docs/kb/housekeeping.mjs --check`: pass
  - `pnpm run test`: backend 1,581 passed, 60 skipped (118 files); webview 1,263 passed (94 files)
  - Headless renders (`PyQt6` QtWebEngine + `xvfb-run`, `QT_QPA_PLATFORM=xcb`, `QT_SCALE_FACTOR=2`, visually inspected):
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/worktree-unsaved-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/worktree-unsaved-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/pinned-changed-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/pinned-changed-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/bare-notice-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/bare-notice-light.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/untracked-open-dark.png`
    - `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F4-08/untracked-open-light.png`
  - Sonar: integrator
- **Acceptance:**
  - Linked worktrees resolve to linked worktree root (including nested linked worktrees inside a known main worktree) and display worktree folder name + `Worktree` badge with full path on hover; uncommitted edits stay isolated to the linked worktree: **met** (`commandManager.ts`, `blameTabPanel.ts`, `view.ts`, real-Git tests in `blameData.test.ts` and `commandManager.test.ts`, renders `worktree-unsaved-{dark,light}.png`).
  - Bare repository revision blame renders normally; working-tree blame shows localized `bareWorkingTree` notice (not a raw Git error); unborn and untracked states show distinct localized notices with `Open File` action and no broken controls: **met** (`blameData.ts`, `blameTabPanel.ts`, `view.ts`, `blameData.test.ts`, `view.test.ts`, `blameTabPanel.test.ts`, renders `{bare-notice,untracked-open}-{dark,light}.png`).
  - Unsaved dirty editor buffers (`BQ6`) feed `document.getText()` through `loadBlame` (`--contents -`), render `Unsaved buffer` pill + one-click `Blame HEAD`, and clear cleanly onto the saved working tree on `onDidSaveTextDocument`: **met** (`commandManager.ts`, `blameData.ts`, `blameTabPanel.ts`, `view.ts`, `main.ts`, real-Git + panel + view tests).
  - Live `RepoFileWatcher` refreshes working-tree and `HEAD` modes preserving scroll position without resetting unchanged DOM, never clobbers pinned historical commits (subtle `Repository changed` + `View latest` affordance instead), does not emit extra `tab.blame` telemetry, and disposes cleanly on panel dispose: **met** (`blameTabPanel.ts`, `rowModel.ts`, `view.ts`, `blameTabPanel.test.ts`, `view.test.ts`, renders `pinned-changed-{dark,light}.png`).
- **Deviations from the slice:**
  - `tests/webview/commandManager.test.ts` was updated alongside `src/extension/commandManager.ts` (which is in the Touch list) to cover dirty-buffer forwarding and nested linked worktree resolution.
  - No Rust engine blame hook added because `F4-09` is deferred per BQ8 profiling.
  - The one-click HEAD button uses `"Blame HEAD"` (matching the Touch list and integrator instructions rather than `"View HEAD"` in one bullet).
- **Open questions / follow-ups:**
  - Native review of the six agent-translated Blame keys in `nl`, `pl`, `zh-cn`, and `zh-tw`.
  - When integrating alongside parallel `F4-05`, merge the additive fields on `BlameLoadOptions`, `BlameTargetEcho`, `BlameLabels`, `BlameWebviewMessage`, `blameData.ts`, `blameTabPanel.ts`, `rowModel.ts`, `view.ts`, `main.ts`, and `media/blame-tab/blame-tab.css`; `isAutoRefreshRev(target.rev)` already pauses watcher refreshes whenever `F4-05` pins a historical commit OID.
