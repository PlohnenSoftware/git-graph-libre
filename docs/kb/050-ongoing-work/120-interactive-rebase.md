---
summary: >-
  The interactive rebase execution register, started on `2026-11-23` from the
  Git Graph+ research: not in release 1.11.0, worked on the `gg-plus/next`
  integration branch. Status, the clean-room rules, the agent choice, the
  provisional decisions IQ1 to IQ12, the slice table (F2-01 split into a
  Haiku-sized model slice and a Git handoff slice, F2-02 to F2-10), the
  integration acceptance and the integration log.
---

# Interactive rebase (`2026-11-23`)

Status: started `2026-11-23`, not in release 1.11.0.

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

Provisional default (recommended), to be confirmed by the maintainer before any
slice that ships UI (F2-04 onward). Until then the slices that need one stay
`waiting`.

- **IQ1. Editor surface.** A large dialog in the graph webview, with the model
  in its own module so it could move to a tab later.
- **IQ2. In-progress controls.** A banner in the graph webview now; status bar
  commands later.
- **IQ3. Terminal mode.** Keep the existing "Interactive" checkbox, which opens
  a terminal, and add the new editor as a second entry. Converge later on a
  `ui` or `classic` setting. Never drop the terminal path. Settled by the
  F2-01b spike, not by a vote in advance.
- **IQ4. Reworded and squashed messages.** `exec git commit --amend -F <file>`
  lines, with message files under the per-worktree git dir. Settled by the
  F2-01b spike, which spikes both options before locking.
  **Settled by the F2-01b spike (`2026-11-23`): option (a).** simple-git
  refuses `GIT_SEQUENCE_EDITOR`/`GIT_EDITOR` in `env` without
  `allowUnsafeEditor`, so the runner uses its own spawn (`runGitWithEnv`);
  a `--continue` from a plain terminal after an `edit` stop still applies
  route (a)'s prepared message, while route (b)'s was lost. Message files
  live under `<gitdir>/ggl-rebase/`. IQ3 is option (a): the terminal entry
  stays and the editor is added. Windows is not yet verified.
- **IQ5. Pushed commits.** Warn and require an acknowledgement checkbox, with
  the published commits listed. No automatic force push.
- **IQ6. Merge commits in the range.** Allow the rebase, flatten the merges
  like Git's default, and say so in a notice. `--rebase-merges` is a later,
  separate slice.
- **IQ7. Conflict prediction.** Ship the editor first; F2-08 is a follow-up
  release. It needs Git 2.40 or later and is labeled a prediction.
- **IQ8. Drag-to-rebase.** Not now. Re-evaluate after the core ships.
- **IQ9. Continue after a conflict.** Continue only when no unmerged paths
  remain, and tell the user to stage the resolved files in the SCM view. Offer
  "stage resolved files and continue" later as polish. No silent `add -A`.
- **IQ10. Squash and drop of a selection.** Move them onto the new machinery
  (F2-10) after F2-05, with a release note of its own, because it changes two
  shipped actions.
- **IQ11. Autosquash preview.** Ask Git for the arrangement if the spike works,
  otherwise reimplement the documented rule with a parity test against real
  Git. Either way the toggle defaults from `rebase.autoSquash`. Settled by the
  F2-06 spike, not by a vote in advance.
- **IQ12. Visibility settings.** New menu items join the existing per-item
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
| F2-03 | In-progress state and controls | — | Muse Code | ready |
| F2-04 | Editor dialog: open, list, pick/drop/reorder, start | F2-01b, F2-02, F2-03 | Muse Code | waiting |
| F2-05 | Reword, squash, fixup and edit with messages | F2-04 | Muse Code | waiting |
| F2-06 | Autosquash and fixup creation | F2-04, F2-05 | Muse Code | waiting |
| F2-07 | Dirty tree, published history and worktree protections | F2-04 | Muse Code | waiting |
| F2-08 | Conflict prediction for the planned todo | F2-04, F2-05 | Muse Code | waiting |
| F2-09 | Plain-rebase prediction and drag-to-rebase | F2-07, F2-08 | Muse Code | waiting |
| F2-10 | Route drop and squash through the todo | F2-05 | Muse Code | waiting |

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
