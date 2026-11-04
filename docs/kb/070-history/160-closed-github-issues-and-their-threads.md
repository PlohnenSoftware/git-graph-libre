---
summary: >-
  Record (`2026-11-04`) of the eight closed GitHub issues (#2, #3, #7, #26,
  #30, #31, #32, #39): what each asked, the proposals in its thread, how it was
  resolved and where the work is recorded. Two loose ends remain: #31's
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
  out a remote branch whose local branch exists, under Open GitHub issues.
