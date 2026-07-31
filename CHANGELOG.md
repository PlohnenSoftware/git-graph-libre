# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.2.1...HEAD
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
