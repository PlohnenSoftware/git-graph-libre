# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tab icons now carry the libre bird, in colour and grey variants for light and
  dark themes, selected by the existing `tabIconColorTheme` setting.
- The status bar item now stays visible when no Git repository is found, showing
  an eye icon and "No Git repository found — watching for one" instead of
  disappearing. With a repository it shows a graph icon and the usual tooltip.
- The extension's output channel now timestamps every line and records lifecycle
  events (activation, panel open/reveal, status bar state), making it more useful
  when reporting a problem.

### Changed

- The default graph palette is now a uniform OKLCH ramp, `oklch(59% 0.21 <hue>)`
  across 12 hues, varying only in hue so the colours read as equally bright.
- Drop Open VSX as a distribution target; releases go to the VS Code Marketplace
  only.

### Fixed

- Relative commit dates are now formatted with `Intl.RelativeTimeFormat`, so each
  language supplies its own plural rules and word order. The previous
  singular/plural pair could not express languages with more than two plural
  forms — Polish rendered "2 minut temu" where "2 minuty temu" is correct, and
  was wrong for 1, 2–4, 22–24 and so on, in every unit.

## [1.0.0] - 2026-07-01

### Changed

- Relicense the project from MIT to GNU AGPL-3.0-or-later. The work as a whole
  is now distributed under the AGPL; incorporated MIT-licensed material from
  the mhutchie/asispts lineage remains credited in `NOTICE.md`.
- Rename the extension to Git Graph Libre (`PlohnenSoftware.git-graph-libre`).
  BREAKING: settings move from the `neo-git-graph.*` prefix to
  `git-graph-libre.*`, and the view/clear-avatar-cache commands and diff
  document scheme are renamed accordingly — re-apply any custom settings under
  the new prefix.
- Bump the extension version to 1.0.0 for the relicensed release line.

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

[Unreleased]: https://github.com/PlohnenSoftware/git-graph-libre/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/PlohnenSoftware/git-graph-libre/releases/tag/v1.0.0
[0.4.0]: https://github.com/asispts/neo-git-graph/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/asispts/neo-git-graph/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/asispts/neo-git-graph/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/asispts/neo-git-graph/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/asispts/neo-git-graph/releases/tag/v0.1.0
