# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.2] - 2026-09-03

### Added

- **Git submodules show up as repositories of their own.** Repository
  discovery now reads the `path` entries declared in a repository's
  `.gitmodules`, checks that each one stays inside its parent and really is a
  Git repository, and adds it alongside the parent — nested submodules
  included. The repository dropdown keeps the plain names and draws each
  submodule indented under its parent with a connector, so the structure is
  visible without the paths being spelled out. `.gitmodules` is not watched
  live: a submodule added or removed while the window is open appears on the
  next repository scan, such as after reloading the extension. Thanks to
  [Kristjan ESPERANTO](https://github.com/KristjanESPERANTO), who contributed
  this feature in [#1](https://github.com/PlohnenSoftware/git-graph-libre/pull/1).
- **Submodule use is now covered by the optional usage telemetry**, alongside
  the other features that work by *showing* something rather than being
  invoked. Two yes/no signals are recorded at most once per session: that a
  discovered submodule was listed in the repository dropdown, and that the
  graph was actually opened on one. The repository paths those answers are
  derived from are compared inside the extension and never sent — nothing is
  recorded about which repositories or submodules you have — and, as always,
  nothing at all is sent unless you have accepted telemetry.

### Fixed

- **Submodule paths are normalized like every other repository path.** A
  discovered submodule's path is now stored with forward slashes, matching the
  rest of the extension; on Windows it would otherwise have been recorded with
  backslashes, which the parent/child comparisons do not match.

## [1.4.1] - 2026-09-03

### Fixed

- **Annotated tags can be created without a message.** The Add Tag dialog now
  labels the annotated message as optional and accepts it when empty.
  Lightweight tags continue to hide the field, and their action payload cannot
  carry a message.

## [1.4.0] - 2026-09-03

### Added

- **A language switcher behind a double right-click on the version** in the
  status strip above the graph. Picking a language re-renders the graph in it
  for that tab only — nothing is saved, and closing the tab restores the
  language Visual Studio Code is set to. The menu itself is always in English,
  so it stays usable when the interface is in a language you cannot read.
- **Every place that asks about telemetry now links to what is actually sent.**
  The consent notification has a **What Is Sent?** button, the screen shown
  while the question is open carries the same link, and the setting in the
  settings UI links there too.
- **Telemetry now records which translation you are reading**, alongside the
  language Visual Studio Code is set to. Only the two language identifiers are
  sent; the pair is what matters, since a display language with no matching
  translation is a request for one that does not exist yet.
- **Fetch tags from selected remotes.** Tags previously only reached your
  repository as a side effect of git's default tag-following during a fetch,
  so a tag pushed to a remote after you already had its commits stayed
  invisible until something else dragged it in. A new **Fetch Tags** action on
  the tag context menu runs `git fetch --tags` against the remotes you tick,
  with an optional prune that deletes local tags the remote no longer has. The
  toolbar Fetch dialog also gained a **Fetch all tags** checkbox that does the
  same across every remote.
- **Push All Tags**, a new toolbar action next to Fetch, pushes every local tag
  (`git push --tags`) to the remotes you tick, with the same bypass-hooks and
  force/force-with-lease options as the branch push dialog. Like Fetch, the
  button only appears once the repository has a remote.
- **Push Tag now asks where to push.** The dialog lists every configured remote
  as its own checkbox — your default push remote pre-ticked — and offers the
  bypass-hooks and push-mode options, instead of silently pushing to `origin`.
- **A dedicated view for repositories with no commits.** A freshly initialized
  repository used to show the same "No commits to show for this branch" row as
  a filter that matched nothing, which gave no hint about which situation you
  were in. It now gets a centered view with a graph icon, a heading, and a
  prompt to create your first commit, and the branch, tag, author, and remote
  branch filters are hidden while it shows, since none of them can do anything
  yet. The view only appears for a genuinely empty repository, so no
  combination of filters can trigger it.
- **Anonymous usage telemetry**, so development can be aimed at the features
  people actually use. It records which command or action ran and whether it
  succeeded, plus a once-per-session note of which settings you have changed
  from their defaults — only *that* they were changed, never what to. File
  names, paths, workspace and repository names, remote URLs, branch and tag
  names, commit hashes and messages, author identities, and your installed
  extension list are never sent, and the receiving service stores no IP
  addresses. Data goes to a small self-hosted service, not a third-party
  analytics provider. **Nothing is sent until you choose**: the new
  `git-graph-libre.telemetry.enabled` setting starts at `unset`, which sends
  nothing, and only `enabled` turns collection on. The extension asks on
  activation and again on each graph open until you answer — dismissing the
  notification is not an answer — and accepting while Visual Studio Code's own
  `telemetry.telemetryLevel` is off tells you that switch wins and offers to
  open it. Refusing is a single click on **Reject and Don't Show Again**, which
  stops both the sending and the asking for good. While the question is open the
  graph is replaced by a screen saying what is being waited for, with a **Set
  now** button that brings the notification back if it was dismissed; answering
  either way — including refusing — opens the graph. Alongside commands and actions,
  two features that work by *showing* something are recorded once per session
  when they actually take effect: recovered history appearing in the graph, and
  a signed tag being there to badge. `code --telemetry` shows the full
  declaration. See the README for details.
- **New setting `git-graph-libre.repository.fetchTagsByDefault`** (default
  `true`): controls whether the **Fetch all tags** checkbox in the toolbar
  Fetch dialog starts ticked.
- **New setting `git-graph-libre.repository.boldCheckedOutCommit`** (default
  `false`): opt-in bold rendering of the checked-out commit's message, so the
  commit you are sitting on stands out in the Description column.
- **New setting `git-graph-libre.repository.muteMergeCommits`** (default
  `false`): opt-in dimming of merge commit messages as a reading aid.
- All three new settings are localized in English, Dutch, Polish, Simplified
  Chinese, and Traditional Chinese, and are available in the settings hub's
  Extension tab.
- **Dutch (`nl`) localization**, covering the full interface and every setting
  description — the same coverage the other languages have.

### Changed

- The status bar above the graph — the readiness text and the version — is no
  longer selectable text, and shows a normal pointer instead of a text cursor.
  It is chrome, like the graph's column headers, and an I-beam there only
  invited selections that meant nothing.

- **Merge commits now render at full contrast by default.** Merge-commit
  dimming was previously hardcoded and unconditional; it is now gated on the
  new `repository.muteMergeCommits` setting, so existing users will notice
  merge rows getting brighter unless they enable the setting.
- **No commit message is bold by default any more.** The checked-out commit's
  message was previously bolded unconditionally; that emphasis is now gated on
  the new `repository.boldCheckedOutCommit` setting, which is off, so by
  default every row's message reads at the same weight. Bold is also scoped to
  the commit message alone — branch and tag labels are never bolded, and the
  checked-out branch continues to be marked by its graph-colored border rather
  than by weight.
- **Fetch now brings tags along by default.** The toolbar Fetch dialog's new
  **Fetch all tags** checkbox starts ticked, so a plain Fetch also runs
  `git fetch --tags` against every remote — tags pushed after you already had
  their commits now arrive without a separate step, at the cost of a little
  extra work per fetch. Set `repository.fetchTagsByDefault` to `false` to go
  back to ticking the box per fetch.
- **Switching away from the graph tab and back is now instant.** The graph
  panel keeps its state while hidden instead of being torn down and rebuilt, so
  returning to the tab no longer reloads the webview — no reload flash, no
  re-fetch, and your scroll position is kept. (Filter selections and the
  expanded commit already survived the reload; they are now kept without one.)
  A re-shown panel refreshes its repository list and graph data in place.
- **The Add Tag dialog is clearer about tag types.** The type option now reads
  **Lightweight (unsigned)**, choosing it hides the Message row and explains
  that a lightweight tag is a plain ref with no tag object — so it carries no
  message and cannot be signed — and an annotated tag with an empty message is
  rejected instead of being created.

### Fixed

- **Branch and tag labels no longer turn gray on muted rows.** Muting — from
  either the new merge-commit dimming or the existing
  `repository.muteCommitsNotAncestorsOfHead` — now applies only to the commit
  message text inside the Description cell; branch and tag labels keep
  full-contrast text in every theme.
- **A lightweight tag stays lightweight when `tag.gpgSign` is set.** With that
  git config enabled, creating a lightweight tag quietly produced a signed,
  annotated tag object and popped open your editor to ask for a tag message —
  neither of which you asked for. Lightweight tag creation now passes
  `--no-sign`, so it always produces a plain ref and never opens an editor.
  Annotated tags are unchanged and keep following your git signing
  configuration (`tag.gpgSign`, `tag.forceSignAnnotated`, `user.signingkey`,
  `gpg.format`).
- **Pushing a tag no longer assumes a remote named `origin`.** The push was
  hardcoded to `origin`, so a repository whose remote is named anything else
  could not push tags at all, and a repository where a branch and a tag share a
  name failed with an ambiguous-refspec error. Tags are now pushed as
  `refs/tags/<name>` to each remote you select, which is unambiguous by
  construction.
- **Cherry-pick and Revert now work on a root commit.** On a commit with no
  parents both actions opened the merge parent-selection dialog with nothing to
  select, leaving no way to proceed. A root commit now takes the same plain
  confirmation as any single-parent commit; only real merges still ask which
  parent to use. Drop remains unavailable on a root commit, because the rebase
  it performs needs a parent to rebase onto.
- **The status bar item appears again in a folder with no Git repository.** The
  extension only activated when it found a repository at the workspace root, so
  the "No Git repository found — watching for one" eye added in 1.1.0 could
  never actually be shown, and one of the two activation triggers never matched
  anything. The extension now activates once VS Code has finished starting up.
- **Tag creation and tag pushes are recorded in the extension's output
  channel.** Both ran outside the git command log, so they were missing from the
  log you would reach for when reporting a problem with them.

## [1.3.0] - 2026-08-06

### Changed

- **Root commits now render as squares** instead of circles. A commit with no
  parents (the original, oldest commit of a history) is drawn as a small square
  node, visually distinguishing a history's origin from the circular commit
  nodes above it. Merge commits and all other commits keep their circle shape.
- **A root commit no longer trails a line below it.** In repositories with more
  than one root (parallel histories), a non-bottom root previously had a stray
  vertical line continuing downward as if it had a parent. The graph layout now
  terminates each branch at its root, so only the bottom-most root sits at the
  base of a column.

## [1.2.1] - 2026-07-31

### Added

- **The extension version is now shown in the status strip**, right-aligned as
  e.g. `v1.2.1`, while the readiness indicator and status text stay on the
  left. The version is read from the extension's `package.json`, threaded
  through the webview panel build, and HTML-escaped before embedding. A new
  localized `ui.version` label ships for `en`, `pl`, `zh-cn`, and `zh-tw`.

## [1.2.0] - 2026-07-29

### Fixed

- **SSH-signed commits are no longer shown as unsigned** in the Signature
  column. `git log %G?` reports `N` for commits it cannot verify — which
  includes SSH-signed commits when no `gpg.ssh.allowedSignersFile` is
  configured — so they were indistinguishable from genuinely unsigned commits
  and displayed as `—` Unsigned. The loader now probes the commit object's
  `gpgsig` header (a single batched `git cat-file --batch` over only the
  ambiguous commits) and reclassifies those that carry a signature as
  signed-but-**Unverifiable** (`?`), regardless of signature type (SSH, GPG, or
  x509). Verified and genuinely unsigned commits are unchanged. The probe adds
  no extra git calls when the Signature column is hidden or every commit
  verifies cleanly.

## [1.1.2] - 2026-07-29

### Changed

- **Signed-tag visual refined**: the tag icon now keeps its commit-color
  background (restored), and a separate verified badge sits flush against it
  on the signature-status green, sized as in 1.1.1. Signed tags share the
  default neutral border with every other ref so all tags read consistently;
  the green verified badge — not the border — carries the signature
  distinction.
- **Commit signature column**: a valid (signed) commit now shows the verified
  symbol inside a filled signature-status green circle, unifying the look with
  the signed-tag badge.

## [1.1.1] - 2026-07-29

### Added

- **Signed tags are visually distinct**: an annotated tag whose object carries a
  signature now renders with a verified badge, a tinted label, and a "signed tag"
  tooltip in the graph, using the same color family as the commit signature
  column. Lightweight tags have no tag object and are never marked. Detecting the
  signature is free — it rides along on the existing `for-each-ref` call and does
  not run signature verification, which stays in the tag details popup.
- **Delete a tag on selected remotes**: the Delete Tag dialog now lists every
  configured remote as its own opt-in checkbox and deletes the tag there after
  removing it locally. `refs/tags` has no per-remote tracking refs, so a remote
  that never had the tag is treated as success rather than an error, and the tag
  is deleted by its full `refs/tags/` ref so a same-named branch is never hit.
- **Tag details popup redesigned**: the popup now lays out tag metadata
  (type, object, target, tagger, date, signature, message) in a structured
  two-column grid instead of a squeezed inline block, with a predictable width
  so hashes and long messages are no longer cramped. It also offers one-click
  **Copy Tag Name**, **Copy Object Hash**, and **Copy Tag Message** actions.

### Changed

- The tag details popup now colors the signature line by status (valid, bad or
  failed, unknown, unsigned), matching the new signed-tag badge.
- The release workflow now builds the VSIX, attaches it to a GitHub release for
  the pushed tag, and publishes to the VS Marketplace only when
  `VS_MARKETPLACE_TOKEN` is configured. Without the token the release still
  happens and the publish step is skipped with a notice.

## [1.1.0] - 2026-07-27

### Added

- **History recovery**: an opt-in repository setting finds unreachable and
  orphaned commits that have not yet been pruned, making otherwise hidden work
  discoverable from the graph. It is available in Repository Settings and as a
  checkbox in the table-header context menu.
- **Commit signature status**: an optional Signature column shows whether each
  commit is signed and whether the signature verifies, with the signer and key in
  the tooltip. It is off by default (`git-graph-libre.columns.signature`) and can
  be toggled from the table header context menu. Verification only runs while the
  column is visible, so the extra `git log` work is never paid for when hidden.
- Commit details now show the author and the committer with their own identity
  and date rows, collapsing back to a single Date row when the two match. Author
  and committer dates are read independently of the `dateType` setting.
- The status bar item now stays visible when no Git repository is found, showing
  an eye icon and "No Git repository found — watching for one" instead of
  disappearing. With a repository it shows a graph icon and the usual tooltip.
- The extension's output channel now timestamps every line and records lifecycle
  events (activation, panel open/reveal, status bar state), making it more useful
  when reporting a problem.

### Changed

- Matching local and remote branch labels are grouped into one compact marker:
  the local branch keeps the primary name while each remote is shown as a short
  alias. Every segment retains its own branch actions and full-name tooltip.
- Rename the internal webview type namespace from `GG` to `GGL` so its shorthand
  matches Git Graph Libre throughout source and tests.

### Fixed

- Show All now includes `HEAD` explicitly, so a detached commit remains visible
  even when no branch, tag, remote-tracking ref, or reflog entry reaches it and
  even when the normal page limit would otherwise exclude it.
- Relative commit dates are now formatted with `Intl.RelativeTimeFormat`, so each
  language supplies its own plural rules and word order. The previous
  singular/plural pair could not express languages with more than two plural
  forms — Polish rendered "2 minut temu" where "2 minuty temu" is correct, and
  was wrong for 1, 2–4, 22–24 and so on, in every unit.

## [1.0.0] - 2026-07-01

### Added

- **Finding commits**: a find widget over loaded commits, plus a full-history
  search command that queries beyond what is currently loaded.
- **Keyboard navigation**: shortcuts for moving through the graph, opening and
  closing commit details, and jumping to HEAD.
- **Commit details**: collapse controls, tree and list file view modes, a
  resizable panel, per-file actions, clickable URLs and issue links, and a
  configurable short hash length.
- **Commit actions**: actions on the selected commit and on commit rows,
  including a rebase suite, comparison against HEAD, and archiving a ref.
- **Stashes and uncommitted changes**: a full action suite for both.
- **Branch and remote actions**: upstream-aware branch actions, a fetch action
  enabled only when remotes exist, and a remote settings popup.
- **Repository settings**: a modal settings panel with per-repo toggles, plus a
  tabbed extension settings hub and configuration export/import.
- **Graph controls**: filter dropdowns, per-repo commit ordering, column
  show/hide from the header context menu, graph density settings, and automatic
  loading of more commits when scrolled to the bottom.
- **Toolbar**: a Source Control title-bar button, a status strip, a repository
  terminal action, and a tag details context action.
- A `contextMenuActionsVisibility` setting to hide individual context menu
  entries, and a persistent reveal highlight setting.
- Tab icons carrying the libre bird, in colour and grey variants for light and
  dark themes, selected by the existing `tabIconColorTheme` setting.
- Polish (`pl`) localization.

### Changed

- Relicense the project from MIT to GNU AGPL-3.0-or-later. The work as a whole
  is now distributed under the AGPL; incorporated MIT-licensed material from
  the mhutchie/asispts lineage remains credited in `NOTICE.md`.
- Rename the extension to Git Graph Libre (`PlohnenSoftware.git-graph-libre`).
  BREAKING: settings move from the `neo-git-graph.*` prefix to
  `git-graph-libre.*`, and the view/clear-avatar-cache commands and diff
  document scheme are renamed accordingly — re-apply any custom settings under
  the new prefix.
- BREAKING: settings renamed to American spelling — `graphColours` becomes
  `graphColors` and `tabIconColourTheme` becomes `tabIconColorTheme`. Values
  stored under the old keys are still honoured for now.
- The default graph palette is now a uniform OKLCH ramp,
  `oklch(59% 0.21 <hue>)` across 12 hues, varying only in hue so the colours
  read as equally bright. `graphColors` still accepts HEX and RGB.
- Selected commit rows are tinted with their own graph dot colour, and merge
  commit rows are muted.
- Dialogs, menus and dropdowns now use native VS Code theme tokens, with OKLCH
  fallbacks where a theme does not define one.
- Activation is scoped to concrete events rather than starting eagerly, and repo
  file watchers use `RelativePattern`.
- Drop Open VSX as a distribution target; releases go to the VS Code Marketplace
  only.
- Bump the extension version to 1.0.0 for the relicensed release line.

### Fixed

- Git output parsing is hardened throughout: NUL-separated `git log` fields,
  structured `for-each-ref` ref parsing, and stricter diff parsing, so commit
  messages containing separator-like text no longer corrupt the graph.
- Stale asynchronous load responses can no longer overwrite newer ones.
- The branch selector no longer grows on every refresh.
- Webview state is restored correctly on first load, and the scrollbar no longer
  shifts during rendering.
- Toolbar dropdowns no longer truncate, and the sticky header seam and navbar
  dropdown width are corrected.
- Graph hover states and focus rings render correctly.
- Avatar cache checks and remote source determination are corrected.
- Branches with no commits show a localized empty state.
- Security and reliability findings from static analysis are resolved, covering
  nonce generation, regular expression use, credential handling in logged Git
  commands, and avatar hashing.

## [0.4.0] - 2026-04-10

### Added

- Full internationalization (i18n) support with multiple languages
- Language support: English (default), Simplified Chinese (简体中文), Traditional Chinese (繁體中文)

### Fixed

- Escape HTML in git output before rendering

## [0.3.0] - 2026-03-26

### Added

- Introduce gitClient based on simple-git
- Added a button to locate HEAD in the graph

### Changed

- Extract webview bridge
- Extract webview lifecycle

## [0.2.0] - 2026-03-17

### Added

- Add initial test suite and CI configuration

### Fixed

- Remove information message

## [0.1.1] - 2026-02-23

### Changed

- Migrate build system to esbuild and upgrade dependencies
- Add oxlint linter and oxfmt formatter

## [0.1.0] - 2026-02-18

Initial release

[Unreleased]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.4.2...HEAD
[1.4.2]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/PlohnenSoftware/git-graph-libre/releases/tag/v1.0.0
[0.4.0]: https://github.com/asispts/neo-git-graph/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/asispts/neo-git-graph/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/asispts/neo-git-graph/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/asispts/neo-git-graph/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/asispts/neo-git-graph/releases/tag/v0.1.0
