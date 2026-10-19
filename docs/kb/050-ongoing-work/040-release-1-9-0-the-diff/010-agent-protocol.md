---
summary: >-
  How any agent, however capable, works one slice of release 1.9.0: what to
  read, how to claim a slice, a worktree per slice, the hard safety rules
  (no push, signed commits only, stay inside the slice's file list, never
  weaken a test or a rule), the gate commands in order, the commit format,
  the report template, and when to stop and hand back.
---

# Agent protocol for release 1.9.0

Read this whole file before touching a slice, every session. If anything
here conflicts with a slice file, this file wins; if it conflicts with the
rest of the knowledge base, the knowledge base wins and you stop and report
the conflict.

## 1. Before you start

1. Read `AGENTS.md`, then `docs/kb/README.md` in full, then every section it
   marks *always read*.
2. Read [the release overview](../040-release-1-9-0-the-diff.md) and
   [the maintainer decisions](020-maintainer-decisions.md).
3. Pick a slice whose file says `Status: ready`. Every slice in its
   `Needs:` line must be `integrated`, and every decision it names must be
   answered in the decisions file. If none qualifies, report that and stop.
4. Read the whole slice file, and every file listed under its *Read first*.
5. **Claim it.** In the slice file only, change the status line to
   `Status: claimed by <your agent name> on <YYYY-MM-DD HH:MM>`. Never claim
   more than one slice at a time. Never touch a slice that someone else has
   claimed.

## 2. Workspace

- One git worktree and one branch per slice, created from the integration
  branch the maintainer named in the decisions file (X6):

  ```bash
  git fetch origin
  git worktree add ../ggl-<slice-id> -b diff-1.9.0/<slice-id> origin/<integration-branch>
  cd ../ggl-<slice-id>
  pnpm install --frozen-lockfile
  ```

- Work only inside that worktree. Never edit the maintainer's main checkout.
- Slices marked Rust also need `pnpm run engine:build` before TypeScript
  tests can load the engine.

## 3. Hard rules

Breaking one of these is a failed slice, whatever else it achieved.

1. **Never push, open a pull request, or comment on an issue.** The
   maintainer integrates and publishes.
2. **Never commit without a signature.** Every commit must show `G` in
   `git log --format='%h %G? %s' -1`. If signing fails, stop: leave the work
   uncommitted and report. Never pass `--no-gpg-sign`, `-c
   commit.gpgsign=false`, or `--no-verify`.
3. **Stay inside the slice's *Touch* list.** Its test files, and the
   `## Report` section and `Status:` line of your own slice file, are always
   allowed. Anything else means you stop and report.
4. **Never weaken a check to pass it:**
   - don't skip, disable or loosen a test or an assertion;
   - don't add a `biome-ignore` or a lint exclusion;
   - don't raise a threshold;
   - don't edit `biome*.jsonc`, `sonar-project.properties`, `vitest.config.ts`,
     `tsconfig*.json` or CI workflows unless the slice says so.
5. **No new dependency, npm or cargo, unless the slice names it** with an
   exact version. Never run `pnpm add`, which upgrades everything else; edit
   `package.json` by hand and run `pnpm install`.
6. **No destructive git commands** (`reset --hard`, `clean -fdx`,
   `push --force`, `branch -D`, rebasing anything but your own slice branch)
   outside your own worktree. Never delete a file the slice didn't create
   unless the slice says to.
7. **Tests touch only temporary directories.** Build repositories with
   `tests/backend/helpers.ts` (`makeRepo`). Never read or write the real
   `~/.gitconfig`, the user's repositories, or anything outside the temp dir.
   Pass `GIT_CONFIG_GLOBAL` to a temp file when a test depends on global
   config.
8. **No secrets** in code, logs, tests, reports or commit messages.
   Telemetry changes only at the documented chokepoints, and only when the
   slice asks for them.
9. **Licensing.**
   - Never read or copy from `vscode-git-graph-rs`'s `src/` or `web/`.
   - Bring in outside code only as the slice describes, with its notice.
   - When unsure about a source, stop.
10. **Don't decide what the maintainer decides.** If a choice isn't in the
    slice or the decisions file, stop.

## 4. Coding rules

These come from the knowledge base's Rules, and apply everywhere:

- **Lint and style:** touched code passes `biome.strict.jsonc`. No `var`.
  American English. OKLCH colors with VS Code theme tokens first.
- **Tests:** they ship in the same slice as the behavior. A read wired to the
  engine gains a parity test against the CLI, and a divergence is a bug, not
  a test to relax.
- **Types and backends:** map engine payloads into this project's types,
  never the engine's wire shapes. The CLI path keeps working, and the engine
  is an optimization.
- **Text:** every user-visible string goes through l10n, in all five bundles
  (`l10n/bundle.l10n.json`, `.nl`, `.pl`, `.zh-cn`, `.zh-tw`).
  `pnpm run l10n:check` must report 100%. If you can't translate, copy the
  English and say so in the report.
- **Size:** keep each slice within its size budget. If it needs more, stop
  and propose a split in the report.

## 5. Slice checks and integration gates

**Maintainer instruction, `2026-10-19`:** multi-agent slices and sub-slices
do not require the full gate before signed commits. Use focused checks
appropriate to the change and commit small completed increments frequently.
Record each command and its numbers honestly. Full gates apply at integration
and to work without multi-agent delegation, as the standing KB rules say.

The full gate checklist below belongs to the integrator; slice agents may
run more of it when useful, but it is not a per-commit requirement:

```bash
npx biome check --config-path biome.strict.jsonc --error-on-warnings <every touched .ts/.mjs/.json file>
pnpm run typecheck
pnpm run test                       # both projects; record the counts
pnpm run l10n:check                 # when l10n or user-visible text changed
pnpm run kb:check                   # when anything under docs/kb changed
# Rust arm, only when engine/** changed:
pnpm run engine:fmt && pnpm run engine:lint && pnpm run engine:check && pnpm run engine:test
```

The integrator runs fresh coverage and SonarQube on the combined integration
result; write `Sonar: integrator` in your slice report. A slice commit does
not claim that this integration gate has passed.

If a gate fails outside your slice's area on a clean checkout of the
integration branch, it's pre-existing. Record it and don't fix it. If it
fails because of your change, fix it.

## 6. Commits

- One branch per slice, and one or a few small signed commits.
- Message: `<type>(<area>): <what> (D<nn>)`, for example
  `fix(details): list stash files like git stash show (D02)`. The body says
  why, and what you checked.
- End the message with `Co-Authored-By: <your agent name> <address>` when
  your environment provides one.
- Before handing back, verify the signatures:
  `git log --format='%h %G? %s' origin/<integration-branch>..HEAD`. Every
  line must start with `G`.

## 7. Report

Append this to the end of your slice file, replacing the "not started"
line, and set the status line to `Status: done — awaiting integration`, or
to `Status: blocked — <one-line reason>`:

```markdown
## Report

- **Agent / date:** <name>, <YYYY-MM-DD HH:MM>
- **Branch and commits:** `diff-1.9.0/<id>` — `<hash> G <subject>` (one line each)
- **Files changed:** <list, with +/− line counts from `git diff --stat`>
- **Tests added or changed:** <names; the count before and after>
- **Gates:** biome <result>; typecheck <result>; test backend <passed>/<total>, webview <passed>/<total>; l10n <result>; kb:check <result>; Rust arm <result or n/a>; Sonar: integrator
- **Acceptance:** <each acceptance item from the slice: met / not met, with the evidence>
- **Deviations from the slice:** <none, or what and why>
- **Open questions / follow-ups:** <none, or the list>
```

Report facts only. Never claim a check you didn't run, and never claim the
maintainer reviewed or approved anything.

## 8. When to stop

Stop and report with `Status: blocked — …` when any of these happens:

- a decision outside the slice and the decisions file;
- a file you need is outside the *Touch* list;
- a hard rule would have to bend (signing fails, a dependency is needed, a
  check would have to be weakened);
- the slice's facts no longer match the code (it moved or changed): report
  the difference;
- the size budget would be exceeded;
- any licensing doubt.

Leave the worktree as it is, committed or not, so the integrator can see it.
