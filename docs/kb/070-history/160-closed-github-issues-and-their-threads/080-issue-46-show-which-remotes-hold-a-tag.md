---
summary: >-
  To tackle (maintainer, `2026-11-05`), in release 1.10.0 as W26; `rbalet`,
  `2026-11-05`: show whether a tag has been pushed to origin. Already
  implemented by the reporter's draft PR #47 (`a109e9a`, `Closes …#46`): each
  tag badge names the remotes holding the identical tag object, read with
  background `git ls-remote`. Open: when remotes are contacted (Y23) and how
  the PR lands (Y24).
---

# Issue #46: show which remotes hold a tag

**Open.** [Issue #46](https://github.com/PlohnenSoftware/git-graph-libre/issues/46),
"feat(tag): origine", opened `2026-11-05` by `rbalet`, label `enhancement`.
It is a follow-up to Phase 15 (tag surfaces, under History), which added
signed-tag badges and remote tag deletion but nothing that says where a tag
already is. **Decision (maintainer, `2026-11-05`): to tackle, in release
1.10.0,** as W26 in Release 1.10.0 — "The Worktrees". The open choices are
that release's decisions Y23 and Y24.

## The request

"Show if a tag has been pushed to origine." The problem: "Actually, we don't
see if a tag is local or in origine." The proposed solution is a screenshot
of a tag badge with a second segment beside the tag name, like the remote
segment on a branch badge.

## The thread

No comments. The reporter opened
[PR #47](https://github.com/PlohnenSoftware/git-graph-libre/pull/47) the
same day, a draft with one commit, `a109e9a`. Its message carries
`Closes PlohnenSoftware/git-graph-libre#46`, and GitHub lists #46 as the
issue it closes. The PR's only comment is the reporter asking the maintainer
for feedback on the behavior and the approach. There is no maintainer reply
yet.

## Checked facts (`2026-11-05`)

The PR's behavior, the conflicts it has with `main`, and the gaps it
reports are recorded in W26's Facts:
- it runs background `git ls-remote --tags --refs` against every remote;
- it matches tags by object ID;
- it shows matching remotes as `gitRefAlias` segments;
- it has no setting and no engine change.

Facts specific to the request:

- Git keeps no per-remote record of tags. `git fetch` puts remote tags into
  the local `refs/tags` namespace, with no remote-tracking copy, so whether
  a remote holds a tag can only be known by asking that remote, which is
  what `ls-remote` does.
- Nothing in `src/` contacts a remote today without a user action.

## Proposals and assessment

| Proposal | By | Assessment |
| --- | --- | --- |
| A remote segment on the tag badge | `rbalet` (issue) | Agreed. It reuses the branch badge's segment styling, so it reads like what the graph already shows for branches. |
| Background `ls-remote` per remote, on render, Refresh and after actions (PR #47) | `rbalet` with Codex | Sound read: exact object match, no prompts, bounded and parallel, and unavailable remotes reported as unknown. The open question is when to contact remotes (Y23). Today the extension reaches the network only when asked, and an SSH key that needs a touch or a passphrase could block each read until the timeout (unverified). |

## Open questions for the maintainer

- Y23: contact remotes automatically as submitted, behind a setting (on or
  off by default), or only on demand?
- Y24: the reporter rebases PR #47 onto `main`, renumbers its record, and it
  is merged with Rebase and merge, so `a109e9a`'s `Closes` line closes #46?
