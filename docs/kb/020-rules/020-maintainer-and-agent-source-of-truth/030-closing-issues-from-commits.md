---
summary: >-
  Standing rule (`2026-11-05`): work on a GitHub issue ends in a commit, made
  after the gate passes, whose body says `Closes
  PlohnenSoftware/git-graph-libre#<n>`, as `a109e9a` (PR #47, issue #46)
  does, so the issue closes when that commit reaches `main`. Earlier commits
  only reference it (`Refs`); in a multi-agent release the integrator writes
  the closing line.
always_read: true
---

# Closing issues from commits

**Standing rule (maintainer, `2026-11-05`).** Work on a GitHub issue ends
in a commit whose message closes that issue. That commit is the final one
of the issue's work, made after the gate has passed on it. GitHub closes the
issue when the commit reaches `main`, the default branch, so the issue is
closed on merge and nobody has to remember to close it by hand.

The model is `a109e9a`, the single commit of PR #47, which implements issue
#46:

```text
feat(tags): show matching remotes on tag badges

Closes PlohnenSoftware/git-graph-libre#46

Draft submission authorized with verification gaps documented.

Co-Authored-By: Codex <codex@openai.com>
```

How to write it:

- **The line.** `Closes PlohnenSoftware/git-graph-libre#<n>`, on its own
  line, as the first paragraph of the body, right after the subject. Use the
  full `owner/repository#<n>` form. It points at this repository wherever
  the commit is made. In a contributor's fork, a bare `#<n>` points at the
  fork's own issues.
- **One line per issue.** GitHub needs the keyword before each number, so a
  commit that finishes two issues has two `Closes` lines.
- **The final commit only.** A commit that carries the keyword closes the
  issue as soon as it reaches `main`, finished or not. So every earlier
  commit of the same issue, and every slice that only advances it, mentions
  the issue without a keyword: `Refs PlohnenSoftware/git-graph-libre#<n>`.
  That still links the commit in the issue's timeline.
- **After the gate.** The closing commit comes after the gate that applies
  to the work has passed, as Branch and release policy defines it. Without
  multi-agent delegation, that is the full gate up to SonarQube `OK`, and the
  closing line goes in the final commit of the issue's work. If the gate
  fails, or the work is handed back unfinished, no commit carries the line.
- **Multi-agent releases.** Slice agents never write `Closes`. Their commits
  use `Refs`. When the issue's last slice is integrated and the
  integration gate passes, the integrator writes the closing line into the
  commit that records that integration. The release's integrator procedure
  says which slice completes each issue.
- **Pull requests.** A pull request that resolves an issue also says
  `Closes #<n>` in its description. GitHub then links the issue to the
  pull request before it merges, as PR #47 does. Outside contributors follow
  the same rule for their commits. Land such a pull request in one of two
  ways, each keeping the closing line:
  - **straight to `main`:** **Rebase and merge** on GitHub (Branch and
    release policy), which keeps the commit message as written;
  - **into a local release** (maintainer, `2026-11-05`, for PR #47): merge
    the pull request's head unchanged into the integration branch with a
    plain merge commit (`git merge --no-ff`). The contributor's commits keep
    their hashes and signatures. When `main` is fast-forwarded at the
    release, GitHub sees them on `main`, marks the pull request merged, and
    their `Closes` lines close the issue. Never rebase, amend or re-sign
    them on this route: new hashes are commits GitHub cannot match to the
    pull request.

When it takes effect: GitHub acts on the keyword only when the commit lands
on `main`, either by a merged pull request or by `main` being fast-forwarded
at a release. Pushing a slice branch or an integration branch closes
nothing. So an issue fixed by a release closes when that release reaches
`main`.

The keyword only closes the issue. Answering the reporter, crediting them in
`CHANGELOG.md`, and moving the issue's subsection from Open GitHub issues to
History are still done as before. Agents still never comment on an issue
(the release agent protocols' hard rules). If an issue was closed early, or
not closed at all, the maintainer reopens or closes it by hand and records
why in its subsection.
