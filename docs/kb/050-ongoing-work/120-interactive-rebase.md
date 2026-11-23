---
summary: >-
  The interactive rebase execution register, started on `2026-11-23` from the
  Git Graph+ research: not in release 1.11.0, worked on the `gg-plus/next`
  integration branch. Status, the clean-room rules, the agent choice, the
  decisions IQ1 to IQ12 (answered by the maintainer on `2026-11-23`, every
  recommended default accepted), the slice table (F2-01 split into a
  Haiku-sized model slice and a Git handoff slice, F2-02 to F2-10), the
  integration acceptance and the integration log.
---

# Interactive rebase (`2026-11-23`)

Status: started `2026-11-23`, not in release 1.11.0. The maintainer answered
IQ1 to IQ12 on `2026-11-23`, so the UI slices (F2-03 onward) may proceed.

Maintainer, `2026-11-23`: "we can go with reflog+blame this release but please
start work on interactive rebase and history; it may not end up shipped; start
with simple tasks Haiku can handle".

Multi-agent releases (Rules) applies. Integration branch: `gg-plus/next`, local
and unpushed, based on `main`; it is rebased onto `main` after 1.11.0 ships.
Slice branches: `rebase/F2-NN`. Worktrees: `/tmp/ggl-rebase-f2-NN`. The design
is "Git Graph+ features: research and slice plan" (Future work), subsection
"Interactive rebase" (`020-interactive-rebase.md`); where a slice file here
differs from that note, the slice file wins. Slice files live in
`120-interactive-rebase/`.

## Agent choice

Maintainer, `2026-11-23`: Claude Haiku for the simple slices, and headless
Muse Code (`muse exec --yolo`) in the slice worktree for the complex ones.
Escalate one step on failure: Haiku to Muse Code. Each slice's report records
the agent and date.

## Decisions

Answered by the maintainer on `2026-11-23`: every recommended default accepted.
The UI slices (F2-03 onward) may proceed.

- **IQ1. Editor surface.** **Answered by the maintainer on `2026-11-23`: every
  recommended default accepted.** A large dialog in the graph webview, with the model
  in its own module so it could move to a tab later.
- **IQ2. In-progress controls.** **Answered by the maintainer on `2026-11-23`:
  every recommended default accepted.** A banner in the graph webview now; status bar
  commands later.
- **IQ3. Terminal mode.** **Answered by the maintainer on `2026-11-23`: every
  recommended default accepted.** Keep the existing "Interactive" checkbox,
  which opens a terminal, and add the new editor as a second entry. Converge
  later on a `ui` or `classic` setting. Never drop the terminal path. Settled
  by the F2-01b spike, not by a vote in advance.
- **IQ4. Reworded and squashed messages.** **Answered by the maintainer on
  `2026-11-23`: every recommended default accepted.** `exec git commit --amend
  -F <file>` lines, with message files under the per-worktree git dir. Settled
  by the F2-01b spike, which spikes both options before locking.
  **Settled by the F2-01b spike (`2026-11-23`): option (a).** simple-git
  refuses `GIT_SEQUENCE_EDITOR`/`GIT_EDITOR` in `env` without
  `allowUnsafeEditor`, so the runner uses its own spawn (`runGitWithEnv`);
  a `--continue` from a plain terminal after an `edit` stop still applies
  route (a)'s prepared message, while route (b)'s was lost. Message files
  live under `<gitdir>/ggl-rebase/`. IQ3 is option (a): the terminal entry
  stays and the editor is added. Windows is not yet verified.
- **IQ5. Pushed commits.** **Answered by the maintainer on `2026-11-23`: every
  recommended default accepted.** Warn and require an acknowledgement checkbox, with
  the published commits listed. No automatic force push.
- **IQ6. Merge commits in the range.** **Answered by the maintainer on
  `2026-11-23`: every recommended default accepted.** Allow the rebase, flatten the merges
  like Git's default, and say so in a notice. `--rebase-merges` is a later,
  separate slice.
- **IQ7. Conflict prediction.** **Answered by the maintainer on `2026-11-23`:
  every recommended default accepted.** Ship the editor first; F2-08 is a follow-up
  release. It needs Git 2.40 or later and is labeled a prediction.
- **IQ8. Drag-to-rebase.** **Answered by the maintainer on `2026-11-23`: every
  recommended default accepted.** Not now. Re-evaluate after the core ships.
- **IQ9. Continue after a conflict.** **Answered by the maintainer on
  `2026-11-23`: every recommended default accepted.** Continue only when no unmerged paths
  remain, and tell the user to stage the resolved files in the SCM view. Offer
  "stage resolved files and continue" later as polish. No silent `add -A`.
- **IQ10. Squash and drop of a selection.** **Answered by the maintainer on
  `2026-11-23`: every recommended default accepted.** Move them onto the new machinery
  (F2-10) after F2-05, with a release note of its own, because it changes two
  shipped actions.
- **IQ11. Autosquash preview.** **Answered by the maintainer on `2026-11-23`:
  every recommended default accepted.** Ask Git for the arrangement if the spike works,
  otherwise reimplement the documented rule with a parity test against real
  Git. Either way the toggle defaults from `rebase.autoSquash`. Settled by the
  F2-06 spike, not by a vote in advance.
- **IQ12. Visibility settings.** **Answered by the maintainer on `2026-11-23`:
  every recommended default accepted.** New menu items join the existing per-item
  visibility settings as `interactiveRebase`, `createFixup` and so on, default
  on.

## Clean-room rules

Research section 0 governs. Git Graph+ is Apache-2.0, and this project is
AGPL-3.0. Every slice implements from Git's documentation, VS Code APIs and
this project's own patterns, and copies no Git Graph+ code. Git Graph+ may be
read only for behavior, and the slice's report says that the reading was
behavioral only. Never read `vscode-git-graph-rs/src`, `/web` or
`illegal_forks`. A slice that wants to take code from any source stops and
reports. The foreign notice in `src/git/git-graph-builder.ts` (SourceGit) is
the graph layout, outside this work; no slice reads it.

## Slices

| ID | Work | Needs | Model | Status |
| --- | --- | --- | --- | --- |
| F2-01a | Todo model (pure) | — | Haiku | integrated `9f7d0865` |
| F2-01b | Git handoff and spike | F2-01a | Muse Code | integrated `3d39ecaf` |
| F2-02 | Range read and preflight | — | Muse Code | integrated `16b65eb2` |
| F2-03 | In-progress state and controls | — | Muse Code | integrated `40fbf8f4` |
| F2-04 | Editor dialog: open, list, pick/drop/reorder, start | F2-01b, F2-02, F2-03 | Muse Code | integrated `48be134c` |
| F2-05 | Reword, squash, fixup and edit with messages | F2-04 | Muse Code | integrated `4c62b924` |
| F2-06 | Autosquash and fixup creation | F2-04, F2-05 | Gemini 4 Neon | integrated `94db854d` |
| F2-07 | Dirty tree, published history and worktree protections | F2-04 | Gemini 4 Neon | integrated `7257f2cf` (merge) |
| F2-08 | Conflict prediction for the planned todo | F2-04, F2-05 | Gemini 4 Neon | integrated `9e04c8e5` |
| F2-09 | Plain-rebase prediction and drag-to-rebase | F2-07, F2-08 | Muse Code | deferred (IQ8: not now, after the core ships) |
| F2-10 | Route drop and squash through the todo | F2-05 | Muse Code → Gemini 4 Neon | integrated `32217651` (merge) |

F2-01 is split for the agent choice: F2-01a is pure, with no Git and no UI, so
Haiku can take it. F2-01b holds the Git handoff and the IQ3/IQ4 spike.
F2-02 is marked Muse Code because it runs several Git reads and a
preflight contract, which is more than a mechanical slice.

Order and release rule (research section 4): F2-01 to F2-05 are the safe core
and ship together, because an editor without in-progress handling strands the
user at an `edit` stop. F2-06 to F2-10 can ship later.

## Integration acceptance

Each slice is reviewed, rebased onto `gg-plus/next`, fast-forwarded and gated as
the Reflog and Blame releases were: strict Biome on touched files, typecheck,
the full test suite, `l10n:check` when user-visible text changed, the KB check,
and the Rust arm plus an addon rebuild when `engine/**` changed. Before a
release ships, the integrator runs `pnpm run package`, coverage, SonarQube
with an explicit gate poll (`OK` required), `kb:index`, `kb:check` and
`kb:graph`, and the README and CHANGELOG entries. A headless render of the
editor in both themes is part of the acceptance for any UI slice. Nothing is
pushed, and nothing is tagged without the maintainer.

## Integration log

- `2026-11-23`: register and slice files written from the research.
- `2026-11-23`: F2-01a (Claude Haiku) integrated into `gg-plus/next` at
  `9f7d0865` by fast-forward: the pure todo model `src/backend/rebase/todo.ts`
  (`validateTodo`, `serializeTodo`, outcome type), 38 unit tests; hashes match
  case-insensitively and serialize lower case. Gates in its worktree: strict
  Biome clean, typecheck clean, backend suite 1,543 passed (60 skipped, as
  in every linked worktree), KB check clean. F2-01b is ready.
- `2026-11-23`: F2-01b (Muse Code) integrated into `gg-plus/next` at `3d39ecaf` by
  fast-forward: `runInteractiveRebase` (`src/backend/actions/rebaseInteractive.ts`)
  with the env-carrying spawn `runGitWithEnv`, the todo written into the
  per-worktree git dir and removed in every outcome, outcome classification
  from state files and exit code, the `interactiveRebase` action registered;
  real-Git tests. The spike settles IQ3 (a) and IQ4 (a) (recorded above).
  Follow-ups from its report: F2-03's abort and finishing continue remove
  `<gitdir>/ggl-rebase/`; F2-05 refuses an empty reword message before Start;
  Windows verification of the copy command and exec-line paths is owed.
- `2026-11-23`: F2-02 (Muse Code) rebased and integrated at `16b65eb2`: the
  `rebaseRange` query (`src/backend/queries/rebaseRange.ts`) and the pure
  `evaluateRebasePreflight` (`src/backend/rebase/preflight.ts`), registered in
  the message handler. Follow-ups: route its worktree list through the
  engine-backed reader when F2-04 wires the UI; F2-04's entry points should
  offer ancestors, since the range is the literal `base..HEAD`.
  Both reports were committed before the machine rebooted (`/tmp` worktrees
  lost, branches intact); the worktrees were recreated under
  `/home/zam/Desktop/prog/_GGL/.ggl-wt/`. Gates on `16b65eb2`: strict Biome on
  touched files clean; typecheck clean; backend 1,627 passed (60 skipped, as
  in every linked worktree) and webview 1,096 passed; KB check clean.
  F2-03 is ready.
- `2026-11-23`: maintainer accepted all recommended IQ defaults; `gg-plus/next`
  rebased onto `main` (`7db1d290`) so the Git Graph+ work sees release 1.11.0's
  KB and code; F2-03 dispatched to Muse Code.
- `2026-11-23`: F2-03 integrated into `gg-plus/next` at `40fbf8f4` (first run
  Muse Code, cut off by its quota; finished by Gemini 4 Argon through `agy`):
  the in-progress state read from the per-worktree git dir, a banner above
  the graph for `edit` and conflict stops with progress, Continue (blocked
  while unmerged paths remain, IQ9; no silent `add -A`), Skip and Abort
  (confirmed first), removing `<gitdir>/ggl-rebase/` when the rebase ends,
  and a watcher on the rebase state. Integrator conflict resolution: the
  `rebase.*` and `stats.*` l10n blocks were both placed before the first
  `reflog.` key; both kept (`prompts/resolve-l10n.py`, 912 keys). Renders
  under `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-03/`. Gates on
  `40fbf8f4`: strict Biome on 20 files, typecheck, `l10n:check`, KB check,
  backend 1,697 passed (60 skipped) and webview 1,165 passed. F2-04 is ready.
- `2026-11-23`: F2-04 (Muse Code; first run cut off by its quota, finished by
  a second Muse Code run) integrated into `gg-plus/next` at `48be134c`: the
  editor dialog from the commit menu "Interactive Rebase...", the todo list
  with pick and drop, keyboard and drag reordering, Start through the F2-01b
  handoff, and a per-group visibility toggle for the menu item. Multi-select
  reuses the loaded first-parent `HEAD` chain rule, so a selection ending at
  a non-`HEAD` branch tip is not offered. F2-07's published-commit
  acknowledgement exists only as the model hook `requirePublishedAck`
  (default off, no checkbox yet). 35 `rebase.*` keys, agent-translated.
  Renders under `/home/zam/Desktop/prog/_GGL/.ggl-wt/renders/F2-04/` (dark,
  light; forced colors pinned by a CSS guard test, not rendered). Gates on
  `48be134c`: strict Biome on 17 files, typecheck, `l10n:check`, KB check,
  backend 1,709 passed (60 skipped) and webview 1,190 passed. F2-05 and F2-07
  are ready and run in parallel (overlap allowed; the integrator resolves).
- `2026-11-23`: F2-05 (Muse Code) integrated into `gg-plus/next` at
  `4c62b924`: reword, squash, fixup and edit in the editor with message
  editing, squash groups (`findSquashGroups`, which F2-06 builds on), and the
  `exec` amend that applies edited messages (hooks and signing run again per
  reworded commit or edited group, measured in F2-01b as Git's own reword
  cost). Agent-translated strings in the `rebase.` block. Gates on
  `4c62b924`: strict Biome on 17 files, typecheck, `l10n:check`, KB check,
  backend 1,725 passed (60 skipped) and webview 1,203 passed. F2-06, F2-08
  and F2-10 are ready; F2-06 and F2-10 start now beside F2-07, and F2-08
  follows one of them so the editor model does not get a fourth parallel
  writer.
- `2026-11-23`: F2-07 (Gemini 4 Neon, `agy`) integrated into `gg-plus/next` at
  `7257f2cf`, the first integration by **merge** under the new no-squash
  rule: F2-07 ran beside F2-05, so a rebase conflicted; Neon merged
  `gg-plus/next` into `rebase/F2-07` (one signed merge commit; `model.ts`
  keeps F2-05's `guardSquashRows` with F2-07's `longRangeConfirmPending`,
  also cleared on a message edit; `view.ts` combines F2-07's protection
  notices with F2-05's message notices and keeps F2-05's chrome/interactive
  split), and the integrator fast-forwarded. F2-07 adds the dirty-tree,
  published-history (the IQ5 acknowledgement checkbox gating Start) and
  worktree protections. Gates on `7257f2cf`: strict Biome on 17 files,
  typecheck, `l10n:check`, KB check, backend 1,734 passed (60 skipped) and
  webview 1,216 passed. F2-06 and F2-10 were cut off by Muse Code's quota
  at about 16:50 UTC and are queued to continue at 21:03 UTC; F2-08 goes to
  Gemini 4 Neon now. F2-09 waits for F2-08.
- `2026-11-23`: F2-08 (Gemini 4 Neon, `agy`) integrated into `gg-plus/next` at
  `9e04c8e5` (it started from the tip, so no rebase was needed): conflict
  prediction for the planned todo. Gates on `9e04c8e5`: typecheck,
  `l10n:check`, KB check, backend 1,754 passed (60 skipped) and webview
  1,221 passed (`integrate.sh` failed only at its last line because the
  integrator edited the script mid-run; the fast-forward was done by hand
  after the gate had passed). F2-09 stays deferred: IQ8's answer is "not
  now, re-evaluate after the core ships". Open: F2-06 and F2-10 (queued for
  Muse Code at 21:03 UTC), then the 1.11.0 sync merge of `main`.
- `2026-11-23`: F2-10 integrated into `gg-plus/next` at `32217651` by merge.
  Muse Code started it and was cut off by its quota with the work
  uncommitted; Gemini 4 Neon finished it (its own `rendering.test.ts` run
  hung at 100 % CPU for 40 minutes and was stopped by the integrator; the
  finished slice passes that suite, 112 tests, within a time limit) and then
  merged `gg-plus/next` into `rebase/F2-10` (only `src/webview/main.ts`
  conflicted: `buildSelectedCommitContextMenu` keeps F2-10's loaded
  `HEAD`-chain rule with F2-07's and F2-08's additions). Drop and squash of a
  selection now go through the interactive todo, the `HEAD`-chain gate is
  lifted, and the hook bypass (`noVerify`) on selection actions is gone, so
  hooks run as Git runs them. IQ10 asks for its own release note: the
  proposed text is in F2-10's Report, for the Git Graph+ release notes.
  Gates on `32217651`: strict Biome on 28 files, typecheck, `l10n:check`,
  KB check, backend 1,765 passed (60 skipped) and webview 1,222 passed.
  Open on this track: F2-06 (Muse Code, 21:03 UTC); F2-09 deferred (IQ8).
- `2026-11-23`: F2-06 (Gemini 4 Neon, `agy`; Muse Code's run had only
  claimed it before its quota ran out, and the claim was rebased onto the
  tip) integrated into `gg-plus/next` at `94db854d`: an autosquash switch
  that follows `rebase.autoSquash`, fixup creation from the commit menu
  (`commitFixup`, with `fixup -C` / `amend!` support) and a pure autosquash
  arrangement for the editor. IQ11's spike ran `git rebase -i --autosquash`
  with a failing sequence editor on real Git 2.56.1: clean on a clean tree,
  but not on a dirty one, so the editor arranges the todo itself, with
  real-Git parity tests (subject and hash-prefix matches, chains, `amend!`,
  markers outside the range). Gates on `94db854d`: typecheck, `l10n:check`,
  KB check, backend 1,785 passed (60 skipped) and webview 1,229 passed. The
  interactive rebase track is integrated except F2-09 (deferred, IQ8).
