---
summary: >-
  W26 · wave A · gated on Y23, Y24 · review and integration of an outside pull
  request · TypeScript + webview + l10n, ~210 lines outside tests as
  submitted: issue #46. Review and land `rbalet`'s draft PR #47 (one commit,
  `a109e9a`), which shows on each tag badge the remotes that hold the
  identical tag, read with `git ls-remote` in the background. Y23 decides
  when remotes are contacted, Y24 how the PR lands; its `Closes` line closes
  #46 on merge.
---

# W26 — Tags show the remotes that hold them (PR #47)

Status: gated on Y23, Y24
Needs: —
Decisions: Y23 (when remotes are contacted), Y24 (how the pull request lands)
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
    in `4337db4`. `kb:check` fails until the record is renumbered to `170`
    and the index regenerated.
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
2. **Apply Y23.** If the answer differs from the PR as submitted, it goes
   back to the contributor as a requested change. If it is small, the
   maintainer may instead take a follow-up slice, `W26F`, after the merge.
3. **Land it per Y24.**
   - The contributor rebases onto `main`, renumbers the record to `170`,
     regenerates the index with `pnpm run kb:index`, and keeps the
     `Closes PlohnenSoftware/git-graph-libre#46` line.
   - The maintainer merges with **Rebase and merge**. #46 then closes on
     merge.
   - The 1.10.0 integration branch is rebased onto `main` afterwards.
   - Never re-sign or rewrite the contributor's commit locally (the
     integrator procedure).
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
- PR #47 is merged by the maintainer, its commit message still carrying
  `Closes PlohnenSoftware/git-graph-libre#46`, and #46 is closed by that
  merge.
- `kb:check` passes on `main` after the merge.

## Report

Not started.
