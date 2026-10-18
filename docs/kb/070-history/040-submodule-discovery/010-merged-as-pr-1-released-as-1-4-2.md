---
summary: >-
  Record of the first outside PR (#1, released `1.4.2`): AGPL contributor
  credit goes in `NOTICE.md`, never `LICENSE.mit`; Windows path and ReDoS
  fixes, `view.submoduleRepo*` telemetry, verification.
---

# Merged as PR #1, released as `1.4.2` (`2026-09-03`)

This arrived as the project's **first outside pull request** —
`b38c002` by Kristjan ESPERANTO, merged as `c3f5fc0` — not as an agent slice,
so the gates ran after the merge rather than before the commit. Two points for
whoever handles the next one:

- **An outside contribution is an AGPL contribution, and it does not touch
  `LICENSE.mit`.** That file preserves the MIT notices and the rosters of
  *incorporated MIT material*; adding a direct contributor there would
  advertise their AGPL work as reusable under MIT and break the one-way licence
  rule this project exists to keep. `NOTICE.md` gained a "Contributors to the
  AGPL-licensed work" section for exactly this, the contributor was added to
  `package.json`'s `contributors`, and the CHANGELOG credits them by name and
  PR number so the credit ships in the VSIX rather than living only in the git
  history. Note the maintainer appears in **both** files legitimately: the MIT
  roster for `2026-03-25`, the AGPL section from the `2026-07-01` relicensing.
- **Two defects were fixed on top of the merge**, both in the merged file:
  `path.resolve()` returns backslashes on Windows while every other repository
  path in the extension is normalized to `/` (`getPathFromUri`), so the
  discovered path is now normalized inline — inline and not via
  `@/backend/utils/path`, because that module imports `vscode` and the backend
  test project has no `vscode` alias. And `line.match()` became a hoisted
  `RegExp.exec()`, which is `typescript:S6594` and has been caught by this
  gate before (see the `1.2.0` `parseGpgsigPresence` note). Four merged files
  also needed `biome format`; the contributor's line width differed.

**Telemetry for the feature (`2026-09-03`).** The maintainer asked for
submodule usage to be measurable. Submodules are a *shown* feature — discovery
puts them in the repository dropdown and no command sits behind them — so the
signals went into `createViewFeatureReporter()`, the documented third
chokepoint, and are reported from the existing `recordCommitLoad()` call in the
`loadCommits` route rather than from a new call site. Two ids, both once per
session: `view.submoduleRepo` (a nested repository was in the set to offer) and
`view.submoduleRepoActive` (the graph was actually drawn for one). The second
is the usage signal; the first only says discovery found something.

- **The facts are compared, never sent.** `recordCommitLoad` now takes
  `repoPaths` and `repo`, and containment is decided inside the reporter; the
  payload stays `{ feature, ok }` with a fixed id. The maintainer flagged
  repository-name leakage as critical, so a test asserts the serialized output
  contains none of the path fragments it was given and that every event has
  exactly the `feature`/`ok` keys. Keep that test if this module is refactored.
- **Containment compares on a trailing `/`**, because sibling repositories
  routinely share a name prefix and a bare `startsWith` would report every one
  of them as its neighbour's submodule. There is a test for that too.
- **Read the numbers as "submodule discovery had something to show", not as a
  count of `.gitmodules` files.** A repository added by hand with Add
  Repository can also land inside another one. The workspace scan itself
  cannot produce a nested repository — it stops at a known repository's
  boundary — so `.gitmodules` is the only automatic route, but the manual one
  is a real if rare false positive.
- `telemetry.json` and the README disclosure were updated in the same slice, as
  the telemetry rules require; both state that the deciding paths never leave
  the extension.

**The gate caught a ReDoS in the merged code, and this is the argument for
running it on outside contributions.** The first scan came back **ERROR** on
`software_quality_reliability_issues` `1`: `typescript:S8786` on the
`.gitmodules` reader's `/^\s*path\s*=\s*(.+?)\s*$/` — a lazy `(.+?)` followed
by `\s*$` backtracks super-linearly, and `.gitmodules` is content from whatever
repository the user opened, so it is not trusted input. It was replaced by
`parseSubmodulePathEntry()`, a linear split on the first `=` with both halves
trimmed, which decides the same lines (a `# path = x` comment still does not
trim to the key `path`) and additionally matches git's own case-insensitive
config keys, so a hand-written `Path =` now works. A test pins the accepted and
rejected line shapes including a 5,000-character whitespace run. That finding
was the slice's only new violation.

Verification (`2026-09-03`):

- `git fetch --all --prune`; `main` level with `origin/main` at `c3f5fc0`
- strict Biome `check` (lint + format + import order) over all 11 touched
  files, warnings as errors, clean. Four merged files needed formatting and
  `src/extension/messageHandler.ts` carried a pre-existing import-order
  finding, fixed here under the touched-files rule.
- `pnpm run package` (typecheck, whole-tree lint over `223` files, production
  builds)
- `pnpm run test`: backend `54` files / `421` tests, webview `42` files /
  `413` tests
- `pnpm run test:ext`: both launches green (`53` + `1`)
- `pnpm run l10n:check`: `100%` package and bundle coverage for all five
  languages (no new keys — the telemetry signals have no user-facing string)
- `pnpm run test:coverage`: `96` files / `834` tests
- `graphify update .` + `graphify tree`: rebuilt at `2,321` nodes / `5,409`
  edges / `145` communities
- `pnpm run sonar:scan` with fresh coverage from the completed working tree.
  First scan task `0f8ed3f5-1cda-4766-8925-d7ea394ec577`, analysis
  `af82d354-621f-47d0-a9be-c9af1b6fddc8`: **ERROR**, the S8786 finding above.
  After the fix, task `70e9bb1c-031a-4117-b0e1-d0daa26b75a5`, analysis
  `0a4755cb-5ef4-4eda-b464-de524518eee2`: `ZAM` gate **`OK`** on all seven
  conditions — `new_coverage` `90.3`, `new_duplicated_lines_density` `0.0`,
  `new_violations` `0`, `new_software_quality_high_issues` `0`,
  `software_quality_maintainability_rating` `1`, and project-wide reliability
  and security issues `0`.
- A latent bug in `tests/webview/messageHandler.test.ts` surfaced here and is
  worth knowing about: its `loadCommitsRequest` was a `const` object literal
  built at describe-collection time, so it captured `repo` before `beforeAll`
  assigned it and had been sending `repo: undefined` into the route. The
  telemetry facts read `msg.repo`, which turned that into a crash. It is now a
  factory function; check for the same shape before adding fixtures to that
  file.
- Known gap, unchanged: `pnpm run format` still reports pre-existing drift in
  files this slice did not touch — `.vscode/settings.json`,
  `src/extension/webviewHtml.ts`, `src/extension/webviewLanguages.ts`,
  `tests/backend/avatarManager.test.ts`,
  `tests/backend/diffDocProvider.test.ts`,
  `tests/backend/telemetry/language.test.ts`,
  `tests/webview/telemetryConsentPrompt.test.ts`,
  `tests/webview/utils/dom.test.ts` and `tests/webview/webviewPanel.test.ts`.
  The list has grown since the `2026-07-29` note of six; four arrived with the
  1.4.0 telemetry line. Left for a dedicated cleanup slice per the
  scoped-cleanup rule — `pnpm run package` does not run the formatter, so this
  blocks nothing.
