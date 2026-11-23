---
summary: >-
  W26 · wave A · ready · review and integration of an outside pull request
  · TypeScript + webview + l10n, ~210 lines outside tests as submitted:
  issue #46. Review `rbalet`'s draft PR #47 (one commit, `a109e9a`), which
  shows on each tag badge the remotes that hold the identical tag, read with
  `git ls-remote` in the background. Then the integrator merges it unchanged
  into the integration branch with a merge commit (Y24), so GitHub marks it
  merged and `a109e9a`'s `Closes` line closes #46 when `main` is
  fast-forwarded. The on-by-default setting (Y23) is W26F.
---

# W26 — Tags show the remotes that hold them (PR #47)

Status: integrated `a93ddc7` (`2026-11-05`), the merge of `a109e9a`
Needs: —
Decisions: Y23 answered (b): a setting, on by default, built as W26F;
Y24 answered: a plain merge commit into the integration branch
Kind: review and integration of an outside contribution · TypeScript,
webview and l10n · Size: ~210 changed lines outside tests, docs and
screenshots, as submitted (`a109e9a`: 18 files, +469/−5)
Source: [issue #46](https://github.com/PlohnenSoftware/git-graph-libre/issues/46);
[PR #47](https://github.com/PlohnenSoftware/git-graph-libre/pull/47), commit
`a109e9a`; Issue #46: show which remotes hold a tag, under Open GitHub issues

## Goal

A tag badge says whether the tag exists on a remote. That answers #46's
"we don't see if a tag is local or in origin". The work is already written:
`rbalet`'s draft PR #47 implements it. This slice reviews it, has the
maintainer's choices applied, and lands it with its authorship and its
`Closes` line intact, so #46 closes when the commit reaches `main`.

## Facts (checked `2026-11-05`, `a109e9a` against `main` at `daa558f`)

- **The pull request.** PR #47, "feat(tags): show matching remotes on tag
  badges", is a draft opened `2026-11-05` by `rbalet` from the fork branch
  `rbalet:codex/tag-remote-status` into `main`. It has one commit,
  `a109e9a`, authored by Raphaël Balet with `Co-Authored-By: Codex`.
  - GitHub reports the commit's signature `valid`. Locally, `%G?` shows `E`,
    the outside-contributor SSH case that Commit signing explains.
  - GitHub reports the PR mergeable and lists #46 as the issue it closes.
    No CI checks are reported on it.
  - The commit message carries `Closes PlohnenSoftware/git-graph-libre#46`.
    It is the model for Closing issues from commits.
  - It is fetched locally as the branch `codex/tag-remote-status`, based on
    `c47207e` (`origin/main`), with no merge commit.
  - The contributor's review request is the only comment. No review yet.
- **The backend read.** `src/backend/queries/remoteTags.ts` (new, 94 lines)
  reads the local tags (`for-each-ref` object ID, ref name and peeled ID) and
  `git remote`. For each remote, in parallel, it runs
  `git -c credential.interactive=false ls-remote --tags --refs -- <remote>`,
  with:
  - a 10 s timeout and a 16 MB output buffer;
  - `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS` and `SSH_ASKPASS`, and
    `GCM_INTERACTIVE=Never`.

  A tag matches a remote only when the object ID and the ref name are both
  identical. Two annotated tags on one commit therefore stay apart. A
  remote whose read fails is returned as unavailable. No remote is
  contacted when the repository has no tags.
- **Its own processes, not the shared runner.** The read spawns through
  `execFile`, not `runGitRaw`, and still records each command with
  `runGitCommand`. The stated reason is to keep network reads out of the
  graph's Git queue. The handler in `messageHandler.ts` answers `remoteTags`
  without awaiting, so the file watcher is not muted for the network round
  trip.
- **The webview** (`src/webview/main.ts`, +71/−5):
  - It asks for the remotes after rendering a page with tags, on Refresh,
    and after actions.
  - It keeps the answer across soft refreshes, filters and pagination, and
    rejects late or stale replies.
  - Matching remotes become `gitRefGroup`/`gitRefAlias` segments, as on
    branch badges, and the tooltip separates "on no remote" from
    "unavailable".
  - Three new strings appear in all five l10n bundles.
  - There is no new setting, no engine change and no telemetry.
- **Behavior for Y23.** Nothing in `src/` contacts a remote today without a
  user action. Fetch, Pull and Push are explicit, and avatars are opt-in
  (`fetchAvatars`). With PR #47, every graph open of a repository with tags,
  every Refresh and every action's refresh contacts every configured remote,
  with no setting to stop it. An SSH key that needs a hardware touch or a
  passphrase without an agent may block each read until the timeout. That is
  an unverified risk, worth a hand test.
- **Rebasing onto `main`** (`git merge-tree --write-tree main
  codex/tag-remote-status`, no commit made):
  - One textual conflict: the generated `docs/kb/README.md` index.
  - The PR's record, `docs/kb/070-history/160-tag-remote-status.md`, reuses
    prefix `160`, which `main` gave `160-closed-github-issues-and-their-threads.md`
    in `4337db4`. `kb:check` fails until the record takes the next free
    History prefix and the index is regenerated. That is `180` once W00 has
    moved release 1.9.0 to `170`.
  - `CHANGELOG.md` and `README.md` merge cleanly.
- **Gaps the PR states itself.**
  - No SonarQube run, since the contributor had no scanner, and no `kb:graph`.
  - Not tested in live VS Code, and not against authenticated remotes.
  - It reports five test failures as already present on unchanged `main`
    at `c47207e` (macOS arm64): one in
    `tests/backend/utils/repositoryProbe.test.ts` and four in
    `tests/webview/commandManager.test.ts`. That claim is not checked here
    yet.
- **The screenshots** `docs/screenshots/issue-46-{before,after}.png` (85 and
  90 KB) are committed. `.vscodeignore` whitelists files and does not list
  `docs/`, so they stay out of the VSIX.
- **Precedent.** Outside pull requests #22–#25 (`cktgh`) landed with
  **Rebase and merge**. Their commits sit on `main` under the contributor's
  name, with no merge commits.

## Steps

1. **Review** (an agent may do this, locally only):
   - Check out `codex/tag-remote-status` in its own worktree, at the PR's
     head as submitted.
   - Read the feature, not only the gate (Pull request review — #8 and #9).
   - Run the full gate there, including the SonarQube scan the PR could not
     run.
   - Check the five claimed baseline failures against `main`.
   - Write every finding into this slice's report, each with a suggested
     review comment.
   - Never comment on the PR or the issue, and never push. The maintainer
     posts.
2. **Y23 is ours, not the contributor's.** The setting (on by default) is
   the follow-up slice W26F, built on the integration branch after the
   merge. Review findings that need code changes join W26F, or a further
   follow-up, rather than going back to the contributor.
3. **Land it per Y24 (integrator):**
   - Fetch the PR's current head
     (`gh pr view 47 --json headRefOid`; `a109e9a` when reviewed) and merge
     it unchanged into `the-worktrees` with `git merge --no-ff`, a signed
     merge commit. Never rebase, amend or re-sign `a109e9a`: GitHub can
     only see the PR as merged if its own commit, with its own hash, reaches
     `main`.
   - Resolve in the merge commit itself: renumber the PR's record
     `070-history/160-tag-remote-status.md` to the next free History prefix
     (`180` after W00), regenerate the index with `pnpm run kb:index`, and
     fold the PR's `CHANGELOG.md` entry in beside the others.
   - When the maintainer fast-forwards `main` at W90, GitHub marks PR #47
     merged and `a109e9a`'s `Closes` line closes #46. Unverified: whether
     GitHub does that for a PR still in **draft**; if it stays open, mark
     it ready for review before the fast-forward, or close it by hand with
     a note.
   - If the contributor pushes more commits before the release, merge the
     new head the same way.
4. **Credit.** `@rbalet` (#46) goes into W90's `[1.10.0]` changelog. The
   PR's own `[Unreleased]` entry folds into it.

## Touch

Review: this slice file's `Status:` line and report only. Code changes are
the contributor's, made in PR #47. The integrator updates the overview row
and the Integration log.

## Acceptance

- Y23 and Y24 are answered.
- The review is recorded in the report: the findings, the full gate on the
  PR's head with SonarQube `OK`, and the baseline failures confirmed or
  refuted.
- PR #47's head is merged unchanged into `the-worktrees` by a merge
  commit, `a109e9a` keeping its hash, its signature and its
  `Closes PlohnenSoftware/git-graph-libre#46` line.
- `kb:check` and the full gate pass on the integration branch after the
  merge.
- After W90's fast-forward of `main`: PR #47 shows merged and #46 closed.

## Report

- **Agent / date:** review by Claude Sonnet 5.5, `2026-11-05`, read-only in
  a worktree detached at `a109e9a`. Merge by the integrator, Claude Opus
  5.5. The full review text was kept at `/tmp/claude-1000/w26-review.md`
  (scratch).
- **Verdict:** merge as is, then fix in follow-ups. No blocker. The feature
  works and follows the webview conventions: it reuses
  `gitRefGroup`/`gitRefAlias`, escapes every name, and tag actions work on
  the aliases. The tests use real bare repositories in temporary
  directories.
- **Gate at `a109e9a`** (Linux x64):
  - strict Biome is clean on the 7 touched TypeScript files;
  - `package` passes;
  - `test`: backend 1151 passed and 60 skipped of 1211; webview 793 of
    793;
  - `l10n:check` is at 100%, and `kb:check` passes.
- **The PR's five "baseline" failures do not reproduce on Linux.** At
  `c47207e`, `repositoryProbe.test.ts` passes 23 of 23 and
  `commandManager.test.ts` 43 of 43. They pass at the PR head too, so the
  failures are probably specific to macOS (the PR's platform). Ask the
  contributor for the names and messages.
- **Merge** (`a93ddc7`, a plain merge commit per Y24, `a109e9a` unchanged):
  - `CHANGELOG.md` conflicted: the PR's `### Added` now sits above the
    branch's `### Fixed`.
  - The generated index conflicted and was regenerated.
  - The PR's record moved to History prefix `180`.
  - On the merged tree, `package` passes, `test` passes (backend 1241 of
    1241, webview 804 of 804), and `l10n:check` and `kb:check` pass.
- **Findings, all should-fix or nit:**
  - **F1** (W26F): no off switch for the network reads. Gate them on the
    extension side too.
  - **F2** (W26H): SSH is not reliably non-interactive.
    - An empty `SSH_ASKPASS` lets OpenSSH fall back to its compiled-in
      askpass.
    - Without `BatchMode`, host-key and passphrase prompts read `/dev/tty`.
    - A hardware-key touch just burns the timeout.
    - Use `SSH_ASKPASS_REQUIRE=never` and close stdin. Don't override the
      user's `core.sshCommand` or `GIT_SSH`.
  - **F3** (W26H): the child process.
    - The timeout kills only `git`. On Windows the ssh or remote-helper
      child survives.
    - Remotes are queried all at once; cap at about 4.
    - Add `windowsHide`.
    - Make the read abortable when the panel closes or the repository
      switches.
  - **F4** (W26F): the snapshot survives soft refreshes. A tag created or
    moved in a terminal then shows "unavailable". Re-request when a visible
    tag is missing from the snapshot or its hash differs.
  - **F5** (W26F): two webview problems.
    - Hard refreshes forget the snapshot, so the aliases blink. Keep the
      old snapshot while revalidating.
    - The reply re-renders the whole table and graph. Patch the tag cells
      only, as `loadCommitSignatures` does.
  - **F6** (W26H): the `.then` on `bridge.post()` has no `.catch`, and the
    request trace logs about 0 ms.
  - **F7** (W26H, nit): explain in a file comment why the read bypasses
    `runGitRaw`, and list `remoteTags` beside `runGitWithInput` in the
    architecture note.
  - **F8** (W26H, nit):
    - check that the extension is disabled in untrusted workspaces
      (`package.json` `untrustedWorkspaces`), or return an empty result
      when `!vscode.workspace.isTrusted`;
    - document the 16 MB `maxBuffer` limit.
  - **F9** (W26H, nit): set `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM`
    in the remote-tags tests, and cover the timeout and CRLF.
  - **F10** (W26F, nit): `l10n.tagOnRemotes.replace("{0}", …)` interprets
    `$&` in a remote's name. Use a replacer function. The "not found on any
    remote" text shows even with no remotes at all.
- **Draft review comment for the maintainer to post on PR #47:** thanks.
  The gate is green on Linux, including the two files listed as failing,
  which pass on `main` and on the branch, so the failures are probably
  macOS-specific: could you share the names and messages? The commit is
  merged unchanged with a merge commit, so the authorship and the
  `Closes #46` line are kept. Bookkeeping is on our side: the History
  number, and the changelog in the release notes with credit. The
  follow-ups are ours too: a setting to switch the checks off (on by
  default), non-interactive SSH, the timeout cleanup on Windows, and no
  blinking while a refresh re-checks.
