---
summary: >-
  F2-01b: the Git handoff for interactive rebase: `runInteractiveRebase` writes
  the todo into the per-worktree git dir and starts `git rebase -i` with an
  environment-based sequence editor, plus the spike that settles IQ3 and IQ4,
  with real-Git tests. Waits for F2-01a.
---

# F2-01b — Git handoff and spike

Status: done — awaiting integration

Needs: F2-01a

Model: Muse Code (`muse exec --yolo` in the slice worktree)

Read first: `AGENTS.md`; `docs/kb/README.md` in full and every *always read*
section; Multi-agent releases (Rules); the register
(`050-ongoing-work/120-interactive-rebase.md`) for decisions IQ3, IQ4 and the
clean-room rules; the F2-01a report and `src/backend/rebase/todo.ts`; research
sections 1.2, 1.3, 3 (principles 1 to 4) and 4 (F2-01) of
`060-future-work/040-git-graph-plus-features-research-and-plan/020-interactive-rebase.md`;
the worktree behavior note `050-ongoing-work/050-release-1-10-0-the-worktrees/040-git-worktree-behavior-verified.md` for the `gitDirs` precedent.

Rules for every slice: implement from Git's documentation and this project's
own patterns. Git Graph+ was read for behavior only, and copies no code. Tests
use real Git in temporary directories only, and never read the user's global
git config (point `GIT_CONFIG_GLOBAL` at a temporary file). Strict Biome on
touched files, no `var`, American English. Every user-visible string goes into
all five l10n bundles, if the slice adds one. No new telemetry events or
declarations. Do not bump versions or edit CHANGELOG, README or notices.
Report `Sonar: integrator`.

## Touch

- `src/backend/actions/rebaseInteractive.ts` (new): `runInteractiveRebase`
- `src/backend/utils/gitRunner.ts`: an exported spawn helper that accepts an
  environment and goes through `runGitCommand`, so command recording and error
  normalization stay (precedents: `runGitWithInput`, `queries/remoteTags.ts`)
- `src/backend/utils/gitDirs.ts`: reuse only, to resolve the per-worktree git dir
- `src/backend/types/actions.types.ts`: the payload for `interactiveRebase`
- `src/extension/messageHandler.ts`: register the action only
- `tests/backend/actions/rebaseInteractive.test.ts` (new, real Git)
- `src/backend/rebase/todo.ts`: no rule changes; add only what the handoff needs, with a test
- this slice file's `Status:` line and `## Report`

Nothing in `src/webview/` changes in this slice.

## Task and acceptance

**Spike first (decides IQ3 and IQ4; record the answers in the Report before
the handoff code is locked):**

1. Does `simple-git` refuse `GIT_SEQUENCE_EDITOR` (or any editor variable) in
   its `env`? The `@simple-git/argv-parser` unsafe check (`allowUnsafeEditor`)
   may block it. Research section 2 says this was not run. Test it. If it is
   refused, use a dedicated spawn (the planned route) and do not change
   `gitClient.ts` options to allow the override.
2. IQ4: compare the two message routes on real repositories: (a) `exec git
   commit --amend -F <file>` lines, and (b) a `GIT_EDITOR` script handing out
   prepared messages in order. Record which one survives a `git rebase
   --continue` run from a terminal after a stop, and which runs hooks and
   signatures how often.
3. Windows: whether the copy command `cp -- "$GGL_TODO_FILE"` and the path
   handling work inside Git for Windows' `sh`. This slice runs on Linux only,
   so mark Windows as not verified in the Report.

**Handoff behavior:**

- `runInteractiveRebase` validates with `validateTodo`, then writes the
  serialized todo to a file in the per-worktree git dir (through `gitDirs.ts`,
  never `<repo>/.git`).
- It spawns `git rebase -i <base>` (with `--root` when the base is the root
  case, which F2-02 provides) with `GIT_SEQUENCE_EDITOR` set to a copy command
  that reads the path from `GGL_TODO_FILE` (for example `cp -- "$GGL_TODO_FILE"`,
  final form from the spike), `GGL_TODO_FILE` set to the absolute path,
  `GIT_EDITOR=true`, `LC_ALL=C`, and `GIT_TERMINAL_PROMPT=0`. The environment
  is set on that one process only.
- It deletes the todo file in `finally`, in every outcome.
- Reword and edited-group messages: the message files live under
  `<gitdir>/ggl-rebase/` (absolute, quoted paths); deleting them when the
  rebase ends or is aborted is required. The exact mechanism follows the
  IQ4 spike result.
- Classification: exit 0 with no state is `completed`. Anything else reads state
  files, never messages, and maps to `paused-edit` (exit 0 with
  `stopped-sha`), `paused-conflict` (exit 1 with unmerged paths), `invalid-todo`
  (a state directory left with a todo Git will not run), or `failed`. Git's
  stderr is kept verbatim when it is surfaced.
- Never decide "paused" from the existence of the directory alone.

**Tests (real Git, temporary repositories):**

- reorder; drop; `edit` pause (exit 0, state present); conflict pause (exit 1);
- reword single line and multi-line, non-ASCII, quotes, a `$` and a backtick;
- squash with an edited and an unedited message; fixup;
- a first-entry fixup rejected before any spawn; an invalid hash rejected;
- a sequence-editor failure leaves no state; the todo file is removed in all outcomes;
- a repository path with spaces and `&`; a linked worktree (git dir is `.git/worktrees/<id>`);
- a dirty tree refusal leaves no state; detached HEAD; a root range.

Each outcome is asserted by the log, the file content or the state files, never
by Git's message text, because the tests run with `LC_ALL=C` and must not
depend on it.

## Checks

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts file>
pnpm run typecheck
pnpm exec vitest run tests/backend/actions/rebaseInteractive.test.ts tests/backend/rebase/todo.test.ts
```

## Report

- **Agent / date:** Muse Code (`muse-wonder-full-1.0`), 2026-11-23 02:09 (claim) to 2026-11-23 02:23 (report). Environment: Linux, Git 2.56.1, Node 26.13.1, simple-git 3.36.0. Git Graph+ was read for behavior only, through the research section; the implementation is from Git's documented and observed behavior and this project's own patterns, and copies no code.
- **Branch and commits:** `rebase/F2-01b` — `f6407f0f G docs(kb): claim the Git handoff slice (F2-01b)`; `69a7675b G feat(git): add an environment-carrying Git spawn helper (F2-01b)`; `64610cb8 G feat(rebase): add the interactive rebase Git handoff (F2-01b)`; `64e07046 G test(rebase): cover the interactive rebase handoff on real Git (F2-01b)`; `177a2678 G fix(rebase): absolute todo path and verbatim stderr (F2-01b)`; this report commit (see git log).
- **Files changed:** `src/backend/actions/rebaseInteractive.ts` (new, +303); `src/backend/utils/gitRunner.ts` (+83/−1: `runGitWithEnv`); `src/backend/types/actions.types.ts` (+14: the `interactiveRebase` payload); `src/extension/messageHandler.ts` (+15: registration only); `tests/backend/actions/rebaseInteractive.test.ts` (new, +528); this slice file (claim, status, report). `src/backend/rebase/todo.ts` and `src/backend/utils/gitDirs.ts` are reused unchanged. Nothing in `src/webview/`, no l10n bundles, no manifest, version, changelog, README or notices.
- **Tests added or changed:** 21 new tests in `tests/backend/actions/rebaseInteractive.test.ts` (1 classifier unit test over the recorded state shapes; 20 real-Git tests in isolated temporary repositories: reorder, drop, edit pause, conflict pause, reword single-line and multi-line with non-ASCII, quotes, `$` and backtick, reword surviving a plain terminal continue, squash edited and unedited, fixup plain and edited, first-entry fixup and bad hash rejected before any spawn (asserted by an empty command record), sequence-editor failure, todo file removed in completed, paused, conflicted and failed outcomes, a path with spaces and `&`, a linked worktree, dirty tree, detached HEAD, `--root`, an already-running rebase refused, and a hook-rejected exec amend classified as a stop). Test count before: 0 in this file; after: 21. Outcomes are asserted by the log, file content and state files, never by Git's message text.
- **Gates:** `npx biome check --config-path biome.strict.jsonc --error-on-warnings` on all five touched `.ts` files (the handler, the new action, the types, `gitRunner.ts`, the test): exit 0 (the config schema notice, 2.5.13 configured against CLI 2.6.8, is pre-existing). Typecheck (`tsc -p ./src`, `./src/webview`, `./tests`, each `--noEmit`, also via `pnpm run typecheck`): exit 0. Focused: `vitest run --project backend rebaseInteractive + todo + gitRunner`: 63 passed; with `gitDirs` and the plain rebase action tests: 76 passed. Whole suite once on the final code, `pnpm run test`: backend 117 files, 1,590 passed and 60 skipped; webview 85 files, 1,096 passed. `pnpm run l10n:check`: all translations complete (no bundle or webview string changed; see Deviations). `node ./docs/kb/housekeeping.mjs --check`: exit 0. No `engine/**` change, so no Rust arm. No visual change, so no headless renders. Sonar: integrator.
- **Acceptance:**
  - Spike before the handoff was locked: met (results below; throwaway scripts and repos under `/tmp/ggl-spike-f2-01b/`, not committed, safe to re-run or delete).
  - `runInteractiveRebase` validates with `validateTodo`, writes the serialized todo into the per-worktree git dir through `resolveGitDirs` (never `<repo>/.git`), and deletes it in `finally` in every outcome: met (tests assert absence after completed, paused, conflicted and failed runs; the linked-worktree test asserts state and messages under `.git/worktrees/<id>/` and none in the main `.git`).
  - Spawn: `git rebase -i <base>`, or `--root` when `base` is null, through the new `runGitWithEnv` (dedicated spawn, recording and error normalization kept), with `GIT_SEQUENCE_EDITOR=cp -- "$GGL_TODO_FILE"`, `GGL_TODO_FILE` an absolute path, `GIT_EDITOR=true`, `LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`, on that one process only: met. The copy command survives a repository path with spaces and `&` (Git shell-quotes the todo path it appends; verified in spike and test).
  - Messages (IQ4 route (a)): a reword, or a squash group whose target carries a message, becomes its lines plus one trailing `exec git commit --amend -F '<file>'`; files live under `<gitdir>/ggl-rebase/` with per-run unique names and absolute single-quoted paths. They are deleted when the run completes or fails without state; while Git's state is left they stay, because the remaining exec lines still name them: met, with the abort-side deletion handed to F2-03 (Deviations).
  - Classification from state files and exit code, never messages, and never from the directory's existence alone: met. Exit 0 with no state is `completed`; state with unmerged paths is `paused-conflict`; state with `stopped-sha`, or with progress in `done` (a failed exec stop), is `paused-edit`; state with neither is `invalid-todo`; anything else is `failed`. Git's stderr is returned verbatim on the result and surfaced untrimmed by the handler.
  - The action is registered in `messageHandler.ts` only; a pause is a successful start (status null, F2-03's surface takes over) and `failed` / `invalid-todo` surface Git's stderr as the action error: met.
- **Spike results (settle IQ3 and IQ4; for the register):**
  - **simple-git refuses the editor variables.** With simple-git 3.36.0, `.env("GIT_SEQUENCE_EDITOR", ...).raw(["rebase", "-i", base])` throws `GitPluginError: Use of "GIT_SEQUENCE_EDITOR" is not permitted without enabling allowUnsafeEditor` before spawning (repository unchanged); `GIT_EDITOR` in `env` and `-c sequence.editor=` in args are refused the same way. So the dedicated spawn is required, and `gitClient.ts` was not changed to allow the override, as the slice directs. **IQ3 outcome: option (a)** — the existing terminal "Interactive" path is untouched and stays as its own entry; the editor path is the new headless spawn (its UI is F2-04). Nothing about the terminal path needs to change for the handoff to work.
  - **IQ4 outcome: option (a), `exec git commit --amend -F <file>` — this is the chosen option for the register.** On real repositories (Git 2.56.1): with an `edit` stop before the reworded commit, a `git rebase --continue` run from a plain terminal applied route (a)'s prepared message, because the exec line sits in Git's own todo; route (b)'s prepared message was lost (with `GIT_EDITOR=true` the original message was kept; a real terminal would open the user's editor instead). Hooks and signatures, measured with counting `commit-msg` / `post-commit` hooks and a fake `gpg.program` that logs each signing call: the two routes are identical per reworded commit that Git actually recreates — `commit-msg` once (for the new message only; plain picks do not run it), `post-commit` twice, signing twice — because Git's own `reword` is itself a pick followed by an amend. When the range sits directly on its own parent, Git does not recreate the pick and each count is once, again in both routes. The research's expectation that route (b) is cheaper does not hold on this Git, so (a) costs nothing extra and survives every continue.
  - **Classification facts measured** (Git 2.56.1, `LC_ALL=C`, isolated config): sequence-editor failure exits 1 with no state; a dirty tree exits 1 with no state; an `edit` stop exits 0 with `rebase-merge/` and `stopped-sha`; a conflict stop exits 1 with `stopped-sha` and the file in `git diff --name-only --diff-filter=U`; a leading-`fixup` todo exits 1 leaving `rebase-merge/` with no `stopped-sha` and no `done` file (no line ran); a failed `exec` line (hook rejecting the amend) exits 1 leaving state with no `stopped-sha` but a `done` file listing the pick and the exec. Those shapes are exactly what `classifyRebaseOutcome` encodes.
  - **Windows: not verified.** This slice ran on Linux only. From Git's documentation and the research notes: Git for Windows runs editor and `exec` commands through its bundled `sh`, where `cp` exists, and the env-variable-plus-quoted-`"$VAR"` form carries no spliced OS path, which is the shape that works there. The `exec` lines do splice an absolute path in single quotes; inside `sh` single quotes a `C:\…` path passes its backslashes literally to `git.exe`, which accepts them, but that is reasoning, not a run. The first Windows verification should run a reword in a path with spaces; if drive-letter paths fail there, writing the exec path with forward slashes is the fix to try first.
- **Deviations from the slice:**
  - `src/backend/rebase/todo.ts` is unchanged: the handoff needed nothing from it. Group and message planning lives in the runner, which reuses `serializeTodo` per line and inserts the exec lines; F2-05 may lift that into `todo.ts` under its own Touch list.
  - Payload shape, which the slice left open: `interactiveRebase: { base: string | null, entries, rangeHashes }`, where `base: null` is the root case and `rangeHashes` comes from the caller (F2-02's range read). The runner's backend input adds `binary` (from `config.gitPath()`, threaded by the handler) and a test-only `sequenceEditor` override that is not part of the payload.
  - The runner refuses, before spawning, when `rebase-merge` / `rebase-apply` already exists in the worktree's git dir. The slice does not ask for it, but otherwise a left-over pause would be misclassified as this run's outcome; a test pins that the earlier rebase is left intact.
  - Message files are not deleted by this slice when a paused rebase is later aborted or finished from elsewhere: deleting them at that point belongs to the abort/continue actions, which are F2-03's Touch list, not this one's. They are small text files with per-run names under `<gitdir>/ggl-rebase/`, and this slice deletes its own whenever its run ends without state.
  - No l10n work: the slice adds no webview or bundle string. The only new user-surfaced text is backend action error sentences in the existing unlocalized style of the other actions (for example "A rebase is already in progress."), plus Git's own stderr verbatim. `l10n:check` reports complete, unchanged.
- **Open questions / follow-ups:**
  - For the integrator: record IQ3 as option (a) (terminal entry kept, editor added) and IQ4 as option (a) (`exec git commit --amend -F` with files under `<gitdir>/ggl-rebase/`) in the register, settled by this spike.
  - For F2-03: when its abort action (and a continue that finishes the rebase) runs, remove `<gitdir>/ggl-rebase/`; this slice keeps those files exactly while Git's state exists. Its state reader can reuse the shapes `classifyRebaseOutcome` documents.
  - For F2-05: an empty reword message currently reaches Git, whose exec amend then fails and stops the rebase as `paused-edit`; the editor should refuse an empty message before Start.
  - Windows verification of the copy command and the exec-line paths is still owed (see the spike note); nothing in this slice ran on Windows.
