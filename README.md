<div align="center">
  <img src="./resources/icon.png" height="128"/>
  <samp>
    <h1>Git Graph Libre for Visual Studio Code</h1>
    <h3>Visual git history, branch actions, and devcontainer support. A copyleft fork continuing Git Graph's MIT lineage.</h3>
  </samp>
</div>

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)

<!-- Badges to restore after publication (with the new publisher/repo IDs):
     GitHub release, marketplace downloads/installs -->

## Features

- **Graph view**: See branches, tags, and uncommitted changes in one graph
- **Commit details**: Click a commit to see message, files, and diffs
- **Branch actions**: Create, checkout, rename, delete, and merge
- **Tag actions**: Create, delete, and push tags
- **Commit actions**: Checkout, cherry-pick, revert, and reset
- **Avatar support**: Optional avatars from GitHub, GitLab, or Gravatar
- **Multi-repo**: Work with multiple repositories in one workspace
- **Devcontainer ready**: Works in remote and container environments
- **Internationalization**: English, zh-CN, and zh-TW

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
source available under the same terms. See
[docs/LICENSING.md](docs/LICENSING.md) for the full licensing strategy and
provenance.

## Installation

Marketplace listings are coming soon — this fork has not been published yet.
Once it is, it will be available from:

- VS Code Marketplace: _link to follow after publication_

Until then, you can build and install it locally: `pnpm install`, package a
VSIX with `pnpm exec vsce package`, then in VS Code run
`Extensions: Install from VSIX...`.

## Configuration

All settings use the `git-graph-libre` prefix.

| Setting                       | Default         | Description                                      |
| ----------------------------- | --------------- | ------------------------------------------------ |
| `autoCenterCommitDetailsView` | `true`          | Center commit details when opened                |
| `dateFormat`                  | `"Date & Time"` | `"Date & Time"`, `"Date Only"`, or `"Relative"`  |
| `dateType`                    | `"Author Date"` | `"Author Date"` or `"Commit Date"`               |
| `fetchAvatars`                | `false`         | Fetch avatars (sends email to external services) |
| `graphColours`                | 12 defaults     | Colors for graph lines                           |
| `graphStyle`                  | `"rounded"`     | `"rounded"` or `"angular"`                       |
| `initialLoadCommits`          | `300`           | Commits to load on open                          |
| `loadMoreCommits`             | `100`           | Commits to load on demand                        |
| `maxDepthOfRepoSearch`        | `0`             | Folder depth for repo search                     |
| `showCurrentBranchByDefault`  | `false`         | Show only current branch on open                 |
| `showStatusBarItem`           | `true`          | Show status bar button                           |
| `showUncommittedChanges`      | `true`          | Show uncommitted changes node                    |
| `tabIconColourTheme`          | `"colour"`      | `"colour"` or `"grey"`                           |

## License

GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`) — see
[LICENSE](LICENSE). This fork incorporates MIT-licensed material from the
original Git Graph lineage; the required MIT notices and per-era contributor
rosters are preserved in [LICENSE.mit](LICENSE.mit) and credited in
[NOTICE.md](NOTICE.md).

> This project is not affiliated with or endorsed by the original Git Graph
> project or its maintainer.
