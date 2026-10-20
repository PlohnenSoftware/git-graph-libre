<div align="center">
  <img src="./resources/ggl-opengraph-banner-8k.avif"
       alt="Git Graph Libre"
       width="100%">
</div>

## Features

- **Graph view**: See branches, tags, and uncommitted changes in one graph
- **History recovery**: Keep detached HEAD visible and optionally discover unreachable commits
- **Commit details**: Click a commit to see message, files, and diffs
- **Compare anything**: Ctrl/Cmd-click two commits and choose **Compare
  Selected Commits**, or use **Compare With…** on a commit, branch or tag to
  compare it with any SHA, branch, tag or expression such as `HEAD~2`. A
  comparison says what it compares, swaps sides in one click, can compare a
  commit with the working tree, and opens in your own `git difftool`
- **GGL Diff tab**: A side-by-side diff of Git Graph Libre's own, computed in
  the Rust engine with a port of VS Code's diff algorithm, so it highlights
  lines and characters as VS Code's diff editor does. Open it from a file in
  the Source Control view or in commit details (**Open in GGL Diff**)
- **Branch actions**: Create, checkout, rename, delete, and merge
- **Tag actions**: Create, push, view details, and delete locally or on selected
  remotes; signed tags are marked with a verified badge in the graph
  - Tag types: lightweight tags are a plain ref with no tag object, so they are
    unsigned by definition and carry no message; annotated tags follow your git
    signing configuration (`tag.gpgSign`, `user.signingkey`, `gpg.format`) and
    may have an optional message
- **Commit actions**: Checkout, cherry-pick, revert, and reset
- **Stashes**: See stashes in a list above the graph, as rows beside the commit
  each was taken from, or both; apply, pop, drop, or branch from any of them
- **Staging**: Click the uncommitted-changes row to stage and unstage files, or
  whole folders, by dragging them between the staged and unstaged panes;
  right-click the row to switch between the folder tree and a flat path list
- **Settings**: Repository and extension settings in one popup, and a
  Contributors tab crediting everyone who built Git Graph Libre and the
  projects it grew from, with each part's license, and the AI agents that
  co-authored its commits
- **Avatar support**: Optional avatars from GitHub, GitLab, or Gravatar
- **Status at a glance**: Rest the pointer on the status dot above the toolbar
  to see the Git version, whether the built-in Rust engine is running, and
  which of the two loaded the graph; an amber dot reading "Ready (Rust engine
  unavailable)" means everything works through Git, only slower, and a hollow
  dot reading "Ready (Rust off)" means the `backend` setting has the engine
  switched off — shown so an accidental `git-cli` never looks like a healthy
  engine
- **Multi-repo**: Work with multiple repositories and declared Git submodules in
  one workspace; reload the extension after changing `.gitmodules`
- **Startup diagnostics and recovery**: See Git availability, repository
  discovery, and Rust engine status when the graph cannot open. If Git rejects
  a repository's ownership, confirm **Trust this repository in Git** to add
  that exact directory, spelled as Git reports it, to Git's global
  `safe.directory` list; in a workspace where another repository did open,
  run **Git Graph Libre: Trust Repository in Git…** instead. This is separate
  from VS Code Workspace Trust, which the extension needs as well. The open
  tab checks again automatically after trust or Git settings change, and the
  Rust engine never reads a repository Git has not accepted. When no
  repository is found, adjust the search depth directly on the screen; the
  setting is saved for the workspace. An open graph tab comes back when VS
  Code restores its window (`restoreTabOnStartup`).
- **Bug reports made easy**: **Copy Diagnostics Report** collects what a bug
  report needs (versions, Git, the Rust engine, changed setting names, the
  recent log) with credentials redacted, for the clipboard, a document or a
  prefilled GitHub issue; **Open Log File** and **Copy Recent Log** reach the
  log directly. Nothing is sent until you paste or submit it
- **Devcontainer ready**: Works in remote and container environments
- **Internationalization**: English, Dutch, Polish, zh-CN, and zh-TW

## Why this fork

The original [Git Graph](https://github.com/mhutchie/vscode-git-graph) by
mhutchie left the MIT license in May 2019 — everything after
[commit 4af8583](https://github.com/mhutchie/vscode-git-graph/commit/4af8583a42082b2c230d2c0187d4eaff4b69c665)
is under more restrictive terms. This fork descends from that last MIT commit
via [asispts/neo-git-graph](https://github.com/asispts/neo-git-graph) and adds
devcontainer support, internationalization, and a modernized codebase and
toolchain.

From version 1.0.0 the project is licensed under the GNU AGPL-3.0-or-later.
Copyleft guarantees this fork stays open: anyone may redistribute or build on
it, but every distributed or network-hosted derivative must keep its complete
source available under the same terms. See [NOTICE.md](NOTICE.md) for the
full licensing strategy and provenance, and [LICENSE.mit](LICENSE.mit) for
the preserved MIT notices and contributor rosters.

## Installation

Install it from your editor's registry:

- **VS Code Marketplace** —
  [marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=PlohnenSoftware.git-graph-libre),
  or press `Ctrl+P` and run `ext install PlohnenSoftware.git-graph-libre`.
- **Open VSX Registry**, for VSCodium, Cursor, Gitpod, and Eclipse Theia —
  [open-vsx.org](https://open-vsx.org/extension/PlohnenSoftware/git-graph-libre).

You can also build and install it yourself: `pnpm install`, then `pnpm run
build` to build the whole stack — the Rust engine for your platform and the
extension itself — then `pnpm exec vsce package --no-dependencies` and, in VS
Code, `Extensions: Install from VSIX...`.

`pnpm run build` needs `rustup`; the exact compiler version is pinned in
`rust-toolchain.toml` and installed for you. Without a Rust toolchain, skip
it: `vsce package` on its own still produces a working extension that runs
entirely on the `git` CLI.

`pnpm run build:all` builds the engine for **every** supported platform rather
than just yours — Windows, macOS and Linux on x64 and arm64, with one Linux
build per architecture that runs on glibc and musl systems (such as Alpine)
alike — which is what the published package contains. It
cross-compiles all of them from whichever machine you run it on, so releasing
never depends on a particular CI service. The installed copy removes the
binaries for other platforms the first time it runs, so keeping every
platform in the one package costs the download, not your disk.

## Configuration

All settings use the `git-graph-libre` prefix.

| Setting                                        | Default         | Description                                      |
| ---------------------------------------------- | --------------- | ------------------------------------------------ |
| `autoCenterCommitDetailsView`                  | `true`          | Center commit details when opened                |
| `dateFormat`                                   | `"Date & Time"` | `"Date & Time"`, `"Date Only"`, or `"Relative"`  |
| `dateType`                                     | `"Author Date"` | `"Author Date"` or `"Commit Date"`               |
| `dialog.createBranch.checkout`                 | `true`          | Pre-check "Check out" in the create-branch dialog |
| `dialog.merge.noFastForward`                   | `true`          | Pre-check "no fast-forward" in merge dialogs     |
| `dialog.pullBranch.noFastForward`              | `false`         | Pre-check "no fast-forward" in the pull dialog   |
| `fetchAvatars`                                 | `false`         | Fetch avatars (sends email to external services) |
| `graphColors`                                  | 12 defaults     | Colors for graph lines                           |
| `graphStyle`                                   | `"rounded"`     | `"rounded"` or `"angular"`                       |
| `initialLoadCommits`                           | `250`           | Commits to load on open                          |
| `loadMoreCommits`                              | `750`           | Commits to load on demand                        |
| `maxDepthOfRepoSearch`                         | `0`             | Folder depth for repo search                     |
| `repository.boldCheckedOutCommit`              | `false`         | Bold the checked-out commit's message            |
| `repository.fetchTagsByDefault`                | `true`          | Pre-check "Fetch all tags" in the Fetch dialog   |
| `repository.includeReflog`                     | `false`         | Include commits referenced only by reflogs       |
| `repository.includeUnreachableCommits`         | `false`         | Scan for unreachable commits in Show All         |
| `repository.muteMergeCommits`                  | `false`         | Mute merge commit messages (opt-in)              |
| `repository.stashDisplay`                      | `"both"`        | Show stashes in the `"table"`, the `"graph"`, or `"both"` |
| `uncommittedChanges.fileViewMode`              | `"tree"`        | Staging panel shows changes as a `"tree"` or flat `"list"` |
| `showCurrentBranchByDefault`                   | `false`         | Show only current branch on open                 |
| `showStatusBarItem`                            | `true`          | Show status bar button                           |
| `restoreTabOnStartup`                          | `true`          | Reopen the graph tab when a window is restored   |
| `showUncommittedChanges`                       | `true`          | Show uncommitted changes node                    |
| `telemetry.enabled`                            | `"unset"`       | `unset` / `enabled` / `disabled` — see below     |
| `tabIconColorTheme`                            | `"color"`       | `"color"` or `"grey"`                            |
| `backend`                                      | `"auto"`        | `"auto"` (Rust engine with Git CLI fallback) or `"git-cli"` |

## Telemetry

This extension can send anonymous usage data so development can be aimed at
the features people actually use. It asks first and sends nothing until you
answer. It is a hobby project with no company behind it, and the data goes to a
small self-hosted service at `t.plohnensoftware.download` — never to a
third-party analytics provider.

**What is sent**

- Which command or action ran (for example `pushTag`), and whether it succeeded.
- Once per session: whether a feature that works by *showing* something was
  actually in effect — recovered history (reflog-only or unreachable commits)
  appearing in the graph, a signed tag being there to badge, a discovered Git
  submodule appearing in the repository dropdown, the graph actually being
  opened on one, the uncommitted-changes staging panel being opened, that
  panel actually grouping changes into folders, a stash row appearing in
  the graph, the built-in Rust engine actually serving a repository read,
  that engine being unable to start although the `backend` setting allowed
  it (only which of the five fixed reasons — missing, failed to load, wrong
  version, incompatible, unsupported platform — never a path or error
  text), it failing a read outright, it handing a read back to the Git
  command line, or the Hidden menu's one-off "Reload once with Git CLI"
  being used. These
  are recorded once, not once per refresh, and each is a yes/no about the
  feature: the repository paths behind the submodule answers
  are compared inside the extension and never leave it, so nothing is sent
  about which repositories or submodules you have.
- Once per session: the language Visual Studio Code is running in and which of
  this extension's translations served you — so missing translations can be
  spotted, since a mismatch between the two is a request nobody has answered.
- Each distinct visible failure screen: Git ownership trust required, Git
  unavailable, repository access failed, or graph load failed. The ordinary
  no-workspace and no-repository screens are counted separately as empty states.
  Only the fixed category is sent. Polling or retrying the same screen does not
  increase its count; seeing it again after recovery does. No error text, path,
  repository details, or search depth is included.
- Once per session: which settings you have changed from their defaults — only
  *that* they were changed, never what you changed them to.
- The properties Visual Studio Code attaches to every extension telemetry
  event: extension and VS Code version, product (Code, Insiders, VSCodium,
  Cursor), whether this is a new installation, and anonymized machine, session,
  and device identifiers generated by VS Code itself.
- Your operating system, processor architecture, and the numeric part of your
  OS version (`linux` / `x64` / `7.2.2`, with any build or distribution suffix
  stripped). Visual Studio Code does not attach these itself, so the extension
  adds them.

**What is never sent**

File names, file paths, workspace or folder names, repository names, git remote
URLs, branch names, tag names, commit hashes, commit messages, author names,
email addresses, environment variables, credentials, or your list of installed
extensions.

**What the receiving service stores**

The list above is also the complete list of what is *kept*. The service at
`t.plohnensoftware.download` is a small self-hosted ingest — two containers, one
table, no dashboard, no third party — and it writes that payload plus a
timestamp of its own. It adds nothing else about you:

- **No IP address.** It is never read, never logged, and never hashed, and
  there is no column it could be stored in. Avoiding the automatic IP
  geolocation that hosted analytics products apply was the main reason to
  self-host at all, so no country, region, city, or network operator is attached
  to anything you send.
- **No request headers, user agent, cookies, or referrer.** Nothing outside the
  JSON body is read. The endpoint has no login and no session, so there is not
  even a token that could tie two of your requests together.
- **No access log.** The server logs startup, shutdown, and database failures.
  It never logs a request body, an address, or a property value.
- **No names, email addresses, or accounts.** Nothing in the system has a user
  account for one to belong to.
- **Nothing joinable to another dataset.** No install token, no license key, no
  cross-service identifier. A copy of the database, on its own, joins to
  nothing.

The closest thing to an identifier is the anonymized machine id Visual Studio
Code generates. It is what makes *how many* installations use a feature
answerable rather than just how many clicks happened, and actions are grouped by
it when reading the data. It is not derived from your hardware, your hostname,
or your user name; it is shared across all your extensions rather than specific
to this one; and it resets if you reinstall your operating system. With no IP
address and no log stored beside it, there is no second field to work back
through to a person.

The server is open source, and its schema is the full list of what it is even
able to store:
[git-graph-libre-telemetry-server](https://github.com/PlohnenSoftware/git-graph-libre-telemetry-server).

**Important**

Even though I believe this data could help me to allocate my time better and I find it useful,I prioritize users so please only accept telemetry if you feel comfortable with it. This is also a reason why extention requests your action to take a educated decision about it.

**Nothing is sent until you say so**

`git-graph-libre.telemetry.enabled` has three states and starts at `unset`:

| State      | What happens                                            |
| ---------- | ------------------------------------------------------- |
| `unset`    | Nothing is sent. The default — no answer is not a yes.  |
| `enabled`  | Feature-usage data is sent, subject to the switch below |
| `disabled` | Nothing is sent.                                        |

The extension asks once when it activates, and again whenever you open the
graph, until you answer. Closing the notification without choosing is not an
answer: the state stays `unset` and nothing is sent.

While the question is open the graph is not shown — you get a screen saying
what is being waited for, with a **Set now** button that brings the
notification back if you dismissed it. Answer it either way and the graph
opens; `disabled` is a complete answer and costs you nothing.

Visual Studio Code's own `telemetry.telemetryLevel` setting always wins on top
of that: while it is off, nothing is sent no matter which state the setting
above is in. If you accept while that switch is off, the extension says so and
offers to open the setting rather than storing a preference that cannot take
effect.

Run `code --telemetry` to see the full declaration of what this extension
collects, alongside every other extension you have installed.

## License

GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`) — see
[LICENSE](LICENSE). This fork incorporates MIT-licensed material from the
original Git Graph lineage; the required MIT notices and per-era contributor
rosters are preserved in [LICENSE.mit](LICENSE.mit) and credited in
[NOTICE.md](NOTICE.md).

> This project is not affiliated with or endorsed by the original Git Graph
> project or its maintainer.
