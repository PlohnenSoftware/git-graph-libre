---
summary: >-
  Record of the closed GitHub issues: the eight closed by `2026-11-04` (#2, #3,
  #7, #26, #30, #31, #32, #39), and the five closed on `2026-11-06` when the
  maintainer pushed `main` (#36, #38, #41, #45, #46). For each: what it asked,
  the proposals in its thread, how it was resolved, with its dates and closing
  commit, and where the work is recorded. Two loose ends remain: #31's
  untested Flatpak and Snap installs, and #4's suggested Rebase on remote
  branches.
---

# Closed GitHub issues and their threads (`2026-11-04`)

Read in full on `2026-11-04` with `gh issue view` (comments included) when
the open issues were documented under Future work in Open GitHub issues. Each
entry says what was asked, every proposal in the thread, the resolution, and
the section that records the work, by title. Numbers missing from this list
are pull requests.

**#2 — "Feature Request: Allow to merge remote branch"** (`yyjdelete`,
`2026-09-04`, closed `2026-09-05`). Merge appeared only in the context menu of
local branches; the request was to offer it on remote branches
(`origin/xxx`) too.

- Thread: the maintainer (`2026-09-04`) gave a workaround: merge the remote
  branch's newest commit instead. The effect is the same; only the generated
  merge message differs, and it can be amended.
- Resolution: PR #4 (the Copilot coding agent) added Merge to the
  remote-branch menu, merged `2026-09-05`, shipped in `v1.4.2`.
- Record: Pull request review — #4 and #5. That review left one suggestion
  open: the remote-branch menu still has no Rebase, though
  `git rebase origin/main` works.

**#3 — "Feature Request: Option for default value of fast-forward"**
(`yyjdelete`, `2026-09-04`, closed the same day). The request was a
configurable default for the merge and pull dialogs' no-fast-forward
checkbox (`dialog.merge.noFastForward`, `dialog.pullBranch.noFastForward`).

- Thread: none.
- Resolution: PR #5 (Copilot). The review found the settings declared but
  inert and wired them up; merged `2026-09-04`, shipped in `v1.4.2`.
- Record: Pull request review — #4 and #5.

**#7 — "Does not detect repositories in subfolders"** (`Arezim`,
`2026-09-20`, closed `2026-09-22`, labels `bug`, `invalid`). Repositories in
subfolders were not found when VS Code was opened in a parent folder
(1.6.1).

- Thread: none.
- Resolution: the reporter's own PR #9. `checkIsRepo()` answered true for any
  folder inside a work tree. The fix was corrected in review with
  `canonicalizePath()`, merged `2026-09-22`, and shipped in `v1.6.2`.
- Record: PR #9 — repository discovery, right diagnosis and a broken
  comparison.

**#26 — "Feature: Diff two commits"** (`JFingerle`, `2026-10-16`, closed
`2026-10-20`). Two proposals in the issue:

1. select one commit, then Ctrl-click another;
2. right-click and choose "Compare with…", offering a commit SHA, a tag, or a
   branch (its head commit).

- Thread: the maintainer (`2026-10-20`) reported both shipped in 1.9.0:
  - Compare Selected Commits, older to newer;
  - Compare With…, taking a SHA, branch, tag or expression like `HEAD~2`,
    with suggestions as you type;
  - a "Comparing *base* → *compare*" header with Swap;
  - comparison with the working tree, and opening the comparison in
    `git difftool`.

  The reporter answered: "It works perfectly, thank you so much!"
- Record: Release 1.9.0 — "The Diff", slices D10–D15.

**#30 — "Graph shows no remotes (Fetch/Push hidden) when the user has no
global Git config file"** (`zamkorus`, `2026-10-17`, closed `2026-10-20`,
`bug`). Filed by the maintainer with a full diagnosis: `git config --list
--global` exits 128 when the file is absent. It gave a workaround
(`touch ~/.gitconfig`) and three proposed fixes:

1. on the CLI, an absent config file counts as empty config;
2. the engine no longer declines a read just because a file is absent;
3. the webview keeps loaded repository info on a partial error.

- Resolution: fixed in 1.9.0 along those lines. The closing comment adds
  that absence is decided from the file system, not from Git's possibly
  localized message, and that the tests set `GIT_CONFIG_GLOBAL` on both
  backends.
- Record: D60 — A missing global Git config keeps the remotes.

**#31 — "Add copyable diagnostics report, log-file access, and
result/decline-cause log entries"** (`zamkorus`, `2026-10-17`, closed
`2026-10-20`). Filed by the maintainer.

- Resolution: shipped in 1.9.0:
  - Copy Diagnostics Report, to the clipboard, an untitled document or a
    prefilled issue, with credentials redacted;
  - Open Log File and Copy Recent Log (2,000 lines in memory, mirrored to a
    file);
  - a session header, `[result]` lines, decline `cause=` fields and
    `[application]` lines in the log.
- **Loose end** from the closing comment: hand testing on Flatpak and Snap
  installs was not done, and reports from those were invited.
- Record: D01 and D61–D63, with D62F and D63F, under Release 1.9.0.

**#32 — "Source Control title-bar button opens the last active repo instead
of the clicked repository"** (`FelipRamis`, `2026-10-20`, closed the same
day). The issue proposed a fix: use the `SourceControl` argument's `rootUri`,
following the steps `openActiveEditorRepo` takes, and keep the old behavior
when there is no argument. The reporter had patched the 1.8.1 bundle locally
and confirmed it worked.

- Resolution: shipped in 1.9.0 along those lines. The known-root match is
  exact, so an undiscovered nested repository is not replaced by its parent.
- Record: Source Control title button repository selection.

**#39 — "feat: auto pull from checkout"** (`rbalet`, `2026-10-28`, closed
`2026-11-02` as a duplicate of #45). The request: double-clicking a branch
that is behind should pull automatically when there are no local changes.

- Thread: `cktgh` pointed out this is really a fast-forward-only merge. The
  maintainer would add it at most as an optional setting, because each GUI
  action should match one Git command. The reporter then showed their other
  tool's "Checkout the existing branch & pull changes" choice.
- The thread is recorded in full, with an assessment, in Issue #45: checking
  out a remote branch whose local branch exists, below in this record.

**Closed on `2026-11-06`.** The maintainer pushed `main` (at `43c2b56`, as the
release 1.10.0 record notes), and GitHub closed the five issues below from the
integrator's gated closing lines, under the rule in Closing issues from
commits. Each entry links its subsection, which keeps the thread and the
assessment as they were when the issue was open.

**#36 — "Updating push dialog box to better align with default git behavior"**
(`cktgh`, `2026-10-26`, closed `2026-11-06`). The Push Branch dialog pre-checked
`origin` and Set upstream, where plain `git push` uses Git's push remote and
sets upstream only when asked.

- Thread: `zamkorus` (`2026-10-27`) agreed it would be fixed in the upcoming
  release.
- Resolution: shipped in 1.10.0 as W25 (`decdf71`). Gated and closed by
  `613fbb4` (`2026-11-05`), on the push of `main` (`2026-11-06`).
- Record: [Issue #36: push dialog default remote and Set upstream](160-closed-github-issues-and-their-threads/010-issue-36-push-dialog-default-remote-and-set-upstream.md).

**#38 — "feata: delete worktree"** (`rbalet`, `2026-10-28`, closed
`2026-11-06`). A force-delete button on "Unable to Delete Branch", for a branch
that a leftover agent worktree still held.

- Thread: no comments.
- Resolution: shipped in 1.10.0 as W20 (`83f5821`), which explains why a branch
  checked out elsewhere cannot be acted on, and W21 (`88ed629`), which adds
  worktree removal (`--force` only after a second confirmation), stale-entry
  removal, repair and prune. Gated and closed by `f983598` (`2026-11-05`), on
  the push of `main` (`2026-11-06`).
- Record: [Issue #38: remove a leftover worktree that blocks a branch](160-closed-github-issues-and-their-threads/030-issue-38-remove-a-leftover-worktree-that-blocks-a-branch.md).

**#41 — "feat(modal/ux): wide selection"** (`rbalet`, `2026-10-28`, closed
`2026-11-06`). Clicking anywhere on a checkbox's row should toggle it.

- Thread: no comments. The maintainer re-answered the scope on `2026-11-05`:
  every popup, not only modal dialogs.
- Resolution: W06 (`af7ff04`) for the dialog rows, and W06F (`0c1437e`) for every
  popup. Gated and closed by `31417ec` (`2026-11-05`), on the push of `main`
  (`2026-11-06`).
- Record: [Issue #41: whole-row checkbox hit area in dialogs](160-closed-github-issues-and-their-threads/050-issue-41-whole-row-checkbox-hit-area-in-dialogs.md).

**#45 — "fix(checkout remote branch): Allow one click switch and pull when checkout on remote branch with existing local is attempted"** (`rbalet`,
`2026-11-02`, closed `2026-11-06`, label `bug`). Checking out a remote branch
whose local branch exists ended in Git's "already exists", and the suggested
name dropped path segments.

- Thread: `cktgh` confirmed the name bug; the maintainer called the rest a
  feature. The duplicate #39 was closed into it (above).
- Resolution: W05 (`659d095`) pre-fills the full branch name with
  `parseRemoteBranchName()`; W24 (`65725f7`) offers switch, switch and
  fast-forward (`--ff-only`), or another name. Gated and closed by `6f815c5`
  (`2026-11-06`), on the push of `main` the same day.
- Record: [Issue #45: checking out a remote branch whose local branch exists](160-closed-github-issues-and-their-threads/070-issue-45-checking-out-a-remote-branch-whose-local-branch-exists.md).

**#46 — "feat(tag): origine"** (`rbalet`, `2026-11-05`, closed `2026-11-06`).
Show which remotes hold a tag.

- Thread: none. The reporter opened draft PR #47 the same day, with one commit,
  `a109e9a`, which carries the closing line.
- Resolution: PR #47 was reviewed and landed as a plain merge (`a93ddc7`, Y24),
  with its later update `dc1886c` merged at `d1bc642`. Its behavior was
  refined by W26F (`43ac7e9`), W26G (`697423e`, the `repository.showTagRemotes`
  setting, default `origin`) and W26H (`d607144`, the hardened remote read).
  GitHub marked PR #47 merged on `2026-11-06` (`13:30:05Z`), and `a109e9a`'s
  line closed the issue when `main` was pushed.
- Record: [Issue #46: show which remotes hold a tag](160-closed-github-issues-and-their-threads/080-issue-46-show-which-remotes-hold-a-tag.md).
