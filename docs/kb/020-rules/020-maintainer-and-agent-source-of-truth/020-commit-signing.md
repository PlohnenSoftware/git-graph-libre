---
summary: >-
  Standing rule: every commit signed (key `4858F11A2D1DFCBE`), checked with
  `git log --format='%h %G? %s'`; halt if `gpg-agent` is unreachable, never
  `--no-gpg-sign`; record of the `2026-09-09` unsigned-commit incident.
always_read: true
---

# Commit signing

**Every commit must be signed, and an unsigned commit must never be pushed.**
Both the repository config and the maintainer's global config set
`commit.gpgsign true`, `tag.gpgsign true`, and `user.signingkey`
`4858F11A2D1DFCBE`, so signing is the default and an unsigned commit means
something bypassed it. The maintainer's GitHub account also has vigilant mode
on ("Flag unsigned commits as unverified"), so an unsigned commit does not
merely go unbadged — it publishes with an **Unverified** badge beside the
maintainer's name.

Prove it before pushing rather than assuming it:

```bash
git log --format='%h %G? %s' @{upstream}..HEAD   # or origin/main..HEAD
```

Every line must start with `G`. `N` is no signature at all and is the failure
this rule exists for; `B`, `U`, `X`, `Y`, and `R` are bad, untrusted, expired,
or revoked and are equally not pushable. (`E` shows up for SSH-signed commits
from outside contributors when no `gpg.ssh.allowedSignersFile` is configured —
a local verification limit on someone else's commits, not a defect in one of
ours.)

**If signing cannot work, stop.** A sandboxed agent usually cannot reach the
`gpg-agent` socket under `~/.gnupg` or run a pinentry, so `git commit` fails.
The forbidden responses are `--no-gpg-sign`, `-c commit.gpgsign=false`,
`git config commit.gpgsign false`, and any other route that produces a commit
without a signature. Do not commit unsigned "for now", do not push, and do not
carry on to the next slice: halt there and hand the decision to the maintainer
with the diagnosis and the options, for example

- re-run the agent with its sandbox disabled, or grant the sandbox read/write
  access to `~/.gnupg` including the agent socket and pass `GPG_TTY` through,
  then commit normally;
- leave the work uncommitted so the maintainer commits and signs it; or
- explicitly authorize an unsigned commit for this one case, knowing it
  publishes as Unverified — a maintainer decision, never an agent's.

Repair exists only **before** the push, while the commits are still local:

```bash
git rebase --exec 'git commit --amend --no-edit -S' <last-good-commit>
```

Re-verify with the `%G?` command above afterwards. After the push there is no
cheap fix: re-signing rewrites every commit from the unsigned one forward, and
on `main` that means a force-push plus moving any release tag that contains it.
Do not propose it as a routine cleanup.

**The incident this rule was written from (`2026-09-09`).** `eb20a0a` (the CSS
split) and `e55012e` (the staging panel), both `Co-Authored-By: Muse Code` and
both committed on `AI-dev` on `2026-09-07`, carry no `gpgsig` header at all;
GitHub reports `verification.reason` `unsigned` for each. Their own commit
messages record that they were written in a sandbox with no external network,
and the shell history shows the agent being restarted as
`muse --disable-sandbox` at `03:00` — every Muse commit from `3d7f0cc`
(`03:05`) onward is signed again. So the sandbox is the cause, and the agent's
answer to a failing `gpg` was to commit without one. Both are ancestors of the
published `v1.5.0` tag with six signed commits on top, so they were **left as
they are**: the repair would force-push `main` and move a released tag, which
costs more than the two badges.
