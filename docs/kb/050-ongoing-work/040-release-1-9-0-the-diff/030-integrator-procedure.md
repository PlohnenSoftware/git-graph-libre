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

**For each slice marked `done — awaiting integration`, in dependency
order:**

1. **Read its report.** Check that every acceptance item is met with
   evidence, every commit shows `G`, and `git diff --stat` stays inside the
   slice's *Touch* list and size budget. If anything fails, set the slice
   back to `ready` with the reason added under its report, and stop.
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
