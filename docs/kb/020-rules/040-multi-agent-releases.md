---
summary: >-
  Standing rules for a release worked by several agents, one slice each, and
  integrated by a maintainer or one integrator. The agent protocol: read
  first, claim one slice, work in the workspace the orchestrator prepared,
  hard safety rules, coding rules, slice checks against integration gates,
  small signed commits with `Refs` for issues, the report template, when to
  stop. The integrator procedure: choosing agent and model cheapest first,
  preparing and recycling worktrees, integrating in dependency order, wave
  gates, the integration log, and the never-list. A release names its own
  branches, ID prefix, decisions and integration branch in its own files.
---

# Multi-agent releases

This section holds the lasting, release-independent rules for working a release
through several agents at once. A release does not copy it. Its own overview,
its decisions file, and its own agent protocol and integrator procedure say
"follow Multi-agent releases", then list only what differs: the branch names,
the ID and decision prefixes, the integration branch, the commit suffix, and
the release's own slices, gates and issue mapping. Where a release's files
say something this section does not, they say so explicitly and it applies
for that release only. Where they are silent, this section applies as written.

Placeholders used below:

- `<release-prefix>/<ID>`: a slice's branch, for example `wt-1.10.0/W02`.
- `<ID>`: a slice's ID, which also ends its commit subject.
- `<integration-branch>`: the local branch the release's decisions file names
  for integration.
- *the overview*: the release's overview file. *the decisions file*: its
  maintainer decisions file.

Origin: the 1.9.0 release's protocol and procedure, which the maintainer
instructed on `2026-10-19`. Made standing by decision Y15 (b) of release 1.10.0,
`2026-11-05`.

## Agent protocol

Read this whole section before touching a slice, every session. Anything it
does not cover follows the rest of the knowledge base, and where the two
conflict, you stop and report.

### 1. Before you start

1. Read `AGENTS.md`, then `docs/kb/README.md` in full, then every section it
   marks *always read*.
2. Read the overview and the decisions file.
3. Pick a slice whose file says `Status: ready`. Every slice named in its
   `Needs:` line must be `integrated`, and every decision it names must be
   answered in the decisions file. If none qualifies, report that and stop.
4. Read the whole slice file, and every file listed under its *Read first*.
5. **Claim it.** In the slice file only, set
   `Status: claimed by <agent name> on <YYYY-MM-DD HH:MM>`. Never claim more
   than one slice, and never touch a slice another agent has claimed. Commit
   the claim on its own at once.

### 2. Workspace

- **The orchestrator prepares your workspace.** Before dispatch it creates
  your branch from the integration branch and checks it out in a worktree
  that the dispatch names. Don't create a branch or worktree of your own, and
  don't rebase the one you are given.
- First thing in the session, confirm the starting point:

  ```bash
  cd <the worktree the dispatch names>
  git status --short                 # must be empty
  git log -1 --format='%h %s'        # must equal the dispatch's base commit
  pnpm install --frozen-lockfile
  ```

  If the worktree is dirty or on another base, stop and report.
- Work only in that worktree. Never edit the maintainer's main checkout.
- A slice that changes the native engine builds it before its TypeScript tests
  run, as the release's notes say, or those tests load a stale binary.

### 3. Hard rules

Breaking one of these fails the slice, whatever else it achieved.

1. **Never push, open a pull request, or comment on an issue.** The maintainer
   integrates and publishes.
2. **Never commit without a signature.** Every commit shows `G` in
   `git log --format='%h %G? %s' -1`. If signing fails, leave the work
   uncommitted and stop. Never pass `--no-gpg-sign`, `-c commit.gpgsign=false`,
   or `--no-verify`.
3. **Stay inside the slice's *Touch* list.** Its test files, and the
   `## Report` section and `Status:` line of its own slice file, are always
   allowed. Anything else means you stop and report.
4. **Never weaken a check to pass it.** Don't skip, disable or loosen a test or
   an assertion. Don't add a suppression comment or a lint exclusion. Don't
   raise a threshold. Don't edit lint, Sonar, test-runner, compiler or CI
   configuration unless the slice says so.
5. **No new dependency unless the slice names it at an exact version.** Never
   run a command that upgrades everything else (`pnpm add` does); edit the
   manifest by hand and install.
6. **No destructive git commands** (`reset --hard`, `clean -fdx`,
   `push --force`, `branch -D`, rebasing anything but your own slice branch),
   and nothing that reaches into another worktree. Never delete a file the
   slice did not create unless the slice says to.
7. **Tests touch only temporary directories.** Build test repositories with the
   project's test helper. Never read or write the user's real global git
   config, their repositories, or anything outside the temporary directory.
   When a test depends on global config, point it at a temporary file.
8. **No secrets** in code, logs, tests, reports or commit messages.
9. **Licensing.** Never read or copy a source the knowledge base forbids. Bring
   in outside code only as the slice describes, with its notice. When unsure
   about a source, stop.
10. **Don't decide what the maintainer decides.** If a choice is in neither the
    slice nor the decisions file, stop.

### 4. Coding rules

These come from this knowledge base's rules and apply to every slice.

- Touched code passes the strict lint configuration. No `var`. American
  English in every identifier, string and new document. Repo-owned colors are
  OKLCH, with the editor theme tokens as the primary source.
- Tests ship in the same slice as the behavior they cover. Code that reads
  through the engine gains a parity test against the reference path, and a
  divergence is a bug to fix, never a test to relax.
- Map engine payloads into the project's own types, never the engine's wire
  shapes. The reference path keeps working, and the engine is an optimization.
- Every user-visible string goes through localization in every bundle, and the
  localization check must report complete. If you can't translate, copy the
  English and say so in the report.
- Size is a guide, not a limit. A slice's budget ("~N") is a hint, never a pass
  or fail. Don't stop or split because you went over, and don't game it. Judge
  by cognitive complexity and every other quality rule, speed, reliability,
  coupling and cohesion. Report the line count honestly.

### 5. Slice checks and integration gates

- **Slice checks are focused.** Run the checks that fit the change, record each
  command and its numbers honestly, and commit small completed increments. A
  slice commit never claims that the integration gate has passed.
- **The integration gate belongs to the integrator**, and runs on the combined
  result:

  ```bash
  npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts/.mjs/.json file>
  pnpm run typecheck
  pnpm run test                       # both projects; record the counts
  pnpm run l10n:check                 # when l10n or user-visible text changed
  pnpm run kb:check                   # when anything under docs/kb changed
  # native arm, only when engine/** changed:
  pnpm run engine:fmt && pnpm run engine:lint && pnpm run engine:check && pnpm run engine:test
  ```

  Coverage and the SonarQube scan run at integration too (see Wave gates).
- Every slice report says `Sonar: integrator`.
- If a gate fails outside the slice's area on a clean integration branch, it
  is pre-existing: record it and don't fix it. If your change causes it, fix it.

### 6. Commits

- One branch per slice.
- **Commit every change as soon as it is made**, however small (maintainer
  instruction, `2026-10-19`). The claim, each small fix, each test added, the
  report and the final status each get their own signed commit. Don't save
  small edits up for one commit at the end.
- Message: `<type>(<area>): <what> (<ID>)`. The body says why, and what was
  checked.
- **Issues.** A slice commit that works toward a GitHub issue names it in the
  body as `Refs <owner>/<repo>#<n>`. A slice agent never writes a closing
  keyword (`Closes`, `Fixes`, `Resolves` and their forms), even in a slice's
  last commit. The integrator writes the closing line (see Closing issues
  below and Closing issues from commits).
- End the message with `Co-Authored-By: <agent name> <address>` when your
  environment provides one.
- Before handing back, verify the signatures:
  `git log --format='%h %G? %s' <integration-branch>..HEAD`. Every line starts
  with `G`.

### 7. Report

When the work is done, append this to the end of your slice file, replacing the
"not started" line if the slice has one. Set the status line to
`Status: done — awaiting integration`, or to `Status: blocked — <one-line reason>`.

```markdown
## Report

- **Agent / date:** <name and model>, <YYYY-MM-DD HH:MM>
- **Branch and commits:** `<release-prefix>/<ID>` — `<hash> G <subject>` (one line each)
- **Files changed:** <list, with +/− line counts from `git diff --stat`>
- **Tests added or changed:** <names; the count before and after>
- **Gates:** <each check run, with its result>; Sonar: integrator
- **Acceptance:** <each acceptance item: met / not met, with the evidence>
- **Deviations from the slice:** <none, or what and why>
- **Open questions / follow-ups:** <none, or the list>
```

Report facts only. Never claim a check you didn't run, and never claim that the
maintainer reviewed or approved anything.

### 8. When to stop

Stop and report with `Status: blocked — …` when any of these happens:

- a decision lies outside the slice and the decisions file;
- a file you need is outside the *Touch* list;
- a hard rule would have to bend (signing fails, a dependency is needed, a
  check would have to be weakened);
- the slice's facts no longer match the code: report the difference;
- any licensing doubt.

Leave the worktree as it is, committed or not, so the integrator can see it.

## Integrator procedure

### Who integrates

The integrator is the maintainer, or one agent the maintainer names. Only this
role edits the overview, merges slice branches, or runs SonarQube. The agent
protocol's hard rules still apply, except that the integrator works on the
integration branch.

### Choosing who works a slice

- When more than one agent type or model is available, the integrator asks the
  maintainer before the first dispatch of a release, unless the decisions file
  already records the choice for those dispatches. It never picks silently. A
  recorded choice covers only the dispatches it names. When in doubt, ask.
- Record each choice in the slice's report ("Agent / date") and in the
  integration log.
- Defaults a maintainer may choose: a general-purpose agent type, with a model
  by difficulty. Haiku for easy slices (docs, measurement, mechanical edits),
  Sonnet for most slices, Opus only for hard work that needs judgment rather
  than writing.
- **Cheapest first, then escalate.** Start a slice on the cheaper model. When it
  fails or stops blocked on difficulty, the next model up (Haiku → Sonnet →
  Opus) takes the cleanup in the same worktree, with the first agent's report.
- Ask for a rewrite only when the implementation is too complex or overthought,
  and give it to the next model up. Line counts are never the reason.

### Preparing a slice worktree (before dispatch)

Agents don't branch on their own, because the integration branch moves on while
they work. Prepare each starting point immediately before dispatch:

1. In the main checkout, on the integration branch, make sure it is clean and
   holds everything integrated so far. That is the newest base.
2. Create the slice branch there: `git branch <release-prefix>/<ID> <integration-branch>`.
3. Check it out in a worktree. **Recycle a finished one** when it is free: its
   branch must be fully integrated (`git merge-base --is-ancestor <old branch> <integration-branch>`)
   and its `git status` must be empty. Then
   `git worktree move ../ggl-<old> ../ggl-<ID>` and
   `git -C ../ggl-<ID> switch <release-prefix>/<ID>`. A recycled worktree keeps
   its dependencies and build output, so setup and builds are faster. Otherwise
   `git worktree add ../ggl-<ID> <release-prefix>/<ID>`.
4. Dispatch with the worktree path and the base commit
   (`git rev-parse --short <integration-branch>`), so the agent can confirm it.

Slices dispatched in parallel share one base. Integrate them in dependency
order; the later one is rebased onto the earlier one. Slices that change shared
manifest or translation files conflict textually, so the release names them and
they run one after another, never in parallel.

### Integrating a slice

For each slice marked `done — awaiting integration`, in dependency order:

1. **Read its report.** Every acceptance item must be met with evidence, every
   commit must show `G`, and `git diff --stat` must stay inside the *Touch*
   list. If anything fails, set the slice back to `ready` with the reason added
   under its report, and stop.
2. **Rebase it** onto the integration branch:
   `git -C ../ggl-<ID> rebase <integration-branch>`. Resolve conflicts only
   where both sides belong to slices. Never re-sign someone else's commit.
3. **Fast-forward** the integration branch to it, and rerun every gate from the
   agent protocol on the result.
4. **Record it.** Set the overview's row to `integrated <hash>`, and the slice's
   own status line too. Flip any slice whose `Needs:` are now all integrated to
   `ready`.

### Wave gates

After each wave of slices, and before the release is packaged, run:

```bash
pnpm run package && pnpm run test && pnpm run l10n:check && pnpm run test:coverage
pnpm run sonar:scan      # then poll the task and the quality gate until it reads OK
pnpm run kb:index && pnpm run kb:check && pnpm run kb:graph
```

A wave passes only when the SonarQube quality gate reads `OK`. A release may
add gates of its own in its integrator file, such as a rebuild of every
platform binary after a dependency refresh.

Append one line to the overview's integration log: the date, the slices, the
HEAD commit, the test counts, the coverage, the Sonar task id with the gate
verdict, and the agent and model choices made in that wave.

### Closing issues

When the slice that completes an issue is integrated and the gate passes on
the result, the integrator writes `Closes <owner>/<repo>#<n>` into the commit
that records that integration. The release's integrator file says which slice
completes each issue. A slice deferred by its decision leaves its issue open:
write no closing line for it, and record the gap. See Closing issues from
commits.

### Never

- push or publish without the maintainer, or tag a release before the
  maintainer says so;
- integrate a slice whose decision is still open, or whose report is not
  `done — awaiting integration`;
- fold a fix for another slice into the one being integrated: open a follow-up
  line in that slice's report instead;
- answer a decision on the maintainer's behalf;
- remove or prune a slice worktree that still holds work, or whose branch is
  not yet integrated.
