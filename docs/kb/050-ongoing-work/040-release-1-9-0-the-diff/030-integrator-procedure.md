---
summary: >-
  How the maintainer, or one designated integrator agent, turns finished 1.9.0
  slices into the release branch: check each slice's report and file list,
  rebase in dependency order, rerun the gates, run coverage and SonarQube per
  wave, keep the overview's table and integration log current, and flip
  dependent slices to ready.
---

# Integrator procedure for release 1.9.0

The integrator is the maintainer, or one agent the maintainer names. It's
the only role that edits the release overview, merges slice branches, or
runs SonarQube. The agent protocol's hard rules still apply, except that the
integrator works on the integration branch from decision X6.

**Choosing who works a slice (maintainer, `2026-10-19`).** When the
integrator dispatches slices to sub-agents and more than one agent type or
model is available (for example Opus, Sonnet or Haiku, or several agent
definitions), it asks the maintainer which to use before dispatching. It
never picks silently, and a choice once given covers only the dispatches
the maintainer said it covers. Record the choice in the slice's report
("Agent / date") and in the integration log.

The maintainer's choice for the rest of release 1.9.0 (`2026-10-19`):
- **Agent type:** `general-purpose`.
- **Model by difficulty:** Haiku for easy slices (docs, measurement,
  mechanical edits); Sonnet for most slices; Opus only for hard work that
  needs high-level thinking rather than just writing.
- **Cheapest first:** start a slice on the cheaper model. If it fails or
  stops blocked on difficulty, give the cleanup to the next model up
  (Haiku → Sonnet → Opus) in the same worktree, with the first agent's
  report.

The five slices dispatched before this rule (D41F, D04a, D13, D21, D44)
run on Opus, the inherited default.

**Preparing a slice before dispatch (orchestrator's job, maintainer,
`2026-10-19`).** Agents used to branch on their own, often from an
integration branch that had moved on by the time they finished, which made
every rebase harder. So the orchestrator prepares each starting point
immediately before dispatching:

1. In the main checkout, on `the-diff`: make sure it is clean and has
   everything integrated so far. That is the newest base.
2. Create the branch there: `git branch diff-1.9.0/<id> the-diff`.
3. Check it out in a worktree, **recycling a finished one** when it is
   free: its branch must be fully integrated
   (`git merge-base --is-ancestor <old branch> the-diff`) and its
   `git status` empty. Then
   `git worktree move ../ggl-<old> ../ggl-<id>` and
   `git -C ../ggl-<id> switch diff-1.9.0/<id>`. A recycled worktree keeps
   its `node_modules` and the engine's `target/`, so setup and Rust
   builds are faster. Otherwise:
   `git worktree add ../ggl-<id> diff-1.9.0/<id>`.
4. Dispatch with the worktree path and the base commit
   (`git rev-parse --short the-diff`), so the agent can confirm it.

Slices dispatched in parallel all start from the same base. Integrate
them in dependency order; whichever comes second is rebased onto the
first, as before.

**For each slice marked `done — awaiting integration`, in dependency
order:**

1. **Read its report.** Check that every acceptance item is met with
   evidence, every commit shows `G`, and `git diff --stat` stays inside the
   slice's *Touch* list. If anything fails, set the slice back to `ready`
   with the reason added under its report, and stop.
   **Line counts are never a blocker (maintainer, `2026-10-19`).** State a
   slice's budget as a guide ("~N") when writing it, and accept a longer
   implementation when it meets the quality rules. Judge, all equally, by cognitive
   complexity and the other rules, speed, reliability, coupling and cohesion.
   Ask for a rewrite only when the implementation is too complex or
   overthought, and give the rewrite to the next smarter model when one is
   available (Haiku → Sonnet → Opus).
2. **Rebase it** onto the integration branch:
   ```bash
   git -C ../ggl-<id> rebase origin/<integration-branch>
   ```
   Resolve conflicts only where both sides belong to slices. Never re-sign
   someone else's commit.
3. **Fast-forward** the integration branch to it, and rerun every gate from
   the protocol on the result.
4. **Record it.** Set the overview row to `integrated <hash>`, and the
   slice's own status line too. Flip any slice whose `Needs:` are now all
   integrated to `ready`.

**After each wave** (A–D, E–G, H, I–L), or at least before D90:

```bash
pnpm run package && pnpm run test && pnpm run l10n:check && pnpm run test:coverage
pnpm run sonar:scan      # then poll the task and the quality gate, per Current Architecture
pnpm run kb:index && pnpm run kb:check && pnpm run kb:graph
```

Append one line to the overview's integration log: the date, the slices,
the HEAD commit, the test counts, coverage, and the Sonar task id with the
gate verdict.

**Never:**
- push or publish without the maintainer, or tag before D90;
- integrate a slice whose decision is still open;
- fold a fix for another slice into the one being integrated. Open a
  follow-up line in that slice's report instead.
