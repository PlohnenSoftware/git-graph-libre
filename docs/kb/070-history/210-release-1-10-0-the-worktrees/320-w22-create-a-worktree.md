---
summary: >-
  W22 · wave D · needs W10, Y7, Y8 · TypeScript + webview · ~250 lines:
  "Create Worktree…" from a branch, a remote branch, a commit or a tag. One
  dialog takes the path (default per Y7), an optional new branch, detach for
  commits and tags, and an optional lock with a reason, then runs `git
  worktree add`. It refuses a branch already checked out elsewhere, offering
  that worktree instead, and finishes per Y8 (open it, add it to the
  workspace, or switch the graph).
---

# W22 — Create a worktree

Status: integrated `63cdd97` (`2026-11-05`)
Needs: W10
Decisions: Y7 (default location), Y8 (what happens after)
Kind: TypeScript and webview, l10n · Size budget: ~250 changed lines outside
tests
Source: full worktree support (maintainer, `2026-11-04`); Git worktree
behavior, verified

## Steps (as recommended)

1. Backend action `addWorktree { path, branch, newBranch, startPoint, detach,
   lockReason }` builds `git worktree add [--lock [--reason <r>]] [-b <new>]
   [--detach] <path> [<commit-ish>]`, with every value passed as a separate
   argument through `runGitRaw`.
2. Each entry point, in the context menus, pre-fills its own case:
   - **branch:** check out that branch, if it is checked out nowhere;
   - **remote branch:** `-b <local>` from W05's parsed name, tracking the
     remote branch;
   - **commit or tag:** detach, or a new branch name.
3. The dialog:
   - the path, defaulting per Y7, with a browse button using VS Code's
     folder picker;
   - the new branch name;
   - detach;
   - "Lock with reason".

   Validate inline (the dialog's `inputInvalid` state): the path must not
   exist, or be empty; the branch must not be checked out elsewhere (W10
   data). Otherwise say where it is checked out, and offer Open Worktree
   (W31).
4. On success, act per Y8. Recommended: ask with Open in New Window, Add to
   Workspace, Switch Graph and Nothing, remembering the last choice.
5. Tests (temporary fixtures):
   - each entry point's arguments;
   - a path with a space and a non-ASCII character;
   - the refusal for a branch in use;
   - locked creation.

   Then l10n, and the `CHANGELOG.md` line.

## Touch

`src/backend/actions/worktree.ts` (after W21, or created here if W21 is not
in yet), `src/backend/types/actions.types.ts`, `src/extension/messageHandler.ts`,
`src/webview/main.ts` (menus, dialog), l10n files, `tests/**`, `CHANGELOG.md`

## Acceptance

Each entry point creates exactly the worktree Git would create for those
arguments, and refusals are explained before Git is run.

## Report

- **Agent / date:** Muse Code powered by muse-wonder-full-1.0, 2026-11-05 21:05
- **Branch and commits:** `wt-1.10.0/W22` —
  `e5273ef G docs(worktrees): claim W22, create a worktree (W22)`;
  `74aa6f3 G feat(worktrees): addWorktree runs git worktree add on the CLI (W22)`;
  `4120608 G test(worktrees): create worktrees in temporary fixtures (W22)`;
  `ee0a62c G feat(webview): Create Worktree dialog from branch, remote, commit and tag (W22)`;
  `e4284aa G test(webview): Create Worktree dialog, refusal, finish step and handler (W22)`;
  `0734b0c G feat(webview): Create Worktree joins the menu visibility settings (W22)`;
  plus the signed commit carrying this report.
- **Files changed:** 19 files against `c0395eb`, +1,170/−1 before this
  report commit (`git diff --numstat`): the slice file (+1/−1, then this
  report), `src/backend/actions/worktree.ts` (+73),
  `src/backend/types/actions.types.ts` (+15),
  `src/extension/messageHandler.ts` (+4), `src/webview/main.ts` (+249),
  `src/extension/webviewL10n.ts` (+19), five `l10n/bundle.l10n*.json`
  (+23 each), `CHANGELOG.md` (+11), `src/types.ts` (+4) and
  `src/contextMenuVisibility.ts` (+4, see Deviations), and tests
  `tests/backend/actions/worktree.test.ts` (+233),
  `tests/webview/createWorktreeDialog.test.ts` (+396),
  `tests/webview/worktreeHandlers.test.ts` (+44),
  `tests/webview/contextMenuVisibilityRendering.test.ts` (+1),
  `tests/webview/remoteBranchContextMenu.test.ts` (+1). Outside tests and
  l10n the slice ran past its ~250-line guide (the dialog's four entry
  points and the Y8 finish step are most of it).
- **Tests added or changed:** 16 new cases, 2 updated expectations. Backend
  (real Git in temporary fixtures only, paths with a space and a non-ASCII
  letter): each entry point's exact `worktree.add` arguments; a new branch
  from a remote branch tracks it; detach at a commit; a new branch at a
  tag; locked creation with and without a reason in an existing empty
  folder; the refusal for a branch checked out elsewhere, and for an empty,
  listed or non-empty folder — each proven to run no `worktree add`.
  Handler: creation through the message handler in a fixture, and the
  refusal reply naming the holding worktree. Webview: the Y7 default path
  (POSIX, Windows, root and bare names); every entry point's dialog
  pre-fill and submitted payload; the refusal dialog offering Open
  Worktree; the finish step acting on Switch Graph and reopening on it;
  the error reply. Counts (passed): backend 1,337 after (1,331 before,
  derived — only the 6 new cases were added there), webview 882 after
  (872 before, derived the same way; one new test file, 71 against 70).
- **Gates:** strict Biome
  (`biome check --config-path biome.strict.jsonc --error-on-warnings`) on
  all 17 touched `.ts`/`.json` files: clean. `pnpm run typecheck`:
  exit 0. `pnpm run test`: backend 102 files, 1,337 passed; webview 71
  files, 882 passed. `pnpm run l10n:check`: complete in every language.
  `pnpm run kb:check`: exit 0. Headless render (PyQt6 QtWebEngine under
  `xvfb-run`, the real `media/*.css` in the webview's order, Dark Modern
  and Light Modern token values): the create dialog and the finish dialog
  in both themes, inspected — labels aligned, the lock checkbox a
  whole-row `checkRow`, no wrap defects. Screenshots and harness in
  `/tmp/w22-render/` (`create-{dark,light}.png`, `finish-{dark,light}.png`,
  `make_preview.py`, `shot.py`), outside the repository as scratch. No
  `engine/**` change, so no Rust arm. Sonar: integrator.
- **Acceptance:** met. Each entry point creates exactly the worktree Git
  creates for those arguments (backend fixtures assert the argument list
  and the listed result, including upstream tracking for a remote start
  point, verified first by hand in a scratch clone). Refusals — branch
  checked out elsewhere, folder already listed or not empty, no folder —
  are decided from the worktree list and the file system in both the
  dialog and the backend, before `git worktree add` runs, and the dialog
  offers the holding worktree through W31's `openWorktree`. Creation runs
  only through `runGitRaw`; the engine never writes. The finish step asks
  per Y8 over W31's four messages and reopens on the last choice.
- **Deviations from the slice:**
  - **Files outside *Touch*, each flagged in its own commit:**
    `src/types.ts` and `src/contextMenuVisibility.ts` (`0734b0c`). Every
    context-menu action must be in the visibility map or it can never be
    hidden; the existing visibility tests encode that and failed 5 cases
    without it. No assertion was loosened (one disabled-set gained the new
    key, one expected menu gained the new item). Same shape as W31's
    flagged type files. `src/extension/webviewL10n.ts` was treated as one
    of the slice's "l10n files": it is the bridge every webview string
    crosses, as in W31.
  - **No Y7 (d) setting.** The default folder is Y7 (a),
    `<parent>/<repo>.worktrees/<branch>`, always. The overridable setting
    with `${repo}` and `${branch}` needs `package.json`, `package.nls*`,
    `src/config.ts`, `src/types.ts` state plumbing, the settings-hub echo
    and the README table — none of them in this slice's *Touch* list. It
    needs a follow-up slice with that *Touch* list (and the
    settings-reach-the-webview-twice wiring). The folder stays editable in
    the dialog meanwhile.
  - **No browse button** (slice step 3). Picking a folder from inside the
    dialog needs a new request/response pair (`src/types.ts`, the queries
    types) and a new `DialogInput` kind (`src/webview/global.d.ts`), all
    outside *Touch*. The folder is a pre-filled, editable text field;
    together with the setting this is one follow-up.
  - **The Y8 memory is panel-lifetime.** The last finish choice is kept in
    the webview for the panel's life, not persisted with the view state
    (that state's type lives in `global.d.ts`, outside *Touch*). It
    survives hide/show, not a panel reload.
  - The checkout mode is one select (Branch / New branch from… / Detached
    HEAD at…) rather than a separate detach checkbox, so the three modes
    cannot be combined into an invalid request; the new-branch field is a
    `text-ref` shown only in New branch mode.
  - The Dutch, Polish, zh-CN and zh-TW strings are the agent's own
    translations; `l10n:check` reports complete.
- **Open questions / follow-ups:**
  - A `createWorktree` follow-up for the Y7 (d) path-template setting and
    the folder-picker browse button, with the manifest, config and
    `global.d.ts` files in its *Touch* list.
  - W30's rows can call the same dialog through a "Create Worktree…" entry
    of their own; the four graph entry points are wired here.
  - `git worktree add --lock` without `--reason` records Git's own default
    reason ("added with --lock" in this Git's locale); the list shows it
    as the lock reason. Recorded as observed, not decided from.
