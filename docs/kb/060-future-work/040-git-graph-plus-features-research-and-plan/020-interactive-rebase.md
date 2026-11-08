---
summary: >-
  Research (`2026-11-08`) into interactive rebase in Git Graph+ at `c6c2a9a`:
  the prepared-todo handoff through `GIT_SEQUENCE_EDITOR`, rewords as `exec`
  amends, autosquash, conflict prediction, the gaps (no worktree check, no
  pushed-commit warning), behavior verified with Git 2.56.0, what Git Graph
  Libre has today (terminal only, no in-progress handling), slices F2-01 to
  F2-10 and decisions IQ1 to IQ12.
---

# Interactive rebase: Git Graph+ research and a slice plan for Git Graph Libre

Research only. Nothing was implemented, and neither repository was touched. Git behavior was observed in
throwaway temporary repositories (Git 2.56.0, `GIT_CONFIG_GLOBAL=/dev/null`,
`LC_ALL=C`; the session scripts were not kept).

## 0. Licensing notes (read first)

- Git Graph+ at `c6c2a9a` is Apache-2.0 (`LICENSE`, `package.json:11`, publisher `the0807`). I searched
  `src/` and `webview-ui/src/` for `mhutchie`, `Copyright`, "ported", "adapted from": no Git Graph (mhutchie)
  lineage turned up.
- **One foreign notice exists, and it is outside the rebase code**:
  `src/git/git-graph-builder.ts:1-2` reads exactly
  `// Graph layout algorithm ported from SourceGit (https://github.com/sourcegit-scm/sourcegit)` and
  `// Copyright (c) SourceGit contributors, licensed under MIT License.`
  It is the graph-layout algorithm. I did not read it beyond those two lines and it plays no part in this
  plan. Nothing in the rebase files (`classic-rebase.ts`, `InteractiveRebase.svelte`, `autosquash.ts`,
  `interactive-rebase.ts`, `utils/squash.ts`, the rebase parts of `git-service.ts` / `MainPanel.ts`)
  carries a foreign header or "ported" comment. The integrator may still want to add this path to the
  "do not read" list for the layout area.
- Everything below is a description of behavior, Git command lines and design in my own words. No code is
  copied. I did not read `vscode-git-graph-rs/src`, `/web` or `illegal_forks`.
- Our own clean-room rule (KB mission): reimplement from Git documentation, VS Code APIs and our patterns,
  and record in the KB which ideas were considered. This file is that record; the slice files should say
  the Git Graph+ reading was behavioral only.

## 1. How Git Graph+ does interactive rebase (at `c6c2a9a`)

### 1.1 User-facing behavior

- **Entry points** (all in `webview-ui/src/components/graph/CommitGraph.svelte`):
  - Commit context menu, "Interactive rebase <current branch> onto here" at `:1074`. The clicked commit
    is the base (exclusive), so the todo is `base..HEAD`. Offered for every commit, even one that is not
    an ancestor of HEAD.
  - Multi-selection menu "Interactive rebase N selected commits" at `:823`, only when
    `getSquashChain` (`lib/utils/squash.ts`) says the selection is one contiguous first-parent chain of
    single-parent commits, and `chainBranches` (`lib/utils/branchChain.ts`) finds at least one local
    branch whose tip is the chain head. `startSelectionRebase` (`:719`) uses the parent of the oldest
    selected commit as the base; if the chosen branch is not checked out it asks (branch picker with
    dirty-tree choice `RebaseTargetModal.svelte`, or `DirtyActionModal` when only the dirty tree matters),
    checks the branch out, waits for the `operationComplete: checkout` message (`:745-758`), then opens
    the editor.
  - Drag-to-rebase (`:688`, `lib/utils/dragDrop.ts`) is **branch label onto branch label** and is a plain
    non-interactive `git rebase <target>` after checking out the source (`MainPanel.ts:896-917`); it has
    nothing to do with the todo editor.
  - Mode switch `gitGraphPlus.interactiveRebase.mode` (`package.json:412`, `utils/config.ts:41-48`):
    `ui` (default) or `classic`. `dispatchInteractiveRebase` (`lib/interactive-rebase.ts`, 15 lines)
    routes to the modal or to the terminal.
  - Squash of a selection (`SquashModal.svelte`, `lib/utils/squash.ts:buildSquashTodos`) reuses the same
    `interactiveRebase` message: oldest selected commit becomes `pick` with the final message, the rest
    `fixup`, everything else `pick`. It warns when commits are pushed (`squash.pushedWarning`).
- **Editor** (`webview-ui/src/components/rebase/InteractiveRebase.svelte`, 885 lines, tests in
  `rebase/__tests__/InteractiveRebase.test.ts`):
  - A modal, 760px wide. Header card shows branch and base; rows show a drag handle, a colored action
    badge that opens a dropdown (pick, reword, edit, squash, fixup, drop; squash/fixup disabled on the
    oldest row), short hash, subject, and up/down buttons.
  - Keyboard (`handleKeydown`, about `:259-310`): Up/Down select, Shift+Up/Down reorder, `p r e s f d` set
    the action, Ctrl/Cmd+Enter starts, and typing inside the message textareas is left alone.
  - Drag reordering via native HTML drag events; `guardFirstItem` turns a leading squash/fixup into pick.
  - Reword: the row becomes a textarea pre-filled with subject plus body. Squash group: the target row
    gets one textarea with the combined messages of the target and the `squash` members (not `fixup`),
    keyed by the target's hash so reorders keep manual edits (`$effect.pre`, about `:105-150`).
  - Drop warning ("N commit(s) will be dropped"). Start is disabled until something differs from "all
    pick, original order". No pushed-commit warning in the editor itself.
  - Autosquash toggle appears only when a `fixup!`/`squash!` subject exists; it is on by default in that
    case, and works on the client (`lib/autosquash.ts`, 97 lines) so the modal is a preview.
  - Merge commits in the range are shown like any other row, but see 1.3: Git linearizes them.
- **Create fixup / squash commits**: context-menu "Create Fixup Commit" / "Create Squash Commit"
  (`CommitGraph.svelte:1107-1110`), only for ancestors of HEAD. It opens the SCM view, a modal tracks the
  staged count, then runs `git commit --fixup <hash>` or `--squash <hash>` (`git-service.ts:1902-1910`,
  integration test `merge-rebase.integration.test.ts:222`). `--fixup=amend:` / `reword:` are not used.
- **Classic mode**: `runClassicRebase` message (`MainPanel.ts:977-986`) validates the base is 4-40 hex
  digits (`classic-rebase.ts:21-24`), then sends `git rebase -i <base>` to a reused terminal named
  "Git Graph+ Rebase". Bare `git` on PATH on purpose (a quoted absolute path is a string literal in
  PowerShell).
- **In progress**: an `edit` stop or a conflict leaves Git's state directory. The UI then shows a banner:
  `rebase.pause.*` Continue / Abort (`App.svelte:426-441`), or the conflict banner with the file list and
  Abort. Continue/abort go through the generic `continueOperation` (`git add -A`, then
  `git rebase --continue`; `git-service.ts:1796`) and `abortOperation` (`:1807`). A `skipRebase` message
  exists (`message-bus.ts:50`, `MainPanel.ts:957`) and `git-service.ts:1558`. Conflict files come from
  `git diff --name-only --diff-filter=U` (`:1761`); the SCM view is focused on conflict
  (`MainPanel.ts:1628-1650`). No merge-editor-specific code; VS Code's own SCM resolves.
- **Dirty tree**: not handled by the interactive path. Git itself refuses ("cannot rebase: You have
  unstaged changes") and the error reaches the generic error handler. For the multi-select entry the
  stash/discard choice happens at the checkout step. Plain `rebase` has an `autostash` option
  (`git-service.ts:1540`), the interactive one has none.
- **Conflict prediction** exists only for plain rebase from the branch context (`RebaseBranchModal.svelte`
  `:23-79`, message `predictConflicts` with `mode: 'rebase'`, handled at `MainPanel.ts:523`). Not wired
  to the todo editor.

### 1.2 Implementation

All line numbers at `c6c2a9a`.

| Piece | Where | What it does |
|---|---|---|
| Exec env | `git-service.ts:377` | Every command runs with `LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`, `GIT_EDITOR=true`, `EDITOR=true`, `GIT_MERGE_AUTOEDIT=no`, plus `-c core.quotePath=false`. |
| Range read | `getRebaseCommits` `:1704` | `git log --topo-order --reverse <base>..HEAD` with a NUL-delimited format (hashes, authors, subject, parents, refs, body). |
| Todo build and run | `interactiveRebase` `:1576-1698` | Validates actions (six verbs) and hex hashes, rejects a leading squash/fixup, then builds the todo text itself (below), writes it to `<gitdir>/ghg-rebase-todo-<uuid>`, spawns `git rebase -i <base>` with `GIT_SEQUENCE_EDITOR='cp -- "$GHG_TODO_FILE"'` and the path in env `GHG_TODO_FILE`, `GIT_EDITOR=true`; deletes the file in `finally`. |
| Reword | `buildAmendCommand` `:1565`, `buildAmendCommandStr` `:2466` | A reword is `pick <hash>` followed by `exec git commit --amend --no-edit -m '<msg>'`; multi-line is `exec printf '%s\n' 'l1' 'l2' ... \| git commit --amend -F -` with each line single-quote escaped. `GIT_EDITOR` is never used for messages. |
| Squash groups | same, `:1596-1632` | A target followed by squash/fixup members becomes `pick`, member lines, and (when the final message was edited or the target was reword) one trailing `exec` amend. `reword` as a group target is turned into `pick` + amend. |
| Pause detection | `:1680-1690` | A non-zero exit with `rebase-merge` or `rebase-apply` present in the git dir resolves as success (paused); otherwise rejects with stderr. |
| Operation state | `getOperationState` `:1773` | `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD` via `rev-parse --verify`; rebase only by the `rebase-merge`/`rebase-apply` directory, **not** `REBASE_HEAD` (it lingers after success: commit a79f444 per `operation-state.integration.test.ts:10`). |
| Edit-stop detection | `MainPanel.ts:1949-1962` | In the post-refresh probe, no conflict files + rebase state + `rebase-merge/stopped-sha` exists means `operationPaused`; markers `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD` gate the probe (`:1925`). Worktree-aware via `resolveGitDirs`. |
| Watcher | `services/file-watcher.ts:25-30` | Watches `REBASE_HEAD` etc. in the per-worktree git dir. |
| Messages | `utils/message-bus.ts:47-53,63,65,139,147,158` | `rebase`, `abortRebase`, `continueRebase`, `skipRebase`, `interactiveRebase` (`base`, `todos[]`, `squashCount`), `runClassicRebase`, `getRebaseCommits`, `commitSquash`, `dragRebase`; `rebaseCommitsData`, `operationPaused`, `setInteractiveRebaseMode`. |
| Prediction | `predictRebaseConflicts` `:998-1068`, `mergeTreeCheck` `:899` | See below. |
| Defaults | `package.json:524-531` | `defaults.rebase.autostash`, `defaults.rebase.pushAfter`; `pushAfter` runs a force-with-lease push after a plain rebase (`MainPanel.ts:866-894`). |

Handing the todo over: Git calls the sequence editor with one argument, the path of its own
`rebase-merge/git-rebase-todo` (verified: `NARGS:1`). Git Graph+ overwrites that file by copying its
prebuilt one on top, and Git proceeds.

**Conflict prediction**: it replays the branch's commits one by one (capped at 20, flag `truncated`) with
`git merge-tree --write-tree --merge-base=<commit>^ <accumulated-tree> <commit>`, feeding the printed
tree OID into the next probe so "add a file, then edit it" does not look like a conflict; it stops at the
first conflicting commit; for Git older than 2.40 (no `--merge-base`) it falls back to a cumulative probe.
The caveat for us: this predicts a rebase of a branch onto a target in **original order**; it does not
simulate an arbitrary reordered/squashed/dropped todo.

**What Git Graph+ does not do** (relevant to our plan):
- no `--rebase-merges`; merges are flattened (verified below);
- no `--root`, no `--update-refs`, no `--autostash` on the interactive path;
- no `GIT_EDITOR`-based message handling, so each reword is an extra `commit --amend` (re-runs commit
  hooks and re-signs a second time per reworded commit; the original pick already ran them once);
- no check that the branch is checked out elsewhere; no published-commit warning in the editor;
- autosquash is implemented in JavaScript and matches only the **subject** after `fixup! ` / `squash! `
  (`autosquash.ts:21`). Real Git also matches `fixup! <hash-prefix>` and `amend! <subject>`, and converts
  `amend!` to `fixup -C` (verified below). `git commit --fixup=amend:<c>` / `reword:<c>` create
  `amend!` commits, which this client would ignore.

### 1.3 Edge cases and what I verified in Git 2.56.0 (scratch repos)

- **Merge commits in the range, default**: `rebase -i` (no flag) lists both sides' commits in one
  linear todo and the merge commit disappears. With `--rebase-merges` the todo gains `label onto`,
  `reset onto`, `merge ...` lines. A todo editor that edits a linear list can only represent the default.
  This must be disclosed to the user or the range refused.
- **Root**: `git rebase -i --root` works and its first todo line is the root commit; `<root>^` is not a
  valid revision, so our `drop` (see section 2) already excludes roots.
- **Editor failure**: a sequence editor that exits non-zero ends with `error: there was a problem with
  the editor`, exit non-zero, **no state directory left** (re-verified with `GIT_SEQUENCE_EDITOR=false`;
  an earlier run that appeared to leave state was my own `| head` killing Git). A todo that begins with
  `fixup`: Git stops and **keeps** `rebase-merge` ("You can fix this with `git rebase --edit-todo`").
  So "state directory exists after non-zero exit" is not proof of a legitimate pause; Git Graph+'s check
  (`:1685-1688`) would call that a pause. Our runner should validate before starting and classify after.
- **Exit codes**: stop at `edit` exits **0**, stop on conflict exits **1**. Both leave `rebase-merge/`
  containing `stopped-sha`, `done`, `git-rebase-todo`, `head-name` (full ref, `refs/heads/topic`),
  `onto`, `orig-head`, `msgnum`, `end`, `message`, `author-script`. `REBASE_HEAD` also exists during
  the stop; after `--continue` succeeds it lingers (confirms the a79f444 note).
- **Conflict**: `git diff --name-only --diff-filter=U` lists the file; `git status` first lines say
  "interactive rebase in progress; onto <sha>", with the done/next lists.
- **Dirty tree**: `error: cannot rebase: You have unstaged changes.` (or "Your index contains uncommitted
  changes."), non-zero exit, no state left. `--autostash` or `rebase.autoStash` is the Git answer.
- **Branch checked out in another worktree**: `git worktree add ../x mid` then `git rebase -i main~3 mid`
  fails with `fatal: 'mid' is already used by worktree at '<path>'`. Rebasing the current branch is not
  affected. Detached HEAD: `rebase -i HEAD~2` works ("updated detached HEAD").
- **Autosquash** (`--autosquash` or `rebase.autoSquash=true` with `-i`): moves `fixup!`/`squash!`/`amend!`
  commits under the target (matched by subject or hash prefix, chained), emitting `fixup`, `squash`, and
  `fixup -C <hash> # amend! ...`. Without the flag they stay at the end as plain `pick`. `--update-refs`
  adds `update-ref refs/heads/<branch>` lines for branches pointing inside the range.
- **Empty todo**: `error: nothing to do`, no state.
- **Windows**: Git for Windows runs editor commands through its own `sh`, so `cp --` works there; Git
  Graph+ shipped and then fixed two Windows bugs (CHANGELOG lines 152, 241) when it had spliced paths
  into a cmd-style command; the fix was the env variable plus quoted `"$VAR"`.
- **Localized Git output**: all commands run with `LC_ALL=C`; detection reads files and exit codes, never
  messages. We should do the same (the conflict/pause decision must not parse text).
- **Signing and hooks**: nothing special. `commit.gpgsign` applies to every re-created commit (pick of a
  rewritten commit signs again); a spawn without a TTY cannot prompt for a passphrase, so a locked key
  with no agent fails inside the rebase (error from Git; the rebase then stops with state left). Hooks
  (`pre-rebase`, `post-rewrite`, `commit-msg` on rewording) run as usual.
- **Failed rebase leaving state**: handled only by the generic banner; there is no recovery for a stuck
  "invalid todo" state except Abort.

### 1.4 Tests in Git Graph+

- Webview component tests (`rebase/__tests__/InteractiveRebase.test.ts`, 20+ cases), `lib/__tests__/
  interactive-rebase.test.ts`, `lib/utils/__tests__/squash.test.ts`, `dragDrop.test.ts`,
  `modals/__tests__/{SquashModal,RebaseTargetModal,RebaseBranchModal,DirtyActionModal,AbortConfirmModal}`.
- Git-level: `git/__tests__/git-service.test.ts` (rejects base starting with `-`, invalid action, hash
  injection, `buildAmendCommandStr` cases at `:1343`), `git-service.predict.test.ts`,
  `classic-rebase.test.ts`.
- Real-Git integration `git/__tests__/integration/merge-rebase.integration.test.ts`, `describe` blocks:
  rebase (`:81`), commitFixup (`:222`), predictRebaseConflicts (`:280-408`, incl. non-ASCII, truncation,
  phantom conflict), continueOperation dispatch (`:432-486`), `interactiveRebase` (`:550-727`: reorder,
  drop, reword, multi-line reword, squash, fixup, first-entry squash rejected, bad hash rejected, edit
  pause, conflict pause), `getRebaseCommits` (`:730`), continue/skip (`:752-786`), drag rebase/merge
  sequences (`:788`), abort (`:843`); plus `operation-state.integration.test.ts` (REBASE_HEAD regression).
  Real repos only, no mocks for Git.

## 2. What Git Graph Libre has today (at `51908ec`)

- **Rebase action**: `src/backend/actions/rebase.ts` (`rebaseCurrentBranch`: `git rebase [--ignore-date]
  <target>`). Registered in `src/extension/messageHandler.ts:820-826`. Payload type
  `src/backend/types/actions.types.ts:115-120` (`target`, `targetType: branch|commit`, `ignoreDate`,
  `interactive`).
- **Interactive today = terminal only**: when `interactive` is true, `openInteractiveRebaseTerminal`
  (`messageHandler.ts:468-480`) creates a new terminal "Git Graph Libre: Rebase on <label>" with the
  repo as cwd and sends `git rebase --interactive '<target>'`, single-quote escaped
  (`quoteTerminalArg`, `:462`). The webview's `showRebaseDialog` (`src/webview/main.ts:4033-4064`,
  `showFormDialog` with two checkboxes: interactive, ignore date) is reached from the commit menu
  (`:3700`) and branch menu (`:4808`). So the "terminal mode" already exists as the only mode.
- **Related rewriting actions** in `src/backend/actions/commit.ts`: `dropCommit` `:122` runs
  `git rebase --onto <hash>^ <hash>` (excluded for root and merge commits in the menu,
  `main.ts:3583-3589`); `dropCommitSelection` `:137` loops it; `squashCommitSelection` `:148` does
  `git reset --soft <oldest>^` then `git commit -m <msg> [--no-verify]` (only valid for a contiguous
  chain ending at HEAD, enforced by `selectedCommitsAreLoadedHeadChain`, `main.ts:3784`); `editHeadCommitMessage`
  `:192` (HEAD only). Dialogs: `showSquashSelectedCommitsDialog` (`main.ts:4079`, textarea + "bypass
  hooks"), `showDropSelectedCommitsDialog`.
- **Multi-select (Phase 8, complete in 1.9.0)**: `selectedCommitHashes` set, `getSelectedCommits()` ordered
  newest-first, `shouldShowSelectedCommitContextMenu` (`main.ts:3768`), a dedicated selected-commit menu
  with Compare (two), Squash and Drop selection (HEAD chain only); visibility toggles live in
  `src/contextMenuVisibility.ts` and `src/types.ts:101-160` (per-action booleans, such as `squashSelection`,
  `dropSelection`); new actions must join those settings.
- **Dialogs**: vanilla-DOM helpers `showFormDialog`, `showConfirmationDialog`, `showErrorDialog`,
  `showActionRunningDialog` in `src/webview/main.ts`; field types `text`, `text-ref`, `textarea`, `select`,
  `checkbox` (whole-row `checkRow`, W06); styling `media/dialogs.css`, `checkbox.css`, tokens in
  `media/tokens.css`. The webview is plain TypeScript (no framework), `src/webview/main.ts` is a very large
  file (the styling guide and "prefer cohesive modules" rule point new UI at new files such as
  `src/webview/diffTab/` has).
- **Separate surfaces already exist**: the diff tab (`src/extension/diffTab/`, `src/webview/diffTab/`,
  `media/diff-tab/`) is a second webview panel with its own plumbing: a precedent for a bigger editor
  that does not fit a dialog.
- **Conflict / in-progress detection: none.** `grep` finds no `rebase-merge`, `REBASE_HEAD`, `MERGE_HEAD`,
  `CHERRY_PICK_HEAD`. The only "unmerged" logic is the staged-file pairs in
  `src/backend/queries/uncommittedDetails.ts:14-18`. The file watcher (`src/repoFileWatcher.ts:7-12`) watches
  `HEAD` and `index`, packed-refs, config, refs, stash and worktree files, not the `rebase-merge/`
  directory. A rebase that stops today leaves the graph on a detached HEAD with no banner and no
  continue/abort button (that is what "drop" with a conflict does today too).
- **Git runner**: `src/backend/utils/gitRunner.ts` wraps `simple-git` (`runGitRaw`), records every call
  (`GitCommandRecorder`, `GitCommandRecord`) with a label. `gitClient.ts` builds `simpleGit({baseDir,
  binary, maxConcurrentProcesses: 6, trimmed: false})`. **simple-git 3.36 carries `@simple-git/argv-parser`,
  which blocks `-c core.editor` / `sequence.editor` and, in that package's `unsafe` categories, an
  editor override (`allowUnsafeEditor`) unless the instance opts in.** I confirmed the category names in
  the installed package (`allowUnsafeEditor`, `allowUnsafeHooksPath`, ...); I did not run it, so F2-01
  must test whether setting `GIT_SEQUENCE_EDITOR` through `simple-git` is refused. The robust route is a
  dedicated `spawn` like the existing precedents (`runGitWithInput` in `gitRunner.ts:225`,
  `queries/remoteTags.ts`), routed through `runGitCommand` so recording and error normalization stay.
- **Signing**: nothing in product code touches signing; commits and rebases inherit the user's Git
  config. (The KB signing rule is about maintainers' commits.) `commit` actions already expose
  `--no-verify` as "bypass hooks" in the squash dialog.
- **l10n**: source strings in `src/extension/webviewL10n.ts` (the `LocalizedStrings` object, keys like
  `dialogRebaseConfirm: translate("dialog.rebase.confirm")`), bundles `l10n/bundle.l10n.json` plus
  `nl`, `pl`, `zh-cn`, `zh-tw` (five files), checked by `pnpm run l10n:check` (`scripts/check-l10n.js`) and
  `tests/backend/l10n.test.ts`. Extension-host messages use `l10n.t`.
- **Worktrees (release 1.10.0)**: branch-checked-out-elsewhere data exists (W10: `worktrees` per repo in
  `src/types.ts:12-38`; `docs/kb/.../040-git-worktree-behavior-verified.md` has the exact refusal text), usable
  to explain a refusal before Git runs.
- **Engine**: Rust engine is read-only (Phase 16 non-goal: "Every write... stays on `runGitRaw`"); the
  todo run, continue/skip/abort and the fixup creation are writes and stay on the CLI. A range read
  (`base..HEAD`) could later be served by the engine reader but nothing requires it.
- **Drag-to-rebase**: Libre has no branch-label drag; its only drag is uncommitted files
  (`main.ts:7330`). That feature would be new UI, not an extension of something.

## 3. Design principles for Libre's version

1. **We build the todo; Git runs it.** All writes via the Git CLI, a dedicated spawn for the rebase start
   with `GIT_SEQUENCE_EDITOR` set only on that process.
2. **Handoff**: write the todo text to a file in the per-worktree git dir (resolve it via `gitDirs.ts`,
   not `<repo>/.git`), pass its path in an env variable, set the sequence editor to a command that copies
   `"$VAR"` over Git's file (works in Git's own `sh` on every OS, no path in the command string), set
   `GIT_EDITOR=true`, `LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`. Delete the file in `finally`.
3. **Never decide "paused" from the existence of the directory alone.** Preflight (see F2-02), then classify
   after exit: exit 0 and no state is done; non-zero or 0 with state present means read state files
   (`stopped-sha`, `done`, `git-rebase-todo`, conflict list) to say paused-at-edit, paused-conflict, or
   invalid-todo (offer abort).
4. **Messages**: use `exec git commit --amend -F <file>` for reworded commits and for edited squash-group
   messages (message text in files under `<gitdir>/ggl-rebase/`, absolute quoted path). Reasons: survives
   `git rebase --continue` run anywhere (env-only `GIT_EDITOR` tricks vanish if the user continues in a
   terminal or after a restart), no printf quoting of arbitrary text, visible in `git rebase --edit-todo`.
   Delete the message directory when the rebase ends (state directory gone) or is aborted. Alternative and
   its trade-off in IQ4. For a reword nobody changed, emit plain `reword` is NOT possible without an editor;
   emit `pick` (no change) instead.
5. **Autosquash**: do not reimplement it. For the preview, either run Git (`git rebase -i --autosquash` with
   a sequence editor that only captures the todo, abort it, parse) or implement the documented rule fully
   (subject or hash-prefix match, `amend!`, chains). Recommended: capture Git's own arrangement via a
   dry-run preview command so the preview can never differ from the run (F2-06).
6. **Merges in the range**: detect and tell the user ("N merge commits will be flattened"); default off for
   `--rebase-merges` in v1 (todo editor is linear); see IQ6.
7. **Worktrees, detached HEAD, root**: rebase of the current checked-out branch only (the graph view's
   repo is the worktree). Detached HEAD is allowed and labelled. Root: offer `--root` ("from the first
   commit") in the entry menu rather than rejecting.
8. **Locale-independent detection**, **worktree-aware git dir**, **recorded commands** (labels
   `rebase.interactive`, `rebase.continue`, ...).

## 4. Slice plan: F2-01 to F2-10

Temporary IDs. The integrator renumbers. Format follows the worktree-release slice files (front matter
summary; Status, Needs, Decisions, Kind, Size, Source; Steps; Touch; Acceptance; Report). Sizes are
changed lines outside tests, as in W22.

Order and release rule: F2-01 to F2-05 are the safe core and must **ship together** (an editor without
in-progress handling strands the user at an `edit` stop). F2-06 to F2-10 can ship in later releases.
I put in-progress controls (F2-03) before the editor UI (F2-04) on purpose: the state machine is the
risk, the UI is not.

### F2-01. Todo model and Git handoff (backend only)

- **Goal:** a pure todo model plus a runner that starts `git rebase -i` with our todo.
- **Behavior:** none visible. Callable from a backend test.
- **Touch:** new `src/backend/rebase/todo.ts` (types `TodoEntry {action, hash, message?}`,
  `validateTodo`, `serializeTodo`), new `src/backend/actions/rebaseInteractive.ts` (`runInteractiveRebase`),
  possibly `src/backend/utils/gitRunner.ts` (an exported spawn helper that takes env, shares recording),
  `src/backend/types/actions.types.ts` (new action payload `interactiveRebase`), `src/extension/messageHandler.ts`
  (register), `src/backend/utils/gitDirs.ts` (reuse for the git dir).
- **Git commands and environment:** `git rebase -i [--root] <base>`; env `GIT_SEQUENCE_EDITOR=cp -- "$GGL_TODO_FILE"`
  (or a copy command resolved per spike), `GGL_TODO_FILE=<abs path>`, `GIT_EDITOR=true`, `LC_ALL=C`,
  `GIT_TERMINAL_PROMPT=0`. Todo lines: `pick|reword->pick|edit|squash|fixup|drop <full hash>`, with
  `exec git commit --amend -F '<file>'` after a reworded/edited-group target. Validation: hex hashes only,
  base not starting with `-`, first entry not squash/fixup (Git keeps a broken state for it, verified),
  at least one entry, no duplicates, hashes must be exactly the range. Outcome type:
  `completed | paused-edit | paused-conflict | invalid-todo | failed`.
- **Spike inside the slice (decides IQ3/IQ4):** does `simple-git` refuse `GIT_SEQUENCE_EDITOR` in `env`
  (the argv-parser unsafe check receives `env`)? Does the Windows path (backslash drive paths in an
  exec line, `cp` on PATH inside Git's sh) work? Record in the KB like the worktree behavior doc.
- **Tests (real Git, temp repos):** reorder; drop; edit pause (exit 0, state present); conflict pause
  (exit 1); reword single and multi-line text, non-ASCII, quotes, a `$` and a backtick; squash with edited
  and unedited message; fixup; first-entry fixup rejected before spawn; invalid hash; sequence editor
  failure leaves no state; todo file removed in all outcomes; repo path with spaces and `&`; linked
  worktree (git dir is `.git/worktrees/<id>`); dirty tree refusal leaves no state; detached HEAD; root.
  Unit tests for `serializeTodo`/`validateTodo`.
- **l10n:** error strings from validation (5 bundles) only if surfaced; keep Git's stderr verbatim otherwise.
- **Needs:** nothing. **Size:** ~350 lines. **Risks:** simple-git unsafe check; Windows quoting; message-file
  lifetime; GPG without a TTY (document, surface Git's error).

### F2-02. Range read and preflight

- **Goal:** everything the editor needs to know before it opens, and the checks Git will fail anyway but
  too late.
- **Behavior:** none visible alone. A "can start?" answer with reasons.
- **Touch:** new query `src/backend/queries/rebaseRange.ts`, `src/backend/types` (query types), handler
  registration in `messageHandler.ts`, `src/types.ts` for response shape.
- **Git commands:** `git log --topo-order --reverse --format=<NUL format incl. %H %P %s %b %an> <base>..HEAD`
  (or `--root`); `git rev-parse --abbrev-ref HEAD`; `git status --porcelain` for dirty; existence of state
  dirs; for published detection `git branch -r --contains <oldest>` (cap by `git for-each-ref --contains`) or
  compare against `@{upstream}`: `git merge-base --is-ancestor <commit> @{upstream}` per range (one
  `rev-list <upstream>..HEAD` gives the unpublished set cheaply). Branch-elsewhere: from W10 worktree data.
- **Result:** `{ commits[{hash, subject, body, parents, isMerge, isPublished}], mergeCount, dirty, inProgress,
  detached, branch, upstream, alreadyUsedElsewhere }`.
- **Tests:** merges flagged, root range, empty range, published vs local split with a real remote (local
  bare repo), detached HEAD, dirty states, a linked worktree.
- **l10n:** none yet. **Needs:** none (W10 data optional). **Size:** ~250. **Risks:** published detection cost
  on huge ranges (cap the range, e.g. warn above 500 commits).

### F2-03. In-progress state and controls

- **Goal:** know that a rebase is in progress, show where it stopped, and let the user continue, skip or
  abort. Covers a rebase begun anywhere (terminal mode, the existing "Drop", an external shell).
- **Behavior:** a banner above the graph while a rebase is in progress: "Rebase in progress: stopped at
  <short hash> <subject> (2 of 5)", with Continue, Skip, Abort, and for conflicts the file list and an
  Open file affordance (VS Code opens the merge editor from the file); for an `edit` stop it says "Stopped
  to amend; commit your changes, then Continue". Abort asks for confirmation.
- **Touch:** new `src/backend/queries/operationState.ts` (reads `rebase-merge/` and `rebase-apply/`
  files, `stopped-sha`, `msgnum`, `end`, `head-name`, `onto`; plus `MERGE_HEAD`, `CHERRY_PICK_HEAD`,
  `REVERT_HEAD` for context), `src/backend/actions/rebase.ts` (continue/skip/abort),
  `src/repoFileWatcher.ts` (watch `rebase-merge`, `rebase-apply`, `MERGE_HEAD`, `REBASE_HEAD` in the
  per-worktree git dir; check the debouncing), `src/types.ts`, `src/webview/` new `rebaseBanner.ts`,
  `media/` banner CSS (OKLCH), `main.ts` hook-in, `webviewL10n.ts`.
- **Git commands:** `git rebase --continue` with `GIT_EDITOR=true`, `git rebase --skip`,
  `git rebase --abort`; conflict list `git diff --name-only --diff-filter=U`; detection from files (never
  from messages). Continue after conflict: do **not** `add -A` silently (Git Graph+ does, which can stage
  unrelated files); block Continue with unresolved paths in the list and offer "Stage all resolved" only
  after the markers are gone (IQ9).
- **Tests:** real Git: edit stop, conflict stop, continue to completion, skip, abort restores branch tip,
  stale `REBASE_HEAD` after success is not "in progress" (regression like a79f444), `rebase-apply`
  (`git am`-style, from an external `git rebase` without `-i` on old Git), linked worktree state in its own
  git dir, detection while the rebase was started by the terminal mode; webview unit tests for banner
  rendering and the confirm dialog.
- **l10n:** about 12 strings (banner states, button labels, confirm text, errors). **Needs:** none (F2-01 for
  end-to-end). **Size:** ~450 (watcher + query + banner). **Risks:** watcher storm on state-file churn;
  localization of the "n of m" progress; multi-repo (the state belongs to the repo shown, not all).

### F2-04. Editor dialog: open, list, pick/drop/reorder, start

- **Goal:** the interactive editor in the graph, with the simple verbs first.
- **Behavior:** from the commit menu "Interactive Rebase..." (Git's "start after this commit") and a
  branch menu entry, and from a multi-selection (contiguous chain ending at the selection's branch tip;
  starts after the oldest selected parent). A large dialog lists commits oldest first (as the todo), with
  an action select per row (pick, drop in this slice), move up/down buttons, Shift+Up/Down, and Ctrl/Cmd+Enter
  to start. A note counts dropped commits; a notice names merge commits that will be flattened; a warning
  names published commits ("rewrites history; needs a force push"); Start is disabled until the todo
  differs from the original. The existing "Interactive" checkbox in the rebase dialog stays as the
  terminal option (IQ3).
- **Touch:** new `src/webview/rebaseEditor/` (model + view + keyboard, each cohesive and testable),
  `media/rebase-editor.css` (new, OKLCH tokens), `src/webview/main.ts` (entry points only),
  `src/extension/webviewHtml.ts` (stylesheet link), `src/contextMenuVisibility.ts` and `src/types.ts`
  (new `interactiveRebase` toggle), `package.json` (the setting that gates the menu items, per the existing
  visibility settings), `webviewL10n.ts`.
- **Git commands:** F2-02 range read, F2-01 run.
- **Tests:** webview (jsdom) for model: move, reorder, first-entry guard, change detection, keyboard; menu
  visibility; message payload to backend; integration test through the message handler against a real
  repo (as `worktreeHandlers.test.ts` does).
- **l10n:** about 25 strings x 5 bundles. **Needs:** F2-01, F2-02, F2-03. **Size:** ~700. **Risks:** the
  dialog is bigger than any current dialog (focus trap, scrolling, dark and light themes; the W06/W22
  headless render check applies); drag reorder inside a dialog (native drag API; keyboard and buttons are
  the accessible path, drag is optional polish).

### F2-05. Reword, squash, fixup and edit with messages

- **Goal:** the rest of the verbs and message editing.
- **Behavior:** the action select gains reword, edit, squash, fixup. Reword turns the row into an editable
  multi-line message pre-filled with subject and body (IQ4). A squash group shows one combined, editable
  final message (target message plus `squash` members, not `fixup`), preserved when the group is
  reordered; the first row cannot be squash/fixup. Edit stops the rebase and the F2-03 banner takes over.
  Squash of a head-chain selection can switch to this path later (IQ10).
- **Touch:** `src/webview/rebaseEditor/*`, `src/backend/rebase/todo.ts` (group/message logic, already
  specified in F2-01), `webviewL10n.ts`.
- **Git commands:** as F2-01 (`exec git commit --amend -F`).
- **Tests:** real-Git: each verb's result by log and file content; reworded multi-line; squash group
  messages with and without edits; fixup-only group with an edited message; group moved after edit; hook
  ("bypass hooks" is not offered here, a `commit-msg` hook that rejects shows as a stop that F2-03
  handles). Webview: message-state keyed by hash.
- **l10n:** ~12 strings. **Needs:** F2-04. **Size:** ~450. **Risks:** the exec amend re-runs hooks and
  re-signs once more for each reworded commit; mitigate in docs, and consider IQ4's alternative;
  Windows quoting for the message path.

### F2-06. Autosquash and creating fixup commits

- **Goal:** `fixup!`, `squash!` and `amend!` commits made in the graph, folded by Git's own autosquash.
- **Behavior:** commit menu entries Create Fixup Commit..., Create Squash Commit..., Create Reword Commit...
  (for ancestors of HEAD only; they need staged changes, or `--allow-empty` for the reword/squash message
  case), each a small dialog showing the staged file count and the message that will be written. In the
  editor, an Autosquash switch appears when markers are in the range and shows Git's arrangement
  (on by default when markers exist, and off restores source order). Setting `rebase.autoSquash` is
  respected as the default (read `git config --get rebase.autoSquash`).
- **Touch:** `src/backend/actions/commit.ts` (`commitFixup { target, kind, message }`),
  `src/backend/rebase/autosquash.ts` (preview via Git), `src/webview/rebaseEditor/*`, menus, visibility
  settings, `webviewL10n.ts`.
- **Git commands:** `git commit --fixup <c>`, `--fixup=amend:<c>`, `--fixup=reword:<c>`, `--squash <c>`
  (with `-m` only where Git allows it: `amend:` + `-m` is refused, verified); preview:
  `git rebase -i --autosquash <base>` with a sequence editor that writes the todo to a capture file and
  exits non-zero, then `git rebase --abort` only if a state directory was left (verified: a failing
  editor leaves none, so the abort is a guarded no-op). Parse lines: `pick`, `fixup`, `squash`,
  `fixup -C`.
- **Tests:** real Git: subject match, hash-prefix match, chain, `amend!` becoming `fixup -C`, no match,
  marker out of range; fixup created for a non-HEAD commit and then autosquashed through F2-01; dirty
  working tree is irrelevant for the preview (an index with changes refuses; the preview must not require
  a clean tree: use `--autostash` on the dry-run only if the spike shows Git still refuses).
- **l10n:** ~15 strings. **Needs:** F2-04, F2-05. **Size:** ~500. **Risks:** the dry-run needs a clean index
  or autostash (Git refuses otherwise), so computing the preview may need a different technique: generate
  the arrangement by running Git in a throwaway `git worktree`-free way, for example
  `git -c core.editor... rebase --autosquash` in a temp clone is heavy. If that proves unreliable, fall
  back to a faithful reimplementation of the documented rule with a parity test against real Git (this is
  the single most uncertain slice).

### F2-07. Dirty tree, published history and worktree protections

- **Goal:** make the start safe and clear.
- **Behavior:** if the tree is dirty, the dialog offers "Stash and reapply local changes" (`--autostash`),
  "Cancel", and explains. A published-commits banner needs an explicit acknowledgement checkbox before Start.
  If the branch is checked out in another worktree, the entry is disabled with the reason ("checked out
  at <path>", offer Open Worktree where W31 exists). A rebase already in progress disables the entry
  and points at the banner. A very long range prompts.
- **Touch:** `src/webview/rebaseEditor/*`, `src/backend/rebase/preflight.ts` (from F2-02),
  `rebaseInteractive.ts` (add `--autostash` and a `--no-autostash` pass-through), `webviewL10n.ts`.
- **Git commands:** `git rebase -i --autostash <base>`; the stash pop can conflict, so the F2-03 state query
  must also notice "Applying autostash resulted in conflicts" (Git keeps the stash entry; show that).
- **Tests:** real Git: autostash success, autostash conflict leaves stash and message, refusal copy for
  the in-use branch, published ahead/behind variants with a bare remote.
- **l10n:** ~10. **Needs:** F2-04. **Size:** ~300. **Risks:** autostash-pop conflict handling is the thing
  Git Graph+ never covered; keep scope to "tell the user clearly".

### F2-08. Conflict prediction for the planned todo

- **Goal:** warn before Start that this todo will stop with a conflict, and on which commit and files.
- **Behavior:** a status line in the editor ("No conflicts predicted" / "Conflict at <hash>: n files",
  with the file list popover pattern used elsewhere), re-evaluated (debounced) when the todo changes,
  cap noted when the range exceeds the probe limit.
- **Touch:** new `src/backend/queries/rebasePrediction.ts`, `src/webview/rebaseEditor/*`, `webviewL10n.ts`.
- **Git commands:** simulate the todo: for each non-dropped pick in order, `git merge-tree --write-tree
  --merge-base=<commit>^ <accumulated> <commit>` chaining the printed tree OID (Git 2.40+; below that, say
  "prediction unavailable"); a `squash`/`fixup` merges its commit onto the accumulated tree against its
  own parent the same way; stop at the first conflict; exit 1 means conflict, parse file names from the
  `-z` conflicted-file info, not from messages; cap at a probe limit and say so.
- **Tests:** real Git: no-conflict reorder, reorder that conflicts (names the commit and file), drop that
  causes a later conflict, squash that conflicts, non-ASCII path, fixup chain, the cap, Git older than
  2.40 handled by an injected "unsupported" result (the check, not the Git binary).
- **l10n:** ~6. **Needs:** F2-04, F2-05. **Size:** ~350. **Risks:** the prediction is a model, not Git's
  exact merge (rename detection, whitespace settings) - label it a prediction; cost on large ranges.

### F2-09. Plain-rebase conflict prediction and drag-to-rebase (optional, later)

- **Goal:** the Git Graph+ features that are not interactive: predict conflicts in the existing "Rebase
  current branch onto..." dialog, and rebase a branch by dragging its label onto another.
- **Behavior:** the rebase dialog gets the same status line as F2-08 (reuse). Drag a local branch label
  onto another opens a small menu "Rebase <a> onto <b>" (and a merge entry if wanted), checking out the
  source first (with the dirty-tree choice from F2-07), refusing when the source is checked out in another
  worktree.
- **Touch:** `src/webview/` (a new drag handler module, refLabels), `rebase.ts`, `messageHandler.ts`,
  `showRebaseDialog` in `main.ts`, l10n.
- **Git commands:** `git checkout <source>` then `git rebase <target>` (the existing actions) ; prediction
  from F2-08's engine.
- **Tests:** real Git for the sequence; webview for the drop menu.
- **l10n:** ~8. **Needs:** F2-07, F2-08. **Size:** ~450. **Risks:** a drag target that rewrites history with
  one gesture; keep the menu confirmation. Recommend deferring (IQ8).

### F2-10. Cleanups that the machinery enables (optional)

- Route `dropCommit`/`dropCommitSelection` through F2-01 (one rebase, one stop, works for any contiguous or
  non-contiguous selection instead of N sequential `rebase --onto` runs and the HEAD-chain restriction).
- Route `squashCommitSelection` through the todo (`pick` + `fixup`) so it no longer needs the HEAD-chain
  restriction and keeps author and hooks semantics of a real rebase.
- Replace the terminal-only interactive path or keep it behind the mode setting (IQ3).
- **Tests:** existing action tests re-pointed; new cases for non-HEAD ranges. **Needs:** F2-05.
  **Size:** ~250. **Risks:** behavior change of two existing actions; do it only with the maintainer's OK.

### Summary table

| ID | Slice | Needs | Size | Ships with |
|---|---|---|---|---|
| F2-01 | Todo model and Git handoff | none | ~350 | core |
| F2-02 | Range read and preflight | none | ~250 | core |
| F2-03 | In-progress state and controls | none | ~450 | core |
| F2-04 | Editor dialog, pick/drop/reorder, entry points | 01, 02, 03 | ~700 | core |
| F2-05 | Reword, squash, fixup, edit, messages | 04 | ~450 | core |
| F2-06 | Autosquash and fixup creation | 04, 05 | ~500 | follow-up |
| F2-07 | Dirty tree, published, worktree protections | 04 | ~300 | core or follow-up |
| F2-08 | Conflict prediction for the planned todo | 04, 05 | ~350 | follow-up |
| F2-09 | Plain-rebase prediction, drag-to-rebase | 07, 08 | ~450 | later |
| F2-10 | Route drop/squash through the todo | 05 | ~250 | later |

## 5. Decisions for the maintainer

**IQ1. Editor surface.**
(a) a large dialog in the graph webview; (b) a separate webview tab like the diff tab; (c) VS Code's own
text editor on the todo file (`GIT_SEQUENCE_EDITOR='code --wait'`), no custom UI.
Recommend (a): shares selection, theme tokens, l10n and dialog helpers, and avoids a second message
channel; keep the model in its own module so it could move to a tab. (b) is the better home if the editor
later grows a preview of each commit's diff.

**IQ2. Where in-progress controls live.**
(a) a banner in the graph webview (F2-03 as planned); (b) a VS Code status bar item plus commands;
(c) both. Recommend (a) now, commands later; the banner is where the user is looking.

**IQ3. Terminal mode.**
The checkbox "Interactive" in the rebase dialog already opens a terminal. Options: (a) keep it, add the new
editor as a second entry (recommended for 1.11: no regression, same as Git Graph+'s setting but as a visible
choice); (b) a setting `interactiveRebase.mode` (`ui` or `classic`) like Git Graph+; (c) remove the terminal
path. Recommend (a) now, converge on (b) so the menu has one "Interactive Rebase..." entry and the dialog
chooses; never drop the terminal, power users need it.

**IQ4. How reworded and squashed messages reach Git.**
(a) `exec git commit --amend -F <file>` lines (recommended: survives `--continue` anywhere, visible in the
todo, no arbitrary text in command lines; cost: an extra commit-msg hook run and an extra signature per
reworded commit); (b) a `GIT_EDITOR` script handing out prepared messages in order (one commit per step,
cleaner, but only works for a run our process supervises; a continue from the terminal after a stop would
open the user's editor); (c) inline `printf` like Git Graph+. Spike both in F2-01 before locking.

**IQ5. Protection for pushed commits.**
(a) warn only; (b) warn and require an acknowledgement checkbox (recommended); (c) refuse. Recommend (b),
with the list of published commits visible, and no automatic force push in this release (Git Graph+'s
"push after rebase" is out of scope; if wanted later, force-with-lease with its own confirmation).

**IQ6. Merge commits in the range.**
(a) refuse the editor with an explanation; (b) allow, flatten, and say so (recommended for v1: matches
Git's default, plain notice); (c) `--rebase-merges` with a todo editor that understands `label`/`reset`/
`merge` (large, later). Recommend (b), with (c) as a separate future slice.

**IQ7. Conflict prediction now?**
(a) skip entirely; (b) F2-08 in the same release; (c) F2-08 as a follow-up release (recommended). It needs
Git 2.40+ and is a model; ship the editor first.

**IQ8. Drag-to-rebase now?**
(a) no; (b) yes, F2-09. Recommend (a): it is a different feature (branch onto branch, non-interactive),
needs new drag UI that Libre does not have, and has a high "one gesture rewrites history" risk. Re-evaluate
after the core.

**IQ9. What Continue does for a conflict.**
Git Graph+ stages everything (`add -A`) then continues. Options: (a) same (simple, can stage unrelated
files); (b) continue only when no unmerged paths remain and tell the user to stage resolved files in the SCM
view (recommended); (c) offer "Stage resolved files and continue" listing the files first. Recommend (b)
with (c) as polish.

**IQ10. Should squash/drop of a selection move onto the new machinery (F2-10)?**
Recommend yes, but after F2-05 and as its own release note, because it changes two shipped actions.

**IQ11. Autosquash preview technique (F2-06).**
(a) reimplement the documented matching and test against Git (fast, risk of drift); (b) ask Git to produce
the arrangement (exact, needs a clean index or autostash, heavier). Recommend (b) if the spike works,
otherwise (a) with a parity test; either way default the toggle from `rebase.autoSquash`.

**IQ12. Visibility settings.**
New menu items join the existing per-item visibility settings (`src/types.ts`, `contextMenuVisibility.ts`)
as `interactiveRebase`, `createFixup`, and so on. Confirm names and defaults (on).

## 6. Reading list for the implementing agent

Git Graph Libre: `src/backend/actions/rebase.ts`, `src/backend/actions/commit.ts:122-176`,
`src/extension/messageHandler.ts:462-480,820-826`, `src/webview/main.ts:3575-3600,3700,3732-3794,4033-4125,4808`,
`src/repoFileWatcher.ts`, `src/backend/utils/gitRunner.ts`, `src/backend/utils/gitDirs.ts`,
`src/extension/webviewL10n.ts`, `l10n/*.json`, `media/dialogs.css`, KB worktree behavior doc and
slice files `310-w21`, `320-w22`. Rules to restate in every slice: tests with behavior, strict Biome,
OKLCH colors, American English, l10n in all five bundles, writes on the Git CLI, real-Git fixtures in
temp repos.
