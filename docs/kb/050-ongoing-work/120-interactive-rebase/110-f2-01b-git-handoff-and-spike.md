---
summary: >-
  F2-01b: the Git handoff for interactive rebase: `runInteractiveRebase` writes
  the todo into the per-worktree git dir and starts `git rebase -i` with an
  environment-based sequence editor, plus the spike that settles IQ3 and IQ4,
  with real-Git tests. Waits for F2-01a.
---

# F2-01b — Git handoff and spike

Status: ready

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

Not started.
